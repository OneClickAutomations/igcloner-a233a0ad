import { describe, expect, it } from 'vitest';
import { buildMotionPrompt, PHYSICAL_REALISM, PHYSICAL_NEGATIVES, realismGuidance, VIDEO_MOTION_CANDIDATE, type MotionPromptInput } from './video-motion';

const POUR_MOTION_FIXTURE: MotionPromptInput = {
  action: 'A hand grips the product, removes its cap, then tilts the open bottle downward over a cup placed beside it. Water visibly streams from the bottle into the cup, filling the cup halfway by the end.',
  endState: 'the bottle is upright beside the half-filled cup',
  camera: 'slow push-in',
  speed: 'normal speed',
  audio: 'water pouring and outdoor ambience',
  durationSeconds: 8,
};

describe('video motion contract', () => {
  it('prevents the barbell passing through the neck', () => {
    expect(realismGuidance('athlete lifts a barbell')).toContain('never through the neck, head or torso');
    expect(realismGuidance('athlete lifts a barbell')).toContain('front shoulders, not inside the throat');
  });
  it('requires credible weight without inventing a measured load', () => {
    expect(realismGuidance('barbell clean and press')).toContain('never invent a numerical load');
    expect(realismGuidance('barbell clean and press')).toContain('gradual acceleration');
  });
  it('preserves skin shade and pigmentation from the beginning', () => {
    expect(PHYSICAL_REALISM).toContain('preserve approved skin shade and pigmentation from frame one');
    expect(PHYSICAL_NEGATIVES).toContain('unintended skin-tone drift');
  });
  it('limits creative exceptions to explicitly requested effects', () => {
    expect(PHYSICAL_REALISM).toContain('apply that exception only to the requested effect');
  });
  it('does not invent lifting instructions in unrelated actions', () => {
    expect(realismGuidance('a person walks')).not.toContain('Barbell contact and load:');
  });
  it('retains the deliberate action and observable end state', () => {
    const prompt = buildMotionPrompt(POUR_MOTION_FIXTURE);
    expect(prompt).toContain('tilts the open bottle downward');
    expect(prompt).toContain('Water visibly streams');
    expect(prompt).toContain('By the end of 8 seconds: the bottle is upright beside the half-filled cup');
    expect(prompt).toContain('normal speed');
    expect(prompt).toContain('Camera: slow push-in');
  });
  it('rejects a scene with no specified subject action', () => {
    expect(() => buildMotionPrompt({ ...POUR_MOTION_FIXTURE, action: ' ' })).toThrow();
  });
  it('production realism text has no bottle, water or cup fixture text', () => {
    expect(PHYSICAL_REALISM).not.toMatch(/bottle|water|cup|cap\b/i);
  });
  it('does not mark the flawed feasibility winner as production approved', () => {
    expect(VIDEO_MOTION_CANDIDATE.productionApproved).toBe(false);
    expect(VIDEO_MOTION_CANDIDATE.durationSeconds).toBe(8);
  });
});