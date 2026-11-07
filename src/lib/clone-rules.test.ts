import { describe, expect, it } from "vitest";
import {
  RIGHTS_STATEMENT_VERSION, assertRightsConfirmed, requiresRights, modeAvailability, compareText, gateCheck,
  nextGateAction, pickBestAttempt, slidesToRegenerate, openAiSizeFor,
} from "@/lib/clone-rules";
import { CLONE_LABEL, CLONE_METHODS, cloneModeLabel } from "@/lib/clone-modes";

const A = "11111111-1111-1111-1111-111111111111";

describe("rights enforcement", () => {
  it("A0 and A1 need rights; A2 and A3 do not", () => {
    expect([requiresRights("A0"), requiresRights("A1"), requiresRights("A2"), requiresRights("A3")]).toEqual([true, true, false, false]);
  });
  it("rejects A1 without a confirmation", () => {
    expect(() => assertRightsConfirmed("A1", A, [])).toThrow(/RIGHTS_REQUIRED/);
  });
  it("rejects a confirmation for a different mode or old statement", () => {
    expect(() => assertRightsConfirmed("A0", A, [{ analysis_id: A, mode: "A1", statement_version: RIGHTS_STATEMENT_VERSION }])).toThrow();
    expect(() => assertRightsConfirmed("A0", A, [{ analysis_id: A, mode: "A0", statement_version: "old" }])).toThrow();
  });
  it("accepts with a matching confirmation", () => {
    expect(() => assertRightsConfirmed("A0", A, [{ analysis_id: A, mode: "A0", statement_version: RIGHTS_STATEMENT_VERSION }])).not.toThrow();
  });
  it("A2 passes without any confirmation", () => {
    expect(() => assertRightsConfirmed("A2", null, [])).not.toThrow();
  });
});

describe("text-match gate", () => {
  it("exact after whitespace/case normalization", () => {
    expect(compareText("AI\nRENDERED", "ai rendered").verdict).toBe("exact");
  });
  it("near miss fails the gate", () => {
    const r = compareText("LAUNCH DAY", "LAUNCH DAI");
    expect(r.verdict).toBe("near");
    expect(gateCheck("LAUNCH DAY", { observedText: "LAUNCH DAI", residualOriginalText: [], sameComposition: true, compositionNote: "" }).pass).toBe(false);
  });
  it("miss", () => {
    expect(compareText("NEW WORDS", "GENERATED CONTENT").verdict).toBe("miss");
  });
  it("residual original text fails even when the new text is exact", () => {
    const g = gateCheck("AI", { observedText: "AI", residualOriginalText: ["CONTENT"], sameComposition: true, compositionNote: "" });
    expect(g.pass).toBe(false);
  });
});

describe("retry / refund decision", () => {
  const fail = gateCheck("A", { observedText: "B", residualOriginalText: [], sameComposition: true, compositionNote: "" });
  const pass = gateCheck("A", { observedText: "a", residualOriginalText: [], sameComposition: true, compositionNote: "" });
  it("retries free up to 2 times then flags (refund)", () => {
    expect([nextGateAction(0, fail), nextGateAction(1, fail), nextGateAction(2, fail)]).toEqual(["retry", "retry", "flag"]);
  });
  it("accepts on pass", () => { expect(nextGateAction(0, pass)).toBe("accept"); });
  it("picks the attempt with fewest problems", () => {
    expect(pickBestAttempt([{ gate: fail, id: 1 }, { gate: pass, id: 2 }]).id).toBe(2);
  });
  it("only slides with text and changed text are regenerated", () => {
    expect(slidesToRegenerate([{ index: 0, exactText: "HI" }, { index: 1, exactText: "" }, { index: 2, exactText: "SAME" }], { 0: "YO", 1: "x", 2: "same" })).toEqual([0]);
  });
});

describe("availability", () => {
  it("A0 disabled when only the thumbnail exists", () => {
    const r = modeAvailability("A0", { postType: "Image", storedMedia: [], expectedSlides: 1, slidesWithText: 0 });
    expect(r.available).toBe(false);
    expect(r.reason).toMatch(/Only the thumbnail/);
  });
  it("A0 disabled when carousel slides are missing", () => {
    expect(modeAvailability("A0", { postType: "Carousel", storedMedia: [{ index: 0, kind: "image", path: "p" }], expectedSlides: 6, slidesWithText: 0 }).reason).toMatch(/1 of 6/);
  });
  it("A0 available for a saved reel", () => {
    expect(modeAvailability("A0", { postType: "Reel", storedMedia: [{ index: 0, kind: "video", path: "v" }], expectedSlides: 0, slidesWithText: 0 }).available).toBe(true);
  });
  it("A2 always available", () => {
    expect(modeAvailability("A2", { postType: "Image", storedMedia: [], expectedSlides: 1, slidesWithText: 0 }).available).toBe(true);
  });
});

describe("mode labels", () => {
  it("final labels and order", () => {
    expect(CLONE_METHODS.map((m) => m.id)).toEqual(["A0", "A1", "A2", "A3"]);
    expect(CLONE_LABEL).toEqual({ A0: "Exact copy", A1: "Same look, new words", A2: "New look, same idea", A3: "Remix the message" });
    expect(Object.values(CLONE_LABEL)).not.toContain("Steal the Frame");
    expect(cloneModeLabel("A0")).toBe("Exact copy");
  });
});

describe("sizing", () => {
  it("keeps the NASA 1680x960 aspect exactly", () => { expect(openAiSizeFor(1680, 960)).toBe("1680x960"); });
});
