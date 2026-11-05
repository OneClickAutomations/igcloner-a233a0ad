import { describe, expect, it } from "vitest";
import {
  applyFilters,
  clampPage,
  distinctTypes,
  paginate,
  pageCount,
  DEFAULT_FILTERS,
} from "./projects-filter";

const NOW = Date.parse("2026-11-05T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW - n * 86400000).toISOString();

const mk = (over: Record<string, any>) => ({
  id: Math.random().toString(36).slice(2),
  title: "Untitled",
  format: "reel",
  status: "draft",
  source_account: "creator",
  created_at: daysAgo(1),
  dna_analysis: null,
  ...over,
});

describe("clampPage / reset-to-page-one behaviour", () => {
  it("clamps a stranded page down to the last valid page", () => {
    // 12 items at 10/page = 2 pages; a stale page 7 must land on page 2.
    expect(clampPage(7, 12, 10)).toBe(2);
  });

  it("clamps page 1 when filters empty the result set", () => {
    expect(clampPage(5, 0, 10)).toBe(1);
  });

  it("keeps a valid page untouched", () => {
    expect(clampPage(2, 70, 10)).toBe(2);
  });

  it("recovers from invalid page values", () => {
    expect(clampPage(0, 70, 10)).toBe(1);
    expect(clampPage(-3, 70, 10)).toBe(1);
    expect(clampPage(Number.NaN, 70, 10)).toBe(1);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 70 }, (_, i) => i + 1);

  it("slices the requested page", () => {
    const p = paginate(items, 3, 25);
    expect(p.items[0]).toBe(51);
    expect(p.items).toHaveLength(20);
    expect(p.from).toBe(51);
    expect(p.to).toBe(70);
    expect(p.total).toBe(70);
    expect(p.pageCount).toBe(3);
  });

  it("reports zero-based bounds for an empty set", () => {
    const p = paginate([], 1, 10);
    expect(p.from).toBe(0);
    expect(p.to).toBe(0);
    expect(p.pageCount).toBe(1);
  });
});

describe("applyFilters", () => {
  const projects = [
    mk({ title: "Fitness reel", source_account: "jasmine.fit", format: "reel", created_at: daysAgo(2), dna_analysis: { performanceScore: 88 } }),
    mk({ title: "Food carousel", source_account: "marcus.eats", format: "carousel", created_at: daysAgo(20) }),
    mk({ title: "Travel caption", source_account: "chloe.roams", format: "caption", created_at: daysAgo(80), dna_analysis: { performanceScore: 64 } }),
  ];

  it("matches text against handle and title, case-insensitive", () => {
    const r = applyFilters(projects, { ...DEFAULT_FILTERS, q: "JASMINE" }, NOW);
    expect(r).toHaveLength(1);
    expect(r[0].title).toBe("Fitness reel");
  });

  it("filters by type", () => {
    const r = applyFilters(projects, { ...DEFAULT_FILTERS, type: "carousel" }, NOW);
    expect(r.map((p) => p.format)).toEqual(["carousel"]);
  });

  it("filters by date range preset", () => {
    expect(applyFilters(projects, { ...DEFAULT_FILTERS, range: "7d" }, NOW)).toHaveLength(1);
    expect(applyFilters(projects, { ...DEFAULT_FILTERS, range: "30d" }, NOW)).toHaveLength(2);
    expect(applyFilters(projects, { ...DEFAULT_FILTERS, range: "all" }, NOW)).toHaveLength(3);
  });

  it("sorts most recent first by default and oldest on request", () => {
    const recent = applyFilters(projects, DEFAULT_FILTERS, NOW);
    expect(recent[0].title).toBe("Fitness reel");
    const oldest = applyFilters(projects, { ...DEFAULT_FILTERS, sort: "oldest" }, NOW);
    expect(oldest[0].title).toBe("Travel caption");
  });

  it("sorts by score with unscored projects last", () => {
    const r = applyFilters(projects, { ...DEFAULT_FILTERS, sort: "score" }, NOW);
    expect(r.map((p) => p.title)).toEqual(["Fitness reel", "Travel caption", "Food carousel"]);
  });
});

describe("distinctTypes", () => {
  it("derives types from the data, not a hardcoded list", () => {
    const types = distinctTypes([
      mk({ format: "reel" }),
      mk({ format: "caption" }),
      mk({ format: "reel" }),
    ]);
    expect(types).toEqual(["reel", "caption"]);
  });
});

describe("pageCount", () => {
  it("rounds up and never returns zero", () => {
    expect(pageCount(70, 10)).toBe(7);
    expect(pageCount(71, 10)).toBe(8);
    expect(pageCount(0, 10)).toBe(1);
  });
});
