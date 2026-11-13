import { describe, expect, it } from 'vitest';
import { assertAnimationReady, buildScenePrompts, missingActionObjects, priceFromWorkspaceCost, splitCachedObservations, stripIdentity } from './inspiration';
import { buildMotionPrompt, PHYSICAL_NEGATIVES } from './video-motion';
const draft = { environment: 'a new garden table', action: 'a hand pours from the open bottle into the cup', endState: 'cup half full, bottle upright', camera: 'one slow push-in', audio: 'pouring and birds', duration: 8 as const, objects: [{ name: 'cup', state: 'empty beside bottle' }, { name: 'open bottle', state: 'cap on table; hand gripping bottle' }] };
describe('inspiration scene rules', () => {
  it('puts cup, open bottle and hand state into every still including edited prompts', () => {
    const p = buildScenePrompts({ ...draft, stillPrompt: 'Garden table.' });
    expect(p.stillPrompt).toContain('cup: empty beside bottle');
    expect(p.stillPrompt).toContain('open bottle: cap on table; hand gripping bottle');
  });
  it('does not claim an unverified cup is visibly present', () => {
    expect(missingActionObjects(draft.objects, [{ ...draft.objects[0], present: null }])).toHaveLength(2);
  });
  it('rejects a motion referencing a cup not in the initial still objects', () => {
    expect(() => buildScenePrompts({ ...draft, objects: [draft.objects[1]] })).toThrow('cup');
  });
  it('strips physical identity and named likeness from edited prompts', () => {
    const s = stripIdentity('A blonde woman with blue eyes and fair skin, looks like Mel Robbins. Pour water.');
    expect(s).not.toMatch(/blonde|blue eyes|fair skin|Mel Robbins|woman/i);
    expect(s).toContain('Pour water');
  });
  it('invalidates approval after an edit', () => {
    expect(() => assertAnimationReady({ still_path: 'still.png', approved_at: 'now', revision: 2, approved_revision: 1, object_checks: draft.objects.map(o => ({ ...o, present: true })), action_objects: draft.objects })).toThrow('Approve');
  });
  it('requires all objects even with a current approval', () => {
    expect(() => assertAnimationReady({ still_path: 'still.png', approved_at: 'now', revision: 1, approved_revision: 1, object_checks: [], action_objects: draft.objects })).toThrow('objects');
  });
  it('enforces the standing physical constraints', () => {
    const p = buildMotionPrompt({ action: draft.action, endState: draft.endState, camera: draft.camera, audio: draft.audio, speed: 'normal speed', durationSeconds: 8 });
    expect(p).toContain('Opaque objects stay opaque'); expect(PHYSICAL_NEGATIVES).toContain('teleporting');
  });
  it('keeps final pricing unset without verified conversion', () => expect(priceFromWorkspaceCost(3.2, null)).toBeNull());
  it('uses 0.145 dollars per credit and a 35 percent ceiling', () => {
    expect(priceFromWorkspaceCost(3.2, 0.25)).toBe(16);
    expect(16 * 0.145 * 0.35).toBeGreaterThanOrEqual(0.8);
  });
  it('does not invent unknown visual fields or audio from visual pass', () => {
    const s = splitCachedObservations({ video: { shots: [{ start: 0, end: 8, onScreen: 'pour', camera: 'pan' }] } }, 'Hello', []);
    expect(s.visual[0].subject).toBeNull(); expect(s.visual[0].duration).toBe(8); expect(s.audio.spokenWords).toBe('Hello'); expect(s.addedWorkspaceCredits).toBe(0);
  });
});