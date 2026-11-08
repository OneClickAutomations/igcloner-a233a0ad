import { describe,it,expect } from 'vitest';
import { AssemblyOptions, assemblyConfigured, buildAssemblyTimeline, captionsToSrt, parseSrt, renderQuote, refundAssemblyOnFailure, validateCaptions } from './assembly';
const clips=Array.from({length:4},(_,i)=>({sceneId:`s${i}`,attemptId:`a${i}`,path:`p${i}`,revision:1,duration:8,url:`https://media.example/${i}.mp4`}));
describe('hosted assembly',()=>{
 it('orders four 8-second clips and forces portrait MP4',()=>{const t=buildAssemblyTimeline(clips,AssemblyOptions.parse({}),{});expect(t.timeline.tracks[0].clips.map(c=>c.start)).toEqual([0,8,16,24]);expect(t.output).toEqual({format:'mp4',size:{width:720,height:1280},fps:30});});
 it('adds render cost at the 35% ceiling',()=>{const q=renderQuote(32);expect(q.renderUsd).toBeCloseTo(0.1066666667);expect(q.customerCredits).toBe(3);expect(renderQuote(32,'stage').customerCredits).toBe(0);});
 it('keeps missing-key rendering unavailable',()=>{expect(assemblyConfigured()).toBe(false);expect(assemblyConfigured(undefined,'sandbox')).toBe(true);});
 it('preserves caption milliseconds through SRT',()=>{const c=[{start:1.125,end:3.5,text:'Approved words'}];expect(parseSrt(captionsToSrt(c,32))).toEqual(c);});
 it('rejects overlapping and out-of-film captions',()=>{expect(()=>validateCaptions([{start:0,end:4,text:'one'},{start:3,end:5,text:'two'}],32)).toThrow();expect(()=>validateCaptions([{start:30,end:33,text:'one'}],32)).toThrow();});
 it('ducks music for supplied voiceover duration',()=>{const t=buildAssemblyTimeline(clips,AssemblyOptions.parse({voiceoverDuration:20}),{voiceover:'v',music:'m'});expect((t.timeline.tracks[1].clips[0].asset as any).volume[0]).toEqual({from:0.12,to:0.12,start:0,length:20});});
 it('rejects voiceover or logo beyond film',()=>{expect(()=>buildAssemblyTimeline(clips,AssemblyOptions.parse({voiceoverDuration:33}),{voiceover:'v'})).toThrow();expect(()=>buildAssemblyTimeline(clips,AssemblyOptions.parse({logoEnd:34}),{logo:'l'})).toThrow();});
 it('refunds a failed charged attempt once, never completed clips',()=>{expect(refundAssemblyOnFailure('failed',3,null)).toBe(true);expect(refundAssemblyOnFailure('failed',3,'date')).toBe(false);expect(refundAssemblyOnFailure('completed',3,null)).toBe(false);});
});