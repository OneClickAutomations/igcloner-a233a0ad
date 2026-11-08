import { describe, expect, it } from 'vitest';
import { buildMotionPrompt, POUR_MOTION_FIXTURE, VIDEO_MOTION_CANDIDATE } from './video-motion';

describe('video motion contract', () => {
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
  it('does not mark the flawed feasibility winner as production approved', () => {
    expect(VIDEO_MOTION_CANDIDATE.productionApproved).toBe(false);
    expect(VIDEO_MOTION_CANDIDATE.durationSeconds).toBe(8);
  });
});