import { describe, expect, it } from 'vitest';
import { fitFont, wrapLines } from './text-overlay';

const m = (s: string) => s.length * 10;
describe('text overlay layout', () => {
  it('keeps every word, in order, exactly', () => {
    const text = 'Stop scrolling: this one habit changed everything';
    expect(wrapLines(text, 200, m).join(' ')).toBe(text);
  });
  it('wraps to the box width', () => {
    expect(wrapLines('aaaa bbbb cccc', 80, m)).toEqual(['aaaa', 'bbbb', 'cccc']);
  });
  it('shrinks the font until the block fits the height', () => {
    const r = fitFont('one two three four five six', 300, 200, (s, size) => s.length * size * 0.6, 120, 24);
    expect(r.lines.length * r.size * 1.15).toBeLessThanOrEqual(200);
  });
});
