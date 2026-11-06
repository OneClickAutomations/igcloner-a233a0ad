import { describe, expect, it } from "vitest";
import { pickVideoRendition } from "./analysis-pipeline.server";

const MB = 1024 * 1024;
describe("video rendition choice", () => {
  it("uses HD when it fits", () => {
    expect(pickVideoRendition([{ index: 0, kind: "video", path: "hd", bytes: 20 * MB }]).pick?.path).toBe("hd");
  });
  it("falls back to the SD copy when HD is over 40MB", () => {
    const r = pickVideoRendition([{ index: 0, kind: "video", path: "hd", bytes: 60 * MB, variant: "hd" }, { index: 0, kind: "video", path: "sd", bytes: 12 * MB, variant: "sd" }]);
    expect(r.pick?.path).toBe("sd");
  });
  it("reports too big when nothing fits", () => {
    const r = pickVideoRendition([{ index: 0, kind: "video", path: "hd", bytes: 60 * MB }]);
    expect(r.pick).toBeNull();
    expect(r.tooBig?.path).toBe("hd");
  });
});
