import {describe,it,expect} from 'vitest';
import {STUDIO_PRICING,videoCreditsForWorkspace,videoCreditsForUsd,videoBalanceQuote,videoPackMargin} from './studio-pricing';
import {ACTION_COSTS} from './credits';
describe('approved separate video add-on prices',()=>{
 it('records owner approval without enabling purchases',()=>{expect(STUDIO_PRICING.video.approved).toBe(true);expect(STUDIO_PRICING.video.purchasesEnabled).toBe(false);});
 it.each([['trial',40,15],['standard',160,49],['bulk',400,109]])('locks the approved %s pack',(id,credits,usd)=>{const pack=STUDIO_PRICING.video.packs.find(p=>p.id===id);expect(pack?.credits).toBe(credits);expect(pack?.usd).toBe(usd);});
 it('makes one video credit one measured Fast second',()=>{expect(videoCreditsForWorkspace(3.2)).toBe(8);expect(videoCreditsForWorkspace(1.6)).toBe(4);});
 it('makes Lite half the video credits per second',()=>{expect(videoCreditsForWorkspace(0.8)).toBe(2);expect(videoCreditsForWorkspace(8*0.2)).toBe(4);});
 it('quotes a 32-second Fast film plus render separately from plan credits',()=>{const clips=4*videoCreditsForWorkspace(3.2);const render=videoCreditsForUsd(32/60*0.20);expect(clips).toBe(32);expect(render).toBe(1);expect(videoBalanceQuote(clips+render,160,32).remaining).toBe(127);});
 it('never permits an insufficient video quote',()=>{expect(videoBalanceQuote(8,0,8).sufficient).toBe(false);expect(videoBalanceQuote(8,7,8).remaining).toBe(0);expect(videoBalanceQuote(8,8,8).sufficient).toBe(true);});
 it('leaves plan analysis/hooks/captions/images and Sharpen prices alone',()=>{expect(ACTION_COSTS.analysis).toBe(3);expect(ACTION_COSTS.hookLab).toBe(2);expect(ACTION_COSTS.captionPack).toBe(1);expect(ACTION_COSTS.imageGeneration).toBe(1);expect(ACTION_COSTS.sharpen).toBe(2);});
 it.each([[0,0.68],[1,1-19.2/49],[2,1-48/109]])('calculates pack %s direct margin',(index,margin)=>{expect(videoPackMargin(STUDIO_PRICING.video.packs[index]).grossMargin).toBeCloseTo(margin);});
 it('charges 1 video credit per narration',()=>{expect(STUDIO_PRICING.video.narrationCredits).toBe(1);});
});