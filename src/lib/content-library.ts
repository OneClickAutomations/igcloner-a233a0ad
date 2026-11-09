import { captionLimitFor, mediaKindForContentType, type ContentType, type PublishingPlatform } from './upload-post/shared';

export type PlatformCopy = { caption: string; description: string; hashtags: string; title: string };
export const HASHTAG_GUIDANCE: Record<string, string> = { instagram: '5–12', tiktok: '3–5', x: '0–2', linkedin: '3–5' };
export function tagList(text: string) { return text.split(/[\s,]+/).map(t => t.replace(/^#+/, '')).filter(Boolean); }
export function finalCaption(platform: string, copy: PlatformCopy, link: string) {
  const body = platform === 'youtube' || platform === 'pinterest' ? copy.description : copy.caption;
  const parts = [body.trim()];
  if (link && platform !== 'instagram' && !body.includes(link)) parts.push(link);
  const tags = tagList(copy.hashtags);
  if (tags.length) parts.push(tags.map(t => `#${t}`).join(' '));
  return parts.filter(Boolean).join('\n\n');
}
export function publishingLimit(platform: PublishingPlatform, type: ContentType) { return captionLimitFor(platform, mediaKindForContentType(type)); }
export function libraryStatus(project: any, job?: any) {
  if (job?.status === 'published' || job?.status === 'partially_published') return 'Posted';
  if (job?.status === 'scheduled') return 'Scheduled';
  return project.media?.length || ['complete', 'completed', 'exported'].includes(project.status) ? 'Ready' : 'Draft';
}