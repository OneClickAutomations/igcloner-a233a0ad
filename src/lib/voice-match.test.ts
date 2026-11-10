import { describe, expect, it } from 'vitest';
import { matchSourceVoice } from './voice-match';

describe('source voice matching', () => {
  it('matches an older woman commercial to Matilda', () => {
    expect(matchSourceVoice({ evidence: { video: { audio: { description: 'An older woman speaking warmly in a commercial' } } } }).voice.name).toBe('Matilda');
  });
  it('matches a young energetic female speaker to Jessica', () => {
    expect(matchSourceVoice({ audio_observations: { speaker: 'young female, energetic' } }).voice.name).toBe('Jessica');
  });
  it('prioritizes the narrator over a visible female performer', () => {
    expect(matchSourceVoice({ evidence: { video: { audio: { description: 'Calm male narrator' }, shots: [{ onScreen: 'Young woman demonstrating a product' }] } } }).voice.name).toBe('Eric');
  });
  it('uses a neutral voice without recorded speaker details', () => {
    expect(matchSourceVoice({}).voice.name).toBe('River');
  });
});