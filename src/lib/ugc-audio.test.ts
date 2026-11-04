import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const landing = readFileSync(new URL("../assets/landing.html", import.meta.url), "utf8");

const AUDIO_URLS = [
  "https://elevenlabsusercontent.com/database/workspace/eaa2d5fd1dc34066b3b0fac6721720cf/content_generation/dE0M75YXBoz1OmzbNpHi/cHymoenR0A1ND6jiZw8F/content.mp3?Expires=1793768400&KeyName=assets-cdn-key-1&Signature=ibvG_i20HssQtMR2-iSJ1zOVUAM=",
  "https://elevenlabsusercontent.com/database/workspace/eaa2d5fd1dc34066b3b0fac6721720cf/content_generation/GNqdiNnseGnEZW0tWTRk/gLgIQWt6omhSbLNAvJko/content.mp3?Expires=1793768400&KeyName=assets-cdn-key-1&Signature=nBs6fjaHLmZfnVJ4KYoRmFu6P0I=",
  "https://elevenlabsusercontent.com/database/workspace/eaa2d5fd1dc34066b3b0fac6721720cf/content_generation/BCtmOcnJjrVzBulvpxiY/L0OsDyQX2XYdw2E6RTRh/content.mp3?Expires=1793768400&KeyName=assets-cdn-key-1&Signature=INKhLGWrC89p7ObGrW0AzrVVJDI=",
  "https://elevenlabsusercontent.com/database/workspace/eaa2d5fd1dc34066b3b0fac6721720cf/content_generation/pfQT7bRX9JPLrgrKA2Rc/4J8AvDMW2WapT8j6S4IH/content.mp3?Expires=1793768400&KeyName=assets-cdn-key-1&Signature=V5Nvb9gIh__qK9lN0e9imP-ZhZ8=",
  "https://elevenlabsusercontent.com/database/workspace/eaa2d5fd1dc34066b3b0fac6721720cf/content_generation/8NuL9WTI7Hp05FfMt7is/qufsdg6zS3h3kZIz4sj6/content.mp3?Expires=1793768400&KeyName=assets-cdn-key-1&Signature=vSTiRzVN0AhY_PiXqlCsl8-uwAE=",
  "https://elevenlabsusercontent.com/database/workspace/eaa2d5fd1dc34066b3b0fac6721720cf/content_generation/iGESU970jju5idCkLePP/GidsTtbhXWVxdWEuaNbV/content.mp3?Expires=1793768400&KeyName=assets-cdn-key-1&Signature=3dGR4M5OSGE4I5jnz_Tz5p_Z7NQ=",
];

const ICON_ON =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';

function cardBlocks() {
  const blocks = landing.split('<div class="ugc-card ugc-card-audio"');
  expect(blocks.length - 1, "expected six UGC cards").toBe(6);
  return blocks.slice(1).map((b) => b.slice(0, b.indexOf("</div><!-- /ugc-track -->") === -1 ? b.length : b.length));
}

describe("UGC ticker voiceover audio", () => {
  const cards = cardBlocks();

  it("gives every card its own data-audio URL, in order", () => {
    cards.forEach((card, i) => {
      expect(card, `card ${i + 1} data-audio`).toContain(`data-audio="${AUDIO_URLS[i]}"`);
    });
  });

  it("gives every card a speaker toggle showing the unmuted icon by default", () => {
    cards.forEach((card, i) => {
      expect(card, `card ${i + 1} speaker button`).toContain(
        `<button class="ugc-vol-btn" aria-label="Play voiceover">${ICON_ON}</button>`,
      );
    });
  });

  it("keeps the audio wave animating regardless of play state", () => {
    expect(landing).not.toContain("animation-play-state: paused");
    expect(landing).toContain("animation: ugc-wave 1.2s ease-in-out infinite;");
  });

  it("plays the card's own clip, swaps the icon, and stops the previous card", () => {
    expect(landing).toContain("const src = card.dataset.audio;");
    expect(landing).toContain("const aud = new Audio(src);");
    expect(landing).toContain("stopCurrent(ICON_OFF)");
    expect(landing).toContain("currentBtn.innerHTML = finalIcon || ICON_OFF;");
    expect(landing).toContain("btn.innerHTML = ICON_ON;");
    // the muted (speaker-off) icon is the crossed-out variant
    expect(landing).toContain('<line x1="23" y1="9" x2="17" y2="15"/>');
  });

  it("no longer depends on the removed global mute button or play overlays", () => {
    expect(landing).not.toContain("ugcMuteBtn");
    expect(landing).not.toContain("ugc-play-btn");
  });
});
