// ─────────────────────────────────────────────────────────────────────
// Credit metering — single source of truth for plans, action costs, and
// the insufficient-credits error contract. No magic numbers elsewhere.
// Plan assignment is manual/config-only in this pass; Stripe is NOT wired.
// ─────────────────────────────────────────────────────────────────────

export const PLANS = {
  trial: { label: "Trial", credits: 40, monthly: false },
  creator: { label: "Creator", credits: 200, monthly: true },
  pro: { label: "Pro", credits: 600, monthly: true },
  agency: { label: "Agency", credits: 1600, monthly: true },
} as const;

export type PlanId = keyof typeof PLANS;

export const ACTION_COSTS = {
  /** Research report (scrape + DNA analysis) */
  report: 10,
  /** 25 content ideas (one batch; replace or append) */
  ideas: 5,
  /** Premium depth add-on (comments + peer benchmark) */
  premium: 20,
  /** Retry analysis (reuses existing raw_data, no scrape) */
  retry: 5,
  /** Re-run same subject within the 12h cache window */
  cacheHit: 0,
  /** Weekly auto-refresh of a watched competitor */
  watchlistRefresh: 10,
  /** Content analysis of one Instagram/Facebook post (scrape + DNA) */
  analysis: 3,
  /** AI text edit of a generated asset */
  textEdit: 2,
  /** Video generation with Veo 3 Fast */
  videoGenerationVeo3Fast: 15,
  /** Video generation with Veo 3 or Kling */
  videoGenerationVeo3OrKling: 25,
  /** Image generation */
  imageGeneration: 1,
  /** Hook Lab batch */
  hookLab: 2,
  /** Caption pack */
  captionPack: 1,
  sharpen: 2,
} as const;

export type LedgerReason =
  | "plan_grant"
  | "topup"
  | "debit_report"
  | "debit_ideas"
  | "debit_premium"
  | "debit_retry"
  | "debit_analysis"
  | "debit_versions"
  | "debit_image"
  | "debit_hooks"
  | "debit_caption"
  | "debit_sharpen"
  | "refund_failed"
  | "trial_grant";

/** Plain-language labels for the ledger history UI. */
export const REASON_LABELS: Record<LedgerReason, string> = {
  plan_grant: "Monthly plan credits",
  topup: "Credit top-up",
  debit_report: "Research report",
  debit_ideas: "25 content ideas",
  debit_premium: "Premium depth add-on",
  debit_retry: "Retry analysis",
  debit_analysis: "Post analysis",
  debit_versions: "5 post versions",
  debit_image: "Image edit or generation",
  debit_hooks: "Hook Lab — 10 ranked hooks",
  debit_caption: "Platform caption pack",
  debit_sharpen: "Sharpen copy",
  refund_failed: "Refund — action failed",
  trial_grant: "Trial credits",
};

// ── Insufficient-credits error contract ──────────────────────────────
// Custom Error subclasses lose their prototype across the server-function
// RPC boundary, so the payload travels in the message with a stable prefix
// and is parsed back client-side with parseInsufficientCredits().

export const INSUFFICIENT_CREDITS_PREFIX = "INSUFFICIENT_CREDITS:";

export interface InsufficientCreditsInfo {
  required: number;
  available: number;
}

export class InsufficientCreditsError extends Error {
  readonly required: number;
  readonly available: number;
  constructor(info: InsufficientCreditsInfo) {
    super(`${INSUFFICIENT_CREDITS_PREFIX}${JSON.stringify(info)}`);
    this.name = "InsufficientCreditsError";
    this.required = info.required;
    this.available = info.available;
  }
}

/** Parse an insufficient-credits error from any thrown value (client- or server-side). */
export function parseInsufficientCredits(err: unknown): InsufficientCreditsInfo | null {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const idx = msg.indexOf(INSUFFICIENT_CREDITS_PREFIX);
  if (idx === -1) return null;
  try {
    const parsed = JSON.parse(msg.slice(idx + INSUFFICIENT_CREDITS_PREFIX.length));
    if (typeof parsed?.required === "number" && typeof parsed?.available === "number") {
      return { required: parsed.required, available: parsed.available };
    }
  } catch {
    // fall through
  }
  return null;
}

/** Query key for the shared credit balance; invalidate after any credit move. */
export const CREDIT_BALANCE_KEY = ["credit-balance"] as const;

/** Measured SDK token totals; USD is an estimate at $3/$15 per million,
 * not a cash bill. Includes failed quality attempts, excludes Apify/media.
 * Prices above are intentionally unchanged. Full cost target NOT met. */
export const COPY_COST_OBSERVATIONS = {
  measuredAt: "2026-11-07",
  hookBaseline: { inputTokens:9436, outputTokens:5927, estimatedUsd:0.117213, workspaceCreditsEstimate:0.312568, seconds:55.656, passed:false },
  hookQualityRun: { inputTokens:103665, outputTokens:22069, estimatedUsd:0.642030, workspaceCreditsEstimate:1.71208, seconds:195.928, calls:13, passed:false },
  captionQualityRun: { inputTokens:48314, outputTokens:7566, estimatedUsd:0.258432, workspaceCreditsEstimate:0.689152, seconds:63.716, calls:7, passed:false },
  carouselCopy: null,
  reelCopy: null,
  sharpen: null,
} as const;
