import { describe, expect, it } from "vitest";
import {
  activeDays,
  countPreviousMonth,
  countThisMonth,
  dailySeries,
  monthDelta,
} from "./dashboard-metrics";

const NOW = new Date(2026, 10, 15, 12, 0, 0); // Nov 15 2026, local noon

describe("monthDelta", () => {
  it("previous month zero with current activity → 'New', never Infinity/NaN", () => {
    const d = monthDelta(5, 0);
    expect(d.pct).toBeNull();
    expect(d.kind).toBe("new");
    expect(d.label).toBe("New");
    expect(d.label).not.toMatch(/Infinity|NaN/);
  });

  it("previous month zero and no activity → flat 'No change'", () => {
    const d = monthDelta(0, 0);
    expect(d.kind).toBe("flat");
    expect(d.label).toBe("No change");
  });

  it("negative delta → down kind with signed percent", () => {
    const d = monthDelta(3, 10);
    expect(d.pct).toBe(-70);
    expect(d.kind).toBe("down");
    expect(d.label).toBe("-70% vs last month");
  });

  it("exactly zero delta → flat, no arrow wording", () => {
    const d = monthDelta(4, 4);
    expect(d.pct).toBe(0);
    expect(d.kind).toBe("flat");
    expect(d.label).toBe("No change");
  });

  it("positive delta rounds to a whole percent", () => {
    const d = monthDelta(13, 10);
    expect(d.pct).toBe(30);
    expect(d.kind).toBe("up");
    expect(d.label).toBe("+30% vs last month");
  });
});

describe("dailySeries", () => {
  it("returns one point per day in the window, zero days included", () => {
    const s = dailySeries([], 30, NOW);
    expect(s).toHaveLength(30);
    expect(s.every((n) => n === 0)).toBe(true);
  });

  it("buckets counts onto the right days, oldest first", () => {
    const today = new Date(2026, 10, 15, 9, 0, 0).toISOString();
    const yesterday = new Date(2026, 10, 14, 23, 0, 0).toISOString();
    const s = dailySeries([today, today, yesterday], 3, NOW);
    expect(s).toEqual([0, 1, 2]);
  });

  it("ignores dates outside the window and invalid values", () => {
    const old = new Date(2026, 9, 1, 12, 0, 0).toISOString();
    const s = dailySeries([old, null, "not-a-date"], 14, NOW);
    expect(s).toHaveLength(14);
    expect(s.reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe("month buckets", () => {
  const inNov = new Date(2026, 10, 3, 10, 0, 0).toISOString();
  const inOct = new Date(2026, 9, 20, 10, 0, 0).toISOString();
  const inSep = new Date(2026, 8, 5, 10, 0, 0).toISOString();

  it("countThisMonth only counts the current calendar month", () => {
    expect(countThisMonth([inNov, inOct, inSep, null], NOW)).toBe(1);
  });

  it("countPreviousMonth only counts the previous calendar month", () => {
    expect(countPreviousMonth([inNov, inOct, inOct, inSep], NOW)).toBe(2);
  });
});

describe("activeDays", () => {
  it("counts distinct days with activity in the window", () => {
    const d1 = new Date(2026, 10, 14, 8, 0, 0).toISOString();
    const d1b = new Date(2026, 10, 14, 20, 0, 0).toISOString();
    const d2 = new Date(2026, 10, 10, 12, 0, 0).toISOString();
    expect(activeDays([d1, d1b, d2], 30, NOW)).toBe(2);
  });

  it("is zero when there is no history", () => {
    expect(activeDays([], 30, NOW)).toBe(0);
  });
});
