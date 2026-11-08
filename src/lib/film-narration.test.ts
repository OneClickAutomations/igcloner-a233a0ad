import {describe,it,expect} from 'vitest';
import {PROOF_NARRATION,alignmentCaptions} from './film-narration';
import {AssemblyOptions,buildAssemblyTimeline} from './assembly';
describe('faithful owner film',()=>{
 it('uses 38–45 spoken words',()=>{expect(PROOF_NARRATION.split(/\s+/).length).toBeGreaterThanOrEqual(38);expect(PROOF_NARRATION.split(/\s+/).length).toBeLessThanOrEqual(45);});
 it('keeps four original four-second scenes without retiming or holds',()=>{const t=buildAssemblyTimeline(Array.from({length:4},(_,i)=>({sceneId:String(i),attemptId:String(i),path:'p',url:'https://example.com/clip.mp4',duration:4,revision:1})),AssemblyOptions.parse({}),{});expect(t.timeline.tracks[0].clips.map(c=>[c.start,c.length])).toEqual([[0,4],[4,4],[8,4],[12,4]]);expect(t.timeline.tracks[0].clips.some(c=>'speed' in c)).toBe(false);});
 it('uses synthesis timing rather than guessed intervals',()=>{expect(alignmentCaptions({characters:['H','i','.'],character_start_times_seconds:[0.25,0.4,0.5],character_end_times_seconds:[0.4,0.5,0.6]},16)).toEqual([{text:'Hi.',start:0.25,end:0.6}]);});
});