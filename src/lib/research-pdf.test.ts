import { it, expect } from "bun:test";
import { buildResearchPdf } from "./research-pdf";
it("exports exactly nine pages with the top ten ideas on page nine",()=>{
  const ideas=Array.from({length:50},(_,i)=>({format:"Reel",hook:`Distinct hook ${i}`,description:`Specific concept ${i}`,virality_score:i}));
  const doc=buildResearchPdf({subject:"blkpaperchasers",mode:"competitor",dna_report:{}},ideas);
  expect(doc.getNumberOfPages()).toBe(9);
  const pages=doc.internal.pages;
  const ninth=pages[9]?.join("\n")??"";
  expect(ninth).toContain("Distinct hook 49");expect(ninth).toContain("Distinct hook 40");expect(ninth).not.toContain("Distinct hook 39");
});