// Pure, browser-safe pipeline invariants for research reports.

/** Heartbeat thresholds; must match public.sweep_stale_research_reports. */
export const STALE_AFTER_MINUTES = { scraping: 10, analyzing: 15 } as const;

export function isStaleInFlight(status: string, lastProgressAt: string | Date, now: Date = new Date()): boolean {
  const limit = (STALE_AFTER_MINUTES as Record<string, number>)[status];
  if (limit == null) return false;
  return now.getTime() - new Date(lastProgressAt).getTime() > limit * 60_000;
}

export const EMPTY_AFTER_FILTER_MESSAGE =
  "Posts were collected but every one was discarded during filtering, so there was nothing to analyze. This is a bug on our side — your credits were refunded.";

export class EmptyAfterFilterError extends Error {
  constructor(public scraped: number) {
    super(EMPTY_AFTER_FILTER_MESSAGE);
    this.name = "EmptyAfterFilterError";
  }
}

/**
 * If the actor returned usable posts but filtering left zero, that is a bug,
 * not a result. A genuine zero from the actor (profile-only) passes through.
 */
export function assertSampleSurvivedFiltering(scrapedUsable: number, kept: number): void {
  if (scrapedUsable > 0 && kept === 0) throw new EmptyAfterFilterError(scrapedUsable);
}
