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
});

describe("landing scripts", () => {
  it("every inline script parses", () => {
    const scripts = [...landing.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    expect(scripts.length).toBeGreaterThan(0);
    for (const code of scripts) expect(() => new Function(code)).not.toThrow();
  });
});
