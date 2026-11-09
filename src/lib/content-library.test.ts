import { describe, it, expect } from 'vitest';
import { finalCaption, publishingLimit, libraryStatus, HASHTAG_GUIDANCE } from './content-library';
const copy = { caption: 'Caption', description: 'Description', title: 'Title', hashtags: 'one #two' };
describe('publishing wrap-up', () => {
  it('keeps links out of Instagram captions', () => { expect(finalCaption('instagram', copy, 'https://example.com')).toBe('Caption\n\n#one #two'); });
  it('places one link into YouTube and Pinterest descriptions', () => { for (const p of ['youtube', 'pinterest']) expect(finalCaption(p, copy, 'https://example.com')).toBe('Description\n\nhttps://example.com\n\n#one #two'); });
  it('never silently truncates a caption', () => { expect(finalCaption('x', { ...copy, caption: 'a'.repeat(400), hashtags: '' }, '').length).toBe(400); expect(publishingLimit('x', 'video')).toBe(280); });
  it('uses the requested hashtag guidance', () => { expect(HASHTAG_GUIDANCE).toEqual({ instagram: '5–12', tiktok: '3–5', x: '0–2', linkedin: '3–5' }); });
  it('shows scheduled and posted results over ready media', () => { expect(libraryStatus({ media: [{}] }, { status: 'scheduled' })).toBe('Scheduled'); expect(libraryStatus({ media: [{}] }, { status: 'published' })).toBe('Posted'); expect(libraryStatus({ media: [] })).toBe('Draft'); });
});