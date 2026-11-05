// Pure filtering, sorting and pagination helpers for the Projects page.
// The page loads every project for the signed-in user in one request, so all
// of this runs client-side in memory.

export type ProjectSort = "recent" | "oldest" | "score";
export type DateRangePreset = "7d" | "30d" | "90d" | "all";

export interface ProjectFilterState {
  q: string;
  sort: ProjectSort;
  type: string; // "all" or a project format
  range: DateRangePreset;
}

export const DEFAULT_FILTERS: ProjectFilterState = {
  q: "",
  sort: "recent",
  type: "all",
  range: "all",
};

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 10;

const RANGE_DAYS: Record<Exclude<DateRangePreset, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export function normalizeSort(v: string): ProjectSort {
  return v === "oldest" || v === "score" ? v : "recent";
}

export function normalizeRange(v: string): DateRangePreset {
  return v === "7d" || v === "30d" || v === "90d" ? v : "all";
}

export function normalizePageSize(v: number): number {
  return (PAGE_SIZES as readonly number[]).includes(v) ? v : DEFAULT_PAGE_SIZE;
}

/** Performance score carried over from the source analysis, if any. */
export function projectScore(p: any): number | null {
  const s = p?.dna_analysis?.performanceScore;
  return typeof s === "number" && Number.isFinite(s) ? s : null;
}

function projectTime(p: any): number {
  const t = Date.parse(p?.created_at ?? "");
  return Number.isFinite(t) ? t : 0;
}

function matchesQuery(p: any, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [p.title, p.source_account, p.format, p.status, p.source_url]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

function inRange(p: any, range: DateRangePreset, now: number): boolean {
  if (range === "all") return true;
  const cutoff = now - RANGE_DAYS[range] * 24 * 60 * 60 * 1000;
  return projectTime(p) >= cutoff;
}

/** Distinct format values present in the data, in first-seen order. */
export function distinctTypes(projects: any[]): string[] {
  const seen = new Set<string>();
  for (const p of projects) {
    if (p?.format && !seen.has(p.format)) seen.add(p.format);
  }
  return [...seen];
}

export function applyFilters(
  projects: any[],
  f: ProjectFilterState,
  now: number = Date.now(),
): any[] {
  const out = projects.filter(
    (p) =>
      matchesQuery(p, f.q) &&
      inRange(p, f.range, now) &&
      (f.type === "all" || p.format === f.type),
  );
  out.sort((a, b) => {
    if (f.sort === "oldest") return projectTime(a) - projectTime(b);
    if (f.sort === "score") {
      const sa = projectScore(a);
      const sb = projectScore(b);
      if (sa == null && sb == null) return projectTime(b) - projectTime(a);
      if (sa == null) return 1; // unscored projects sink to the end
      if (sb == null) return -1;
      return sb - sa;
    }
    return projectTime(b) - projectTime(a); // recent
  });
  return out;
}

export function pageCount(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / perPage));
}

/**
 * Clamp a requested page into the valid range for the result set. A user on
 * page 7 whose filters shrink the result to 2 pages lands on page 2 instead
 * of an empty screen.
 */
export function clampPage(page: number, total: number, perPage: number): number {
  const last = pageCount(total, perPage);
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(Math.floor(page), last);
}

export interface PageSlice<T> {
  items: T[];
  page: number;
  total: number;
  pageCount: number;
  from: number; // 1-based index of first shown row, 0 when empty
  to: number; // 1-based index of last shown row, 0 when empty
}

export function paginate<T>(items: T[], page: number, perPage: number): PageSlice<T> {
  const total = items.length;
  const safePage = clampPage(page, total, perPage);
  const start = (safePage - 1) * perPage;
  const slice = items.slice(start, start + perPage);
  return {
    items: slice,
    page: safePage,
    total,
    pageCount: pageCount(total, perPage),
    from: total === 0 ? 0 : start + 1,
    to: start + slice.length,
  };
}
