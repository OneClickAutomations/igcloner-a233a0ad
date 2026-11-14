import { describe, expect, it } from 'vitest';
import { durationScenes, remakeClipCredits, referenceKinds, sourceAudioProposal } from './video-remake';
describe('simplified video rules', () => {
  it('preselects voiceover for spoken source words', () => expect(sourceAudioProposal({transcript:'Do the reps',evidence:{video:{audio:{kind:'voice',description:'Spoken advice with no background music'}}}}).speechMode).toBe('voiceover'));
  it('preselects original instrumental for a vocal song, not voiceover lyrics', () => expect(sourceAudioProposal({transcript:'song words',evidence:{video:{audio:{kind:'music',description:'Male vocals singing a hip-hop track'}}}})).toMatchObject({speechMode:'silent',background:'instrumental'}));
  it('preselects instrumental for background music',()=>expect(sourceAudioProposal({evidence:{video:{audio:{kind:'music',description:'Electronic music'}}}}).background).toBe('instrumental'));
  it('preselects ambience for motor and wind',()=>expect(sourceAudioProposal({evidence:{video:{audio:{kind:'ambient',description:'Boat motor and wind'}}}}).background).toBe('ambience'));
  it('keeps both references for both, none for AI design',()=>{expect(referenceKinds('both')).toContain('product');expect(referenceKinds('both')).toContain('character_face');expect(referenceKinds('design-both')).toEqual([]);});
  it('updates Fast duration cost from 20 to 22 and Lite uses half',()=>{expect(remakeClipCredits(20,'google/veo-3.1-fast')).toBe(20);expect(remakeClipCredits(22,'google/veo-3.1-fast')).toBe(22);expect(remakeClipCredits(20,'google/veo-3.1-lite')).toBe(10);});
  it('keeps supported scene durations and sensible 8–60s bounds',()=>{expect(durationScenes(8)).toEqual([8]);expect(durationScenes(60).reduce((a,b)=>a+b,0)).toBe(60);expect(durationScenes(22)).toEqual([8,8,6]);});
});import { defaultRemakeFormat, QUICK_REEL_SECONDS } from './video-remake';
describe('remake format', () => {
  it('picks Quick Reel for sources of 10s or less', () => { expect(defaultRemakeFormat(9)).toBe('quick'); expect(defaultRemakeFormat(10)).toBe('quick'); });
  it('picks storyboard for longer or unknown sources', () => { expect(defaultRemakeFormat(11)).toBe('storyboard'); expect(defaultRemakeFormat(null)).toBe('storyboard'); });
  it('Quick Reel is one 8s clip costing 8 Fast credits', () => { expect(durationScenes(QUICK_REEL_SECONDS)).toEqual([8]); expect(remakeClipCredits(QUICK_REEL_SECONDS,'google/veo-3.1-fast')).toBe(8); });
});
