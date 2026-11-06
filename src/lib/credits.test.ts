import { describe, it, expect } from "vitest";
import {
  PLANS,
  ACTION_COSTS,
  REASON_LABELS,
  InsufficientCreditsError,
  parseInsufficientCredits,
  INSUFFICIENT_CREDITS_PREFIX,
} from "@/lib/credits";

describe("plan config", () => {
  it("defines the agreed credit allowances", () => {
    expect(PLANS.trial.credits).toBe(40);
    expect(PLANS.trial.monthly).toBe(false);
    expect(PLANS.creator.credits).toBe(200);
    expect(PLANS.pro.credits).toBe(600);
    expect(PLANS.agency.credits).toBe(1600);
  });
});

describe("action costs", () => {
  it("matches the agreed cost table", () => {
    expect(ACTION_COSTS.report).toBe(10);
    expect(ACTION_COSTS.ideas).toBe(5);
    expect(ACTION_COSTS.premium).toBe(20);
    expect(ACTION_COSTS.retry).toBe(5);
    expect(ACTION_COSTS.cacheHit).toBe(0);
    expect(ACTION_COSTS.watchlistRefresh).toBe(10);
  });

  it("defines the content-creation costs for this and later passes", () => {
    expect(ACTION_COSTS.analysis).toBe(3);
    expect(ACTION_COSTS.textEdit).toBe(2);
    expect(ACTION_COSTS.videoGenerationVeo3Fast).toBe(15);
    expect(ACTION_COSTS.videoGenerationVeo3OrKling).toBe(25);
    expect(ACTION_COSTS.imageGeneration).toBe(1);
    expect(ACTION_COSTS.hookLab).toBe(2);
    expect(ACTION_COSTS.captionPack).toBe(1);
  });
});

describe("reason labels", () => {
  it("covers every ledger reason with plain language", () => {
    for (const reason of [
      "plan_grant",
      "topup",
      "debit_report",
      "debit_ideas",
      "debit_premium",
      "debit_retry",
      "debit_analysis",
      "refund_failed",
      "trial_grant",
    ] as const) {
      expect(REASON_LABELS[reason]).toBeTruthy();
      expect(REASON_LABELS[reason]).not.toBe(reason);
    }
  });
});

describe("insufficient-credits error contract", () => {
  it("round-trips required/available through the serialized message", () => {
    const err = new InsufficientCreditsError({ required: 10, available: 3 });
    expect(err.message.startsWith(INSUFFICIENT_CREDITS_PREFIX)).toBe(true);
    // Simulates crossing the RPC boundary: only the message survives.
    const reparsed = parseInsufficientCredits(new Error(err.message));
    expect(reparsed).toEqual({ required: 10, available: 3 });
  });

  it("parses when the payload is embedded in a longer message", () => {
    const wrapped = new Error(`Server error: ${INSUFFICIENT_CREDITS_PREFIX}{"required":5,"available":0}`);
    expect(parseInsufficientCredits(wrapped)).toEqual({ required: 5, available: 0 });
  });

  it("returns null for ordinary errors", () => {
    expect(parseInsufficientCredits(new Error("Apify failed (500)"))).toBeNull();
    expect(parseInsufficientCredits("random string")).toBeNull();
    expect(parseInsufficientCredits(null)).toBeNull();
    expect(parseInsufficientCredits(undefined)).toBeNull();
  });
});
