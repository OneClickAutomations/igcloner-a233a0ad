import { describe, expect, it } from 'vitest';
import { estimatePercent } from './generation-jobs';

// Progress rings must read "33%" or "34%", never "33.33333333%".
describe('estimatePercent', () => {
  it('rounds a third-of-three stage to a whole percent', () => {
    expect(estimatePercent(0, 90, 100 / 3)).toBe(33);
  });

  it('rounds two-of-three stages up', () => {
    expect(estimatePercent(0, 90, 200 / 3)).toBe(67);
  });

  it('always returns a whole number, even while creeping past the estimate', () => {
    const p = estimatePercent(240, 90, 100 / 3);
    expect(Number.isInteger(p)).toBe(true);
    expect(p).toBeLessThanOrEqual(99);
  });

  it('clamps a noisy real value to 99 while the job is still running', () => {
    expect(estimatePercent(10, 90, 99.6)).toBe(99);
  });
});
