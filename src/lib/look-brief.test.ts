import { describe, expect, it } from 'vitest';
import { LookBrief, allowedStudioReference, characterSheetPrompt, sourceLookBrief, textOnlyStillPrompt, continuityStillPath, stillContinuityPrompt } from './look-brief';
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
  it('uses the first generated still for the second scene rather than its mismatched still', () => {
    const first = { id: 'first', scene_order: 0, still_path: 'owner/project/first.png', scene_input: { referenceIds: [] } };
    const second = { id: 'second', scene_order: 1, still_path: 'owner/project/second.png', scene_input: { referenceIds: [] } };
    expect(continuityStillPath(second, [second, first], 'owner')).toBe(first.still_path);
  });
  it('reuses the opening still for its ending frame or regeneration', () => {
    const scene = { id: 'first', scene_order: 0, still_path: 'owner/project/first.png' };
    expect(continuityStillPath(scene, [scene], 'owner')).toBe(scene.still_path);
  });
  it('respects different selected references and excludes other owners', () => {
    const scene = { id: 'second', scene_order: 1, still_path: 'owner/second.png', scene_input: { referenceIds: ['new-character'] } };
    expect(continuityStillPath(scene, [{ id: 'first', scene_order: 0, still_path: 'owner/first.png', scene_input: { referenceIds: ['other-character'] } }], 'owner')).toBe(scene.still_path);
    expect(continuityStillPath({ ...scene, still_path: 'other/second.png' }, [], 'owner')).toBeNull();
  });
  it('preserves hair and outfit while allowing explicit owner edits', () => {
    expect(stillContinuityPrompt(1)).toContain('hair length and hairstyle');
    expect(stillContinuityPrompt(1)).toContain('exact outfit cut, colour, trim');
    expect(stillContinuityPrompt(1)).toContain('Explicit latest owner appearance changes');
  });
});