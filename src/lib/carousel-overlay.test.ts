import {describe,it,expect} from "vitest";
import {wrapOverlayText} from "./carousel-overlay";
import {compareText} from "./clone-rules";
describe("exact carousel overlay",()=>{
  it("ignores punctuation/case/spacing but never spelling",()=>{expect(compareText("Don't wait. Publish!","DONT  WAIT publish").verdict).toBe("exact");expect(compareText("Publish your draft","Publsh your draft").verdict).not.toBe("exact");});
  it("wraps exact words without truncating",()=>{const lines=wrapOverlayText("Write a draft\nPublish it today",s=>s.length,12);expect(lines).toEqual(["Write a","draft","Publish it","today"]);expect(lines.join(" ")).toBe("Write a draft Publish it today");});
  it("rejects clipping a long word",()=>expect(()=>wrapOverlayText("unbreakable",s=>s.length,5)).toThrow("too long"));
});