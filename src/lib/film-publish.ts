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

// Conservative preparation guidelines, not account-specific API guarantees.
export const VIDEO_PREPARATION: Partial<Record<PublishingPlatform,{seconds?:number;aspect?:string;mb?:number}>> = {
  instagram:{seconds:180,aspect:'9:16'},tiktok:{seconds:600,aspect:'9:16'},youtube:{aspect:'9:16'},x:{seconds:140},linkedin:{seconds:900},bluesky:{seconds:180},discord:{mb:10},telegram:{mb:50},
};
export function videoWarnings(platform:PublishingPlatform,info:{duration:number;width:number;height:number;bytes?:number}) {
  const guide=VIDEO_PREPARATION[platform],warnings:string[]=[];
  if(guide?.seconds&&info.duration>guide.seconds)warnings.push(`Preparation guideline: ${guide.seconds} seconds; your video is ${Math.round(info.duration)} seconds. Account limits may differ.`);
  if(guide?.aspect&&Math.abs(info.width/info.height-9/16)>.05)warnings.push(`Recommended vertical aspect: ${guide.aspect}; your video is ${info.width} × ${info.height}.`);
  if(guide?.mb&&info.bytes&&info.bytes>guide.mb*1024*1024)warnings.push(`Conservative file-size guideline: ${guide.mb} MB; your file is ${(info.bytes/1024/1024).toFixed(1)} MB. Account limits may differ.`);
  return warnings;
}