// Pure dashboard metric helpers — no DOM, no supabase. Unit-tested.

export type DeltaKind = "up" | "down" | "flat" | "new" | "none";

export interface MonthDelta {
  current: number;
  previous: number;
  /** null when previous month is zero (no meaningful percent). */
  pct: number | null;
  kind: DeltaKind;
  /** Ready-to-render label, e.g. "+12% vs last month", "New", "No change". */
  label: string;
}

/** Month-over-month delta for a count metric. */
export function monthDelta(current: number, previous: number): MonthDelta {
  if (previous === 0 && current === 0) {
    // No activity in either window: nothing to report, render no pill.
    return { current, previous, pct: null, kind: "none", label: "" };
  }
  if (previous === 0) {
    return {
      current,
      previous,
      pct: null,
      kind: current > 0 ? "new" : "flat",
      label: current > 0 ? "New" : "No change",
    };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  const kind: DeltaKind = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  const label =
    pct === 0 ? "No change" : `${pct > 0 ? "+" : ""}${pct}% vs last month`;
  return { current, previous, pct, kind, label };
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Count items per calendar day over the last `days` days (ending today).
 * Every day gets a point, including zero-count days, so the axis is never
 * compressed. Returns oldest → newest.
 */
export function dailySeries(
  dates: Array<string | null | undefined>,
  days: number,
  now: Date = new Date(),
): number[] {
  const buckets = new Map<string, number>();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  for (const iso of dates) {
    if (!iso) continue;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()) || d < start || d > now) continue;
    const k = dayKey(d);
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  const out: number[] = [];
  const cursor = new Date(start);
  for (let i = 0; i < days; i++) {
    out.push(buckets.get(dayKey(cursor)) ?? 0);
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/** Count of items created in the current calendar month. */
export function countThisMonth(
  dates: Array<string | null | undefined>,
  now: Date = new Date(),
): number {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return dates.filter((iso) => iso && new Date(iso) >= start && new Date(iso) <= now).length;
}

/** Count of items created in the previous calendar month. */
export function countPreviousMonth(
  dates: Array<string | null | undefined>,
  now: Date = new Date(),
): number {
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  return dates.filter((iso) => {
    if (!iso) return false;
    const d = new Date(iso);
    return d >= start && d < end;
  }).length;
}

/** Distinct days with at least one item inside the last `days`-day window. */
export function activeDays(
  dates: Array<string | null | undefined>,
  days: number,
  now: Date = new Date(),
): number {
  return dailySeries(dates, days, now).filter((n) => n > 0).length;
}
