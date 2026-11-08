import { describe,it,expect } from 'vitest';
import { STUDIO_PRICING,priceWorkspace,priceUsd,monthlyCreditEquivalent,videoCostSummary } from './studio-pricing';
describe('owner-verified studio pricing',()=>{
 it('records both receipt conversions exactly',()=>{expect(STUDIO_PRICING.workspaceCreditUsd).toBe(15/50);expect(STUDIO_PRICING.workspaceCreditUsd).toBe(30/100);});
 it.each([[3.2,0.96,19],[1.6,0.48,10],[0.8,0.24,5],[1.629,0.4887,10]])('prices %s workspace credits at 35 percent ceiling',(workspace,usd,credits)=>{const p=priceWorkspace(workspace);expect(p.usd).toBeCloseTo(usd);expect(p.customerCredits).toBe(credits);expect(p.grossMargin).toBeGreaterThanOrEqual(0.65);});
 it('prices four Fast clips at $3.84 and 76 separate clip credits',()=>{const v=videoCostSummary('google/veo-3.1-fast',[8,8,8,8]);expect(v.clips.reduce((n,c)=>n+c.usd,0)).toBeCloseTo(3.84);expect(v.clips.reduce((n,c)=>n+c.customerCredits,0)).toBe(76);expect(v.perActionCredits).toBe(79);expect(v.complete).toBe(false);});
 it('prices four Lite clips and render at 43 separate action credits',()=>{expect(videoCostSummary('google/veo-3.1-lite',[8,8,8,8]).perActionCredits).toBe(43);});
 it('models alternative ceilings without changing the active one',()=>{expect(priceUsd(3.84,0.5).customerCredits).toBe(53);expect(priceUsd(3.84,0.6).customerCredits).toBe(45);expect(STUDIO_PRICING.costCeiling).toBe(0.35);});
 it('uses real allowance in quote wording, not an assumed plan',()=>{expect(monthlyCreditEquivalent(76,200,'This video')).toBe('This video will use 76 of your 200 monthly credits.');expect(monthlyCreditEquivalent(19,null)).toBe('This action will use 19 customer credits.');});
});