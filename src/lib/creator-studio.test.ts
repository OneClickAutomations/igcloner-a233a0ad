import { describe, it, expect } from 'vitest';
import { shortlist, dnaSummary, studioImagePrompt, type StudioIdea } from './creator-studio';

const idea = (group: StudioIdea['group'], title: string): StudioIdea => ({ group, title, angle: '', visual: title, hook: 'Hook', reaction: '', why: '', format: 'image' });

describe('creator studio', () => {
  it('shows three ideas first, recommended idea on top', () => {
    const ideas = [idea('engagement', 'a'), idea('engagement', 'b'), idea('bold', 'c'), idea('fresh', 'd')];
    const s = shortlist(ideas, 2);
    expect(s).toHaveLength(3);
    expect(s[0]?.title).toBe('c');
  });
  it('summary uses only saved analysis fields', () => {
    expect(dnaSummary({})).toEqual({ worked: [], improve: [], opportunity: '' });
    expect(dnaSummary({ whyItWorks: ['x', 'y', 'z', 'w'] }).worked).toHaveLength(3);
  });
  it('edit direction keeps unselected elements and asks for exact text', () => {
    const p = studioImagePrompt({ direction: 'edit', idea: idea('bold', 't'), change: ['Text'], newText: 'Hello', textOnImage: true }, true);
    expect(p).toContain('Change only: Text');
    expect(p).toContain('"Hello"');
  });
  it('no text requested means no text in image', () => {
    expect(studioImagePrompt({ direction: 'remix', idea: idea('fresh', 't'), textOnImage: false }, false)).toContain('No text');
  });
});
