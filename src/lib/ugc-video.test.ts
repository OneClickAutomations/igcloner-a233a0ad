import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const landing = readFileSync(new URL("../assets/landing.html", import.meta.url), "utf8");

const VIDEOS = [
  "/ugc/jasmine-fitness.mp4",
  "/ugc/sofia-beauty.mp4",
  "/ugc/marcus-food.mp4",
  "/ugc/chloe-travel.mp4",
  "/ugc/deshawn-fashion.mp4",
  "/ugc/priya-tech.mp4",
];

const videoTags = landing.match(/<video class="ugc-video"[^>]*>/g) ?? [];

describe("UGC ticker videos", () => {
  it("has one video per card pointing at the right file in order", () => {
    expect(videoTags.map((t) => t.match(/src="([^"]+)"/)?.[1])).toEqual(VIDEOS);
    expect((landing.match(/<div class="ugc-card">/g) ?? []).length).toBe(6);
  });

  it("each video has a poster matching its src", () => {
    videoTags.forEach((tag, i) => {
      expect(tag).toContain(`poster="${VIDEOS[i].replace(/\.mp4$/, ".jpg")}"`);
    });
    expect(videoTags).toHaveLength(6);
  });

  it("each video is muted, looped, inline and not autoplay", () => {
    for (const tag of videoTags) {
      expect(tag).toMatch(/\smuted[\s>]/);
      expect(tag).toMatch(/\sloop[\s>]/);
      expect(tag).toMatch(/\splaysinline[\s>]/);
      expect(tag).not.toMatch(/autoplay/);
    }
  });

  it("has no leftovers from the audio-poster system", () => {
    for (const s of ["data-audio", "ugc-vol-btn", "ugc-audio-wave", "ugc-avatar-large", "new Audio("]) {
      expect(landing).not.toContain(s);
    }
  });

  it("plays on scroll-in and pauses on scroll-out via IntersectionObserver", () => {
    expect(landing).toContain("new IntersectionObserver(");
    expect(landing).toContain("v.preload = 'auto'");
    expect(landing).toContain("v.play()");
    expect(landing).toContain("v.pause()");
  });

  it("unmutes only the selected video, toggles it off, and transfers sound", () => {
    const soundFunctions = landing.match(/  function updateSoundState[\s\S]*?(?=  cards\.forEach\(card => \{)/)?.[0];
    expect(soundFunctions).toBeDefined();
    const cards = VIDEOS.map(() => {
      const video = { muted: true };
      const indicator = { hidden: true };
      return {
        video,
        indicator,
        querySelector: (selector: string) => selector === ".ugc-video" ? video : indicator,
        setAttribute: () => {},
      };
    });
    const toggle = new Function("cards", "pauseAutoScroll", `${soundFunctions}\nreturn toggleCardSound;`)(cards, () => {});
    toggle(cards[4]);
    expect(cards.map(c => c.video.muted)).toEqual([true, true, true, true, false, true]);
    expect(cards.map(c => c.indicator.hidden)).toEqual([true, true, true, true, false, true]);
    toggle(cards[4]);
    expect(cards.map(c => c.video.muted)).toEqual([true, true, true, true, true, true]);
    toggle(cards[4]);
    toggle(cards[1]);
    expect(cards.map(c => c.video.muted)).toEqual([true, false, true, true, true, true]);
    expect(cards.map(c => c.indicator.hidden)).toEqual([true, false, true, true, true, true]);
  });

  it("ignores clicks after pointer movement greater than six pixels", () => {
    const pointerHandler = landing.match(/track\.addEventListener\('pointermove', e => \{([\s\S]*?)\n  \}\);/)?.[1];
    expect(pointerHandler).toBeDefined();
    const moved = new Function("e", `let pointerStartX = 0, pointerStartY = 0, pointerMoved = false; ${pointerHandler}; return pointerMoved;`);
    expect(moved({ clientX: 3, clientY: 3 })).toBe(false);
    expect(moved({ clientX: 7, clientY: 0 })).toBe(true);
    const clickHandler = landing.match(/card\.addEventListener\('click', \(\) => \{([\s\S]*?)\n    \}\);/)?.[1];
    expect(clickHandler).toBeDefined();
    if (!clickHandler) throw new Error("Missing card click handler");
    let toggles = 0;
    const click = new Function("pointerMoved", "toggleCardSound", "card", clickHandler);
    click(true, () => toggles++, {});
    expect(toggles).toBe(0);
    click(false, () => toggles++, {});
    expect(toggles).toBe(1);
  });
});

describe("landing scripts", () => {
  it("every inline script parses", () => {
    const scripts = [...landing.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    expect(scripts.length).toBeGreaterThan(0);
    for (const code of scripts) expect(() => new Function(code)).not.toThrow();
  });
});
