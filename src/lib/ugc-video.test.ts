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

  it("matches the five supplied speech quotes while preserving DeShawn", () => {
    const quotes = [...landing.matchAll(/<p class="ugc-quote">"([\s\S]*?)"<\/p>/g)].map(match => match[1]);
    expect(quotes).toEqual([
      "IGCloner showed me exactly what the top fitness creators were doing. My engagement tripled in six weeks.",
      "I cloned the posting pattern of a creator who blew up overnight. Now the algorithm actually pushes my reels.",
      "I reverse-engineered the top food creators' hooks with IGCloner. Two thousand followers to thirty-eight thousand in two months.",
      "IGCloner broke down why certain travel reels take off. I stopped guessing, and my views went up five times.",
      "Bro, I was posting fits getting nothing. IGCloner showed me what the algorithm actually rewards — now I'm hitting 50K+ consistently.",
      "I used IGCloner to study the biggest tech channels. My last three reels all beat everything I'd posted before.",
    ]);
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
      const indicator = { hidden: true, innerHTML: "" };
      return {
        video,
        indicator,
        querySelector: (selector: string) => selector === ".ugc-video" ? video : indicator,
        setAttribute: () => {},
      };
    });
    const { toggle, update } = new Function("cards", "pauseAutoScroll", `${soundFunctions}\nreturn { toggle: toggleCardSound, update: updateSoundState };`)(cards, () => {});
    cards.forEach(card => update(card, card.video));
    expect(cards.every(c => !c.indicator.hidden)).toBe(true);
    expect(cards.every(c => c.indicator.innerHTML.includes("<line"))).toBe(true);
    toggle(cards[4]);
    expect(cards.map(c => c.video.muted)).toEqual([true, true, true, true, false, true]);
    expect(cards.every(c => !c.indicator.hidden)).toBe(true);
    expect(cards[4].indicator.innerHTML).toContain("<path");
    toggle(cards[4]);
    expect(cards.map(c => c.video.muted)).toEqual([true, true, true, true, true, true]);
    cards.forEach((card, selected) => {
      toggle(card);
      expect(cards.map(c => c.video.muted)).toEqual(cards.map((_, i) => i !== selected));
      expect(cards.every(c => !c.indicator.hidden)).toBe(true);
      expect(cards.map(c => c.indicator.innerHTML.includes("<path"))).toEqual(cards.map((_, i) => i === selected));
    });
  });

  it("ignores clicks after pointer movement greater than six pixels", () => {
    const pointerHandler = landing.match(/track\.addEventListener\('pointermove', e => \{([\s\S]*?)\n  \}\);/)?.[1];
    expect(pointerHandler).toBeDefined();
    const moved = new Function("e", `let pointerStartX = 0, pointerStartY = 0, pointerMoved = false, activePointer = 1; const reducedMotion = {matches:true}; ${pointerHandler}; return pointerMoved;`);
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

  it("duplicates exactly one full sequence without introducing keyboard stops", () => {
    const body = landing.match(/  function createLoopCopy\(group\) \{([\s\S]*?)\n  \}/)?.[1];
    if (!body) throw new Error("Missing loop duplication function");
    const attributes = new Map<string, string>([["id", "ugcOriginal"]]);
    const copiedCards = VIDEOS.map(src => ({ src, tabindex: "0", setAttribute(_key: string, value: string) { this.tabindex = value; } }));
    const copy = {
      removeAttribute: (key: string) => attributes.delete(key),
      setAttribute: (key: string, value: string) => attributes.set(key, value),
      querySelectorAll: (selector: string) => selector === ".ugc-card" ? copiedCards : [],
    };
    let clones = 0;
    const duplicate = new Function("group", body)({ cloneNode: (deep: boolean) => { expect(deep).toBe(true); clones++; return copy; } });
    expect(clones).toBe(1);
    expect(duplicate).toBe(copy);
    expect(attributes.has("id")).toBe(false);
    expect(attributes.get("aria-hidden")).toBe("true");
    expect(copiedCards.map(card => card.src)).toEqual(VIDEOS);
    expect(copiedCards.map(card => card.tabindex)).toEqual(["-1", "-1", "-1", "-1", "-1", "-1"]);
  });

  it("uses exact sequence width for constant 21.23px/sec motion on desktop and mobile", () => {
    const body = landing.match(/  function loopMetrics\(width\) \{([\s\S]*?)\n  \}/)?.[1];
    if (!body) throw new Error("Missing loop metrics");
    const metrics = new Function("width", body);
    for (const width of [1680, 1404]) {
      const result = metrics(width);
      expect(result.distance).toBe(width);
      expect(result.duration).toBeCloseTo(width / 21.23 * 1000, 6);
      expect(result.distance / (result.duration / 1000)).toBeCloseTo(21.23, 6);
    }
  });

  it("plays only the visible copy of each creator, with an absolute six-video ceiling", () => {
    const body = landing.match(/  function selectVisibleCopies\(list, ratios, limit\) \{([\s\S]*?)\n  \}/)?.[1];
    if (!body) throw new Error("Missing visible-copy selection");
    const select = new Function("list", "ratios", "limit", body);
    const originals = VIDEOS.map((_, i) => ({ dataset: { creator: String(i) } }));
    const copies = originals.map(card => ({ dataset: { ...card.dataset } }));
    const cards = [...originals, ...copies];
    const ratios = new Map(cards.map(card => [card, 0]));
    expect(select(cards, ratios, 6)).toEqual([]);
    originals.forEach(card => ratios.set(card, 0.5));
    copies.forEach(card => ratios.set(card, 1));
    expect(select(cards, ratios, 6)).toEqual(copies);
    copies.forEach(card => ratios.set(card, 0));
    expect(select(cards, ratios, 6)).toEqual(originals);
    ratios.set(originals[0], 0.24);
    expect(select(cards, ratios, 6)).toEqual(originals.slice(1));
  });
});

describe("landing scripts", () => {
  it("every inline script parses", () => {
    const scripts = [...landing.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    expect(scripts.length).toBeGreaterThan(0);
    for (const code of scripts) expect(() => new Function(code)).not.toThrow();
  });
});
