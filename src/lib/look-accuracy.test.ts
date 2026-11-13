import { describe, it, expect } from 'vitest';
import { skinBand, consensusAppearance, lookLock, coveredOutfit } from './keyframes';
describe('look accuracy', () => {
  it('maps deep brown to the deep band, above medium', () => { expect(skinBand('deep brown')).toBe(5); expect(skinBand('medium brown')).toBe(3); expect(skinBand('medium-deep')).toBe(4); });
  it('consensus keeps the majority band and ties go deeper', () => {
    expect(skinBand(consensusAppearance([{ skinTone: 'deep' }, { skinTone: 'deep' }, { skinTone: 'medium' }]).skinTone)).toBe(5);
    expect(skinBand(consensusAppearance([{ skinTone: 'medium' }, { skinTone: 'deep' }]).skinTone)).toBe(5);
  });
  it('lock says do not lighten', () => { expect(lookLock({ skinTone: 'deep brown', undertone: 'warm', build: 'muscular' })).toMatch(/deep brown skin with a warm undertone.*do not lighten/); });
  it('covered outfit keeps the source colour', () => { expect(coveredOutfit({ outfit: 'white two-piece', coveredOutfit: 'unclear' })).toMatch(/white sports bra.*white.*bike shorts/); });
});
