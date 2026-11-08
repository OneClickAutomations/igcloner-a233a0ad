import {describe,it,expect} from 'vitest';
import {PROOF_NARRATION,alignmentCaptions,measuredSpeakingRate,narrationWordTarget,narrationFits,mp3Duration} from './film-narration';
import {AssemblyOptions,buildAssemblyTimeline} from './assembly';
describe('faithful owner film',()=>{
 it('derives the 16-second target from the measured voice, adjusted to natural delivery',()=>{const measured=measuredSpeakingRate(PROOF_NARRATION,10.867);expect(measured).toBeCloseTo(41/10.867);expect(narrationWordTarget(16,measured*0.8/1.1)).toBe(42);expect(narrationWordTarget(32,2.7)).toBe(82);});
 it('requires 90–100 percent film coverage',()=>{expect(narrationFits(10.867,16)).toBe(false);expect(narrationFits(14.4,16)).toBe(true);expect(narrationFits(16,16)).toBe(true);expect(narrationFits(16.1,16)).toBe(false);});
 it('measures audio using MP3 frames',()=>{const frame=new Uint8Array(417);frame.set([255,251,144,0]);expect(mp3Duration(frame)).toBeCloseTo(1152/44100);expect(()=>mp3Duration(new Uint8Array(20))).toThrow();});
 it('keeps four original four-second scenes without retiming or holds',()=>{const t=buildAssemblyTimeline(Array.from({length:4},(_,i)=>({sceneId:String(i),attemptId:String(i),path:'p',url:'https://example.com/clip.mp4',duration:4,revision:1})),AssemblyOptions.parse({}),{});expect(t.timeline.tracks[0].clips.map(c=>[c.start,c.length])).toEqual([[0,4],[4,4],[8,4],[12,4]]);expect(t.timeline.tracks[0].clips.some(c=>'speed' in c)).toBe(false);});
 it('uses synthesis timing rather than guessed intervals',()=>{expect(alignmentCaptions({characters:['H','i','.'],character_start_times_seconds:[0.25,0.4,0.5],character_end_times_seconds:[0.4,0.5,0.6]},16)).toEqual([{text:'Hi.',start:0.25,end:0.6}]);});
});import {describe as d2,it as i2,expect as e2} from 'vitest';
d2('narration never blocks',()=>{i2('clips captions past the film instead of throwing',()=>{e2(alignmentCaptions({characters:['H','i','.',' ','Y','o','.'],character_start_times_seconds:[0,0.1,0.2,0.3,15.5,15.8,16.2],character_end_times_seconds:[0.1,0.2,0.3,0.4,15.8,16.2,16.5]},16)).toEqual([{text:'Hi.',start:0,end:0.3},{text:'Yo.',start:15.5,end:16}]);});});
