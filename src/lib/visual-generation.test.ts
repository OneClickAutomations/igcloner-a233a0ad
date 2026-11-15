import { describe, expect, it } from 'vitest';
import { sourceFramePath, visualAnchor, visualStillPrompt, visualMotionPrompt } from './visual-generation';
import { LookBrief } from './look-brief';
import { faithfulScene } from './faithful-remake';

const brief = LookBrief.parse({});
const scene = { revision: 2, scene_input: { faithful: true, sourceShotIndex: 1, remakeAction: 'The dog leaps over a stream', action: 'An athletic woman leaps', openingPose: 'dog crouched at the bank', endState: 'dog lands on the opposite bank', camera: 'locked wide shot', environment: 'woodland stream', audio: 'splash and birds' }, action_objects: [{ name: 'dog', state: 'crouched' }] };
describe('visual-first generation', () => {
  it('uses the target shot ending frame, not an unrelated frame', () => {
    const frames = [{ shot: 0, pos: 'last', path: 'owner/other.jpg' }, { shot: 1, pos: 'first', path: 'owner/start.jpg' }, { shot: 1, pos: 'last', path: 'owner/end.jpg' }];
    expect(sourceFramePath(scene, frames, 'owner', 'last')).toBe('owner/end.jpg');
    expect(sourceFramePath(scene, frames.slice(0, 1), 'owner', 'last')).toBeNull();
  });
  it('rejects source references outside the current owner', () => {
    expect(sourceFramePath(scene, [{ shot: 1, pos: 'first', path: 'other/a.jpg' }], 'owner', 'first')).toBeNull();
  });
  it('retains the dog action instead of generated human casting', () => {
    expect(visualAnchor(scene).action).toBe('The dog leaps over a stream');
    expect(visualMotionPrompt(scene)).toContain('The dog leaps over a stream');
    expect(visualMotionPrompt(scene)).not.toContain('athletic woman');
  });
  it.each(['dog','cat','airplane','vehicle','water','alien'])('keeps %s without a human default', subject => {
    const s = faithfulScene({ action: `${subject} moves across the scene`, subjects: [{ type: subject }], setting: 'outdoors' }, { hasCharacterRef: false, duration: 8, speech: 'silent' });
    expect(s.remakePerson).not.toMatch(/athlete|adult/);
    expect(s.objects[0].name).toBe(subject);
  });
  it('retains visual proportions and assigns continuity to the correct image', () => {
    const prompt = visualStillPrompt(scene, brief, [{ kind: 'source', image: 1 }, { kind: 'continuity', image: 2 }], 'first');
    expect(prompt).toContain('Retain subject type, scale, proportions');
    expect(prompt).toContain('Image 2: keep this generated subject');
    expect(prompt).not.toContain('Written look brief');
    expect(prompt.split(/\s+/).length).toBeLessThan(150);
  });
  it('preserves explicit red outfit and blonde hair changes from review', () => {
    const edited = { ...scene, review_history: [{ revision: 2, instruction: 'red bikini and blonde dreadlocks' }] };
    expect(visualStillPrompt(edited, brief, [{ kind:'source', image:1 }], 'first')).toContain('red bikini and blonde dreadlocks');
  });
  it('does not reuse stale review instructions', () => {
    const edited = { ...scene, review_history: [{ revision: 1, instruction: 'turn the dog purple' }] };
    expect(visualStillPrompt(edited, brief, [{ kind:'source', image:1 }], 'first')).not.toContain('purple');
  });
  it('keeps a deliberate custom motion prompt', () => {
    expect(visualMotionPrompt({ ...scene, motion_prompt:'The dog pauses before jumping; track left.' })).toContain('pauses before jumping');
  });
  it('keeps ordered action, endpoint and stable appearance without physics essays', () => {
    const prompt = visualMotionPrompt(scene, 'obsolete athlete prompt', 8);
    expect(prompt).toContain('dog lands on the opposite bank');
    expect(prompt).toContain('stable from frame one');
    expect(prompt.split(/\s+/).length).toBeLessThan(100);
  });
});
import { exactClonePrompt } from './visual-generation';
describe('exact clone still prompt', () => {
  it('keeps the original subjects and applies only owner changes', () => {
    const p = exactClonePrompt({ revision: 1, scene_input: { ownerInstructions: 'red bikini' } }, [{ kind: 'source', image: 1 }], 'first');
    expect(p).toMatch(/same people/);
    expect(p).not.toMatch(/different facial features/);
    expect(p).toMatch(/Change only this: red bikini/);
  });
});
