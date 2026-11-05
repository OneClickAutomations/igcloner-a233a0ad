import { describe, it, expect } from "vitest";
import { assertSampleSurvivedFiltering, EmptyAfterFilterError, isStaleInFlight } from "./research-invariants";

describe("empty-after-filter guard", () => {
  it("fails when posts came back but filtering ate all of them", () => {
    expect(() => assertSampleSurvivedFiltering(20, 0)).toThrow(EmptyAfterFilterError);
  });
  it("allows the genuine profile-only case (actor returned nothing)", () => {
    expect(() => assertSampleSurvivedFiltering(0, 0)).not.toThrow();
  });
  it("allows a normal filtered sample", () => {
    expect(() => assertSampleSurvivedFiltering(20, 3)).not.toThrow();
  });
});

describe("stale in-flight thresholds", () => {
  const now = new Date("2026-11-05T12:00:00Z");
  const ago = (m: number) => new Date(now.getTime() - m * 60_000);
  it("scraping is stale after 10 minutes, not at 10", () => {
    expect(isStaleInFlight("scraping", ago(10), now)).toBe(false);
    expect(isStaleInFlight("scraping", ago(10.1), now)).toBe(true);
  });
  it("analyzing is stale after 15 minutes, not at 14", () => {
    expect(isStaleInFlight("analyzing", ago(14), now)).toBe(false);
    expect(isStaleInFlight("analyzing", ago(15.1), now)).toBe(true);
  });
  it("finished reports are never stale", () => {
    expect(isStaleInFlight("ready", ago(10_000), now)).toBe(false);
    expect(isStaleInFlight("failed", ago(10_000), now)).toBe(false);
  });
});
