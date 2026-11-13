import { PLATFORM_CAPABILITY_MATRIX, type PublishingPlatform } from './upload-post/shared';
import { publishingLimit, tagList, type PlatformCopy } from './content-library';

export type CopyField = keyof PlatformCopy;
export function cardLimit(platform: PublishingPlatform, field: CopyField) {
  const caps = PLATFORM_CAPABILITY_MATRIX[platform];
  return field === 'title' ? caps.maxTitleChars : field === 'hashtags' ? caps.maxHashtags : field === 'description' ? caps.maxDescriptionChars ?? publishingLimit(platform, 'video') : publishingLimit(platform, 'video');
}
export function fitCard(platform: PublishingPlatform, field: CopyField, text: string) {
  const limit = cardLimit(platform, field);
  if (field === 'hashtags') return tagList(text).slice(0, limit ?? undefined).map(t => `#${t}`).join(' ');
  return limit ? text.slice(0, limit) : text;
}
export function deliveryStatus(status: string) {
  return ['published','success','posted'].includes(status) ? 'Posted' : status === 'failed' ? 'Failed' : ['processing','uploading'].includes(status) ? 'Posting' : 'Queued';
}
export function failureFix(code: string, message: string) {
  const text = `${code} ${message}`;
  if (/expired|token|connect|auth/i.test(text)) return { label:'Reconnect', message:'This account needs to be connected again.' };
  if (/length|long|size|large|limit|invalid|reject/i.test(text)) return { label:'Edit', message:'The platform rejected the content. Review its copy and video limits.' };
  return { label:'Retry', message: message || 'The platform could not publish this post. Try again.' };
}