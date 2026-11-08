import { describe, it, expect } from "vitest";
import { bestQualityRound, qualityReport } from "./copy-rules";
const sc=(n:number)=>({specificity:n,hookStrength:n,voiceFit:n,sourceGrounding:n,originality:n,platformFit:n,postReady:n});
describe("quality gate informs, never withholds",()=>{
  it("returns the best below-threshold output instead of throwing",()=>{
    const r=bestQualityRound([{output:"a",items:[{scores:sc(7)}],pass:false},{output:"b",items:[{scores:sc(8.1)}],pass:false},{output:"c",items:[{scores:sc(7.5)}],pass:false}]);
    expect(r.output).toBe("b");
    expect(r.report).toMatchObject({score:8.1,passed:false,level:"soft"});
    expect(r.report.note).toContain("8.1");
  });
  it("prefers a passing round",()=>{
    expect(bestQualityRound([{output:"x",items:[{scores:sc(9.2)}],pass:true},{output:"y",items:[{scores:sc(9.5)}],pass:false}]).output).toBe("x");
  });
  it("very low scores are still returned with a prominent note",()=>{
    const r=bestQualityRound([{output:"weak",items:[{scores:sc(4)}],pass:false}]);
    expect(r.output).toBe("weak"); expect(r.report.level).toBe("low");
  });
  it("no note when it passes",()=>{ expect(qualityReport(9.3,8,true).note).toBeNull(); });
});
