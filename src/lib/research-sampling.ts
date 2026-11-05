// ─────────────────────────────────────────────────────────────────────
// Research sampling — single source of truth for scrape sizes, recency
// windows, and the code-side cutoff safety net. No magic numbers in
// research.functions.ts.
//
// `standard` is the only depth used by the UI in this pass. `deep` is
// placeholder plumbing for the premium add-on (comments + peer benchmark)
// and must stay unwired until that analysis exists — never charge for it.
// ─────────────────────────────────────────────────────────────────────

export const SAMPLING = {
  standard: { competitorPosts: 40, nicheTagCount: 3, nichePerTag: 15 },
  deep: { competitorPosts: 60, nicheTagCount: 3, nichePerTag: 30 },
} as const;

export type SamplingDepth = keyof typeof SAMPLING;

/** Competitor posts are limited to the last 180 days (~6 months). */
export const COMPETITOR_WINDOW_DAYS = 180;
/** Niche feeds mix evergreen top posts; keep only the last 90 days. */
export const NICHE_WINDOW_DAYS = 90;

/** Below this many in-window posts, a non-private competitor gets ONE
 *  relaxed fallback scrape with no cutoff (a weekly poster must not be
 *  stuck with a 9-post sample). */
export const COMPETITOR_RELAX_MIN_POSTS = 12;
export const COMPETITOR_RELAX_LIMIT = 20;

/** Niche code-side filtering applies only if it leaves at least this many
 *  posts; otherwise everything is kept and the cutoff is marked skipped. */
export const NICHE_FILTER_MIN_POSTS = 15;

/** Concrete UTC cutoff date (YYYY-MM-DD) `days` before `now`. Deterministic
 *  and testable — never a relative string like "6 months". */
export function cutoffDate(days: number, now: Date = new Date()): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10);
}

export interface CutoffMeta {
  /** The YYYY-MM-DD cutoff used, or null when none applied. */
  date: string | null;
  windowDays: number;
  /** Where the cutoff was enforced: actor input, code filter, both, or none. */
  appliedAt: "actor" | "code" | "both" | "none";
  /** Competitor relax fallback fired (account posts infrequently). */
  relaxed: boolean;
  /** Niche filter skipped because it would leave too few posts. */
  skipped: boolean;
  /** Posts dropped by the code-side filter (stale / pinned leaks). */
  droppedStale: number;
  /** Plain-language reason when skipped. */
  skippedReason?: string;
}

export interface CutoffFilterResult<T> {
  kept: T[];
  droppedStale: number;
  /** Kept posts with a missing/invalid timestamp (counted separately). */
  missingTimestamp: number;
}

/**
 * Code-side recency filter. Drops posts older than the cutoff; posts with a
 * missing or invalid timestamp are KEPT but counted separately, so bad data
 * never silently deletes evidence. This is the safety net for the documented
 * pinned-post leak in apify~instagram-scraper and for niche scrapes, whose
 * actor has no date filter at all.
 */
export function filterPostsByCutoff<T extends { timestamp?: unknown }>(
  posts: T[],
  cutoff: string,
): CutoffFilterResult<T> {
  const cutoffMs = new Date(`${cutoff}T00:00:00Z`).getTime();
  const kept: T[] = [];
  let droppedStale = 0;
  let missingTimestamp = 0;
  for (const p of posts) {
    const t = new Date(p.timestamp as any).getTime();
    if (!Number.isFinite(t)) {
      missingTimestamp++;
      kept.push(p);
    } else if (t >= cutoffMs) {
      kept.push(p);
    } else {
      droppedStale++;
    }
  }
  return { kept, droppedStale, missingTimestamp };
}
