import {describe,it,expect} from 'vitest';
import {observedVideoChanges,videoChangeBrief} from './video-changes';
const source={evidence:{video:{shots:[{onScreen:'A woman wearing black activewear performs a backflip in a gym.'}],audio:{energy:'high'}}}};
describe('observed remake changes',()=>{
  it('reads the actual backflip, gym and clothing without inventing age',()=>{const rows=observedVideoChanges(source);expect(rows.find(r=>r.key==='clothing')?.source).toBe('wearing black activewear');expect(rows.find(r=>r.key==='action')?.source).toContain('backflip');expect(rows.find(r=>r.key==='setting')?.source).toContain('gym');expect(rows.find(r=>r.key==='person')?.source).not.toContain('20s');});
  it('keeps unspecified attributes and uses user changes in generation',()=>{const rows=observedVideoChanges(source);const brief=videoChangeBrief(rows,{setting:'Clean studio'});expect(brief).toContain('Setting: Clean studio');expect(brief).toContain('actual identity from reference pixels');expect(brief).toContain('Action: backflip');});
  it('has a filled proposal and choices for every row even if evidence is missing',()=>{expect(observedVideoChanges({}).every(r=>r.source.length>0&&r.recommended.length>0&&r.options.length>1)).toBe(true);});
});