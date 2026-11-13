import { describe,expect,it } from 'vitest';
import { prefillRemixScenes,startingDirections,RemixDirections,REMIX_IDEAS_COST } from './remix-directions';
import { initialState,nextEvidenceStage } from './analysis-pipeline.server';
const source={evidence:{video:{shots:[{start:0,end:3,onScreen:'A real named presenter speaks',camera:'static'},{start:3,end:9,onScreen:'Presenter demonstrates',camera:'pan'}]}}};
describe('verified analysis and remix handoff',()=>{
  it('requires a separate verification stage before synthesis',()=>{
    const state={...initialState({}),slidesDone:true,videoPass1:{shots:[],durationSec:8,averageShotLengthSec:8,hookWindow:'',audio:{kind:'voice',energy:'medium',description:''},ctaFrame:'',hasSpeech:true}};
    expect(nextEvidenceStage('Reel',{storedMedia:[{kind:'video'}]},state)).toBe('verifying_video');
    expect(nextEvidenceStage('Reel',{}, {...state,videoDone:true})).toBe('building_blueprint');
  });
  it('accepts three or four directions but not two or five',()=>{
    const d=startingDirections(source);expect(RemixDirections.safeParse({directions:d.slice(0,3)}).success).toBe(true);expect(RemixDirections.safeParse({directions:d}).success).toBe(true);expect(RemixDirections.safeParse({directions:d.slice(0,2)}).success).toBe(false);expect(RemixDirections.safeParse({directions:[...d,d[0]]}).success).toBe(false);
  });
  it('prefills exactly one scene per source shot with new subjects and settings',()=>{
    const scenes=prefillRemixScenes(source,startingDirections(source)[0],'',[],'voiceover');expect(scenes).toHaveLength(2);expect(scenes.map(s=>s.duration)).toEqual([4,6]);expect(scenes[0].environment).toBe('A bright workshop');expect(scenes[0].action).not.toContain('real named presenter');expect(scenes[0].sourceStart).toBe(0);expect(scenes[0].sourceEnd).toBe(3);
  });
  it('carries custom instructions and selected image identities into every prompt',()=>{
    const id='00000000-0000-4000-8000-000000000001';const scenes=prefillRemixScenes(source,startingDirections(source)[0],'Use a pottery workshop and a clay bowl; make the message about daily practice.',[id],'silent');expect(scenes[0].environment).toBe('pottery workshop');expect(scenes[0].objects.some(o=>o.name==='clay bowl')).toBe(true);expect(scenes[0].referenceIds).toEqual([id]);expect(scenes[0].voiceover).toBe('');expect(scenes[0].motionPrompt).toContain('daily practice');
  });
  it('shows a one-plan-credit ideas cost independently from free prefill',()=>expect(REMIX_IDEAS_COST).toBe(1));
});