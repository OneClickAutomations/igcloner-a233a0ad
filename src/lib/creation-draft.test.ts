import { describe, expect, it } from 'vitest';
import { EMPTY_CREATION, restoreCreation, resumeStep } from './creation-draft';
describe('creation draft save and resume', () => {
  it('defaults UGC output to speech even for an old music-only source draft',()=>{expect(restoreCreation({format:'reel',production:{hasSpeech:false}}).speechMode).toBe('voiceover');});
  it('preserves an explicit no-talking choice',()=>{expect(restoreCreation(JSON.parse(JSON.stringify({...EMPTY_CREATION,speechMode:'silent'}))).speechMode).toBe('silent');});
  it('restores the saved step and every entered field after serialization', () => {
    const draft = { step: 4, state: { ...EMPTY_CREATION, url: 'https://instagram.com/reel/test', analysisId: 'saved-analysis', format: 'film', title: 'Owner test', brief: 'Keep the bottle blue', goal: 'sales', niche: 'outdoors', tone: 'natural', audience: 'hikers', platforms: ['instagram','tiktok'], projectId: 'saved-film', production: { stillPrompt: 'Blue bottle', narration: 'Keep going.' } } };
    const saved = JSON.parse(JSON.stringify(draft));
    expect(resumeStep(saved.step)).toBe(4);
    expect(restoreCreation(saved.state)).toEqual(draft.state);
  });
  it('keeps step zero and initializes missing draft fields without losing text', () => {
    expect(resumeStep(0)).toBe(0);
    expect(restoreCreation({ brief: 'My entered words' })).toEqual({ ...EMPTY_CREATION, brief: 'My entered words' });
  });
});