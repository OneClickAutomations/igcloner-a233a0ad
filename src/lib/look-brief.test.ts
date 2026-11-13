import { describe, expect, it } from 'vitest';
import { LookBrief, allowedStudioReference, characterSheetPrompt, sourceLookBrief, textOnlyStillPrompt } from './look-brief';
import { stripIdentity } from './inspiration';
import { prefillRemixScenes, faithfulDirection } from './remix-directions';

const brief = LookBrief.parse({ skinTone: 'deep brown', pigmentation: 'visible light pigmentation patches', hair: 'stylish blond dreadlocks', build: 'muscular curvy build', outfit: 'red bikini', openingPose: 'standing with arms raised', environment: 'dark industrial gym, plain wall and one door' });
const source = { evidence: { video: { shots: [{ start: 0, end: 8, action: 'presses the barbell', openingPose: brief.openingPose, lookBriefs: [brief], setting: brief.environment }] }, remakeRefs: { keyframes: [{ path: 'owner/source/keyframes/a.jpg', pos: 'first', shot: 0 }] } } };
describe('text-only look matching', () => {
  it('preserves skin shade, pigmentation, hair, build and outfit', () => {
    const text = stripIdentity('deep brown skin; visible light pigmentation patches; blond dreadlocks; muscular curvy build; red bikini');
    for (const value of ['deep brown skin','pigmentation patches','blond dreadlocks','muscular curvy build','red bikini']) expect(text).toContain(value);
  });
  it('removes named likeness, race and facial descriptions', () => {
    const text = stripIdentity('Looks like Jane Smith. Asian ethnicity. Oval face shape. Deep brown skin.');
    expect(text).not.toMatch(/Jane Smith|Asian|ethnicity|oval face/i);
    expect(text).toContain('Deep brown skin');
  });
  it('keeps verified opening pose instead of inventing a deadlift pose', () => {
    const scene = prefillRemixScenes(source, faithfulDirection(source), '', [], 'silent')[0];
    const prompt = textOnlyStillPrompt({ scene_input: scene, action_objects: scene.objects }, brief, '', 'first');
    expect(prompt).toContain('standing with arms raised');
    expect(prompt).not.toMatch(/hips hinged|deadlift|skeleton|source\/keyframes/);
  });
  it('rejects source bucket paths as generation references', () => {
    expect(allowedStudioReference('owner/source/keyframes/a.jpg','owner')).toBe(false);
    expect(allowedStudioReference('owner/character-sheets/one/body.jpg','owner')).toBe(true);
    expect(allowedStudioReference('other/references/a.jpg','owner')).toBe(false);
  });
  it('generates all three views from text and applies owner styling changes', () => {
    const prompt = characterSheetPrompt(brief, 'add a cowboy hat');
    expect(prompt).toContain('front-facing head-and-shoulders');
    expect(prompt).toContain('full-body back view');
    expect(prompt).toContain('add a cowboy hat');
    expect(prompt).toContain('different, original facial features');
  });
  it('reads verified look rather than older inaccurate style', () => {
    expect(sourceLookBrief({ evidence: { ...source.evidence, remakeRefs: { appearance: { skinTone: 'light' } } } }).skinTone).toBe('deep brown');
  });
});