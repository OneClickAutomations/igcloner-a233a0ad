import { describe, it, expect } from "vitest";
import {
  SAMPLING, COMPETITOR_WINDOW_DAYS, NICHE_WINDOW_DAYS,
  COMPETITOR_RELAX_MIN_POSTS, COMPETITOR_RELAX_LIMIT, NICHE_FILTER_MIN_POSTS,
  cutoffDate, filterPostsByCutoff,
} from "./research-sampling";

describe("sampling config is the single source of truth", () => {
  it("standard caps: 40 competitor posts, 3 tags x 15 niche posts", () => {
    expect(SAMPLING.standard).toEqual({ competitorPosts: 40, nicheTagCount: 3, nichePerTag: 15 });
  });
  it("deep placeholder exists but stays unwired", () => {
    expect(SAMPLING.deep).toEqual({ competitorPosts: 60, nicheTagCount: 3, nichePerTag: 30 });
  });
  it("windows and thresholds", () => {
    expect(COMPETITOR_WINDOW_DAYS).toBe(180);
    expect(NICHE_WINDOW_DAYS).toBe(90);
    expect(COMPETITOR_RELAX_MIN_POSTS).toBe(12);
    expect(COMPETITOR_RELAX_LIMIT).toBe(20);
    expect(NICHE_FILTER_MIN_POSTS).toBe(15);
  });
});

describe("cutoffDate", () => {
  it("computes today minus 180 days as UTC YYYY-MM-DD", () => {
    expect(cutoffDate(180, new Date("2026-11-05T06:00:00Z"))).toBe("2026-05-09");
  });
  it("crosses month and year boundaries correctly", () => {
    expect(cutoffDate(90, new Date("2026-03-01T12:00:00Z"))).toBe("2025-12-01");
    expect(cutoffDate(180, new Date("2026-01-15T00:00:00Z"))).toBe("2025-07-19");
    expect(cutoffDate(1, new Date("2026-01-01T00:00:00Z"))).toBe("2025-12-31");
  });
});

describe("filterPostsByCutoff", () => {
  const cutoff = "2026-05-09";
  it("drops a stale pinned post that leaked through the actor filter", () => {
    const pinned = { timestamp: "2025-01-01T00:00:00Z", caption: "pinned" };
    const fresh = { timestamp: "2026-10-01T00:00:00Z", caption: "fresh" };
    const r = filterPostsByCutoff([pinned, fresh], cutoff);
    expect(r.kept).toEqual([fresh]);
    expect(r.droppedStale).toBe(1);
  });
  it("keeps posts with missing or invalid timestamps and counts them separately", () => {
    const noTs: { timestamp?: unknown; caption: string } = { caption: "no timestamp" };
    const badTs = { timestamp: "not-a-date", caption: "bad" };
    const r = filterPostsByCutoff([noTs, badTs], cutoff);
    expect(r.kept).toHaveLength(2);
    expect(r.missingTimestamp).toBe(2);
    expect(r.droppedStale).toBe(0);
  });
  it("keeps a post exactly on the cutoff date", () => {
    const onCutoff = { timestamp: "2026-05-09T00:00:00Z" };
    expect(filterPostsByCutoff([onCutoff], cutoff).kept).toHaveLength(1);
  });
});

describe("relax and skip thresholds", () => {
  const cutoff = "2026-05-09";
  const freshPosts = (n: number) => Array.from({ length: n }, (_, i) => ({ timestamp: `2026-10-${String((i % 28) + 1).padStart(2, "0")}T12:00:00Z`, caption: `post ${i}` }));
  it("relax fallback triggers at 11 in-window posts, not at 12", () => {
    expect(filterPostsByCutoff(freshPosts(11), cutoff).kept.length < COMPETITOR_RELAX_MIN_POSTS).toBe(true);
    expect(filterPostsByCutoff(freshPosts(12), cutoff).kept.length < COMPETITOR_RELAX_MIN_POSTS).toBe(false);
  });
  it("niche filter applies when it leaves 15, is skipped when it leaves 14", () => {
    expect(filterPostsByCutoff(freshPosts(15), cutoff).kept.length >= NICHE_FILTER_MIN_POSTS).toBe(true);
    expect(filterPostsByCutoff(freshPosts(14), cutoff).kept.length >= NICHE_FILTER_MIN_POSTS).toBe(false);
  });
});
