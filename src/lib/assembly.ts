import { z } from 'zod';
import { STUDIO_PRICING, videoCreditsForUsd } from './studio-pricing';

export const Caption = z.object({ start: z.number().nonnegative(), end: z.number().positive(), text: z.string().trim().min(1).max(300) });
export const AssemblyOptions = z.object({
  voiceoverPath: z.string().max(500).optional(), voiceoverDuration: z.number().positive().max(240).optional(),
  captions: z.array(Caption).max(200).default([]), musicPath: z.string().max(500).optional(),
  logoPath: z.string().max(500).optional(), logoStart: z.number().nonnegative().default(0), logoEnd: z.number().positive().optional(),
  transition: z.enum(['none', 'fade']).default('none'),
});
export type AssemblySettings = z.infer<typeof AssemblyOptions>;
export type AssemblyClip = { sceneId: string; attemptId: string; path: string; duration: number; revision: number };
export const SHOTSTACK_USD_PER_MINUTE = STUDIO_PRICING.renderUsdPerMinute; // Official PAYG rate checked 2026-11-08.
export const ASSEMBLY_STYLE = { foreground: '#ffffff', background: '#000000', font: 'Open Sans' };
export function renderQuote(seconds: number, environment: 'v1'|'stage' = 'v1') {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 240) throw new Error('Film must be between 0 and 240 seconds.');
  const usd = environment === 'stage' ? 0 : Math.floor(seconds) / 60 * SHOTSTACK_USD_PER_MINUTE;
  return { seconds, rateUsdPerMinute: SHOTSTACK_USD_PER_MINUTE, renderUsd: usd, customerCredits: videoCreditsForUsd(usd), billingBalance:'video' as const, proposed:!STUDIO_PRICING.video.approved, environment };
}
export function assemblyConfigured(key?: string, sandboxKey?: string) { return Boolean(key || sandboxKey); }
export function definitiveRenderRejection(status: number) { return [400,401,402,403,404,422,429].includes(status); }
export function validateCaptions(captions: z.infer<typeof Caption>[], duration: number) {
  let previous = 0;
  for (const c of captions) {
    Caption.parse(c);
    if (c.end <= c.start || c.end > duration || c.start < previous) throw new Error('Captions must be ordered, non-overlapping, and inside the film.');
    previous = c.end;
  }
}
const timestamp = (seconds: number) => {
  const ms = Math.round(seconds * 1000);
  return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;
};
export function captionsToSrt(captions: z.infer<typeof Caption>[], duration: number) {
  validateCaptions(captions,duration);
  return captions.map((c,i) => `${i+1}\n${timestamp(c.start)} --> ${timestamp(c.end)}\n${c.text.replace(/<[^>]*>/g,'')}\n`).join('\n');
}
export function parseSrt(text: string) {
  const time = (t: string) => { const [h,m,s] = t.replace(',','.').split(':').map(Number); return h*3600+m*60+s; };
  return text.replace(/\r/g,'').trim().split(/\n\s*\n/).map(block => {
    const lines = block.split('\n'); if (/^\d+$/.test(lines[0])) lines.shift();
    const match = lines.shift()?.match(/^(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})$/);
    if (!match) throw new Error('Invalid SRT timing.');
    return Caption.parse({ start:time(match[1]),end:time(match[2]),text:lines.join(' ') });
  });
}
export function buildAssemblyTimeline(clips: (AssemblyClip & { url: string })[], settings: AssemblySettings, media: { voiceover?: string; music?: string; logo?: string; captions?: string }) {
  if (!clips.length) throw new Error('No approved clips.');
  const duration = clips.reduce((n,c) => n+c.duration,0); renderQuote(duration); validateCaptions(settings.captions,duration);
  const voiceDuration = settings.voiceoverDuration ?? duration;
  if (media.voiceover && voiceDuration > duration) throw new Error('Voiceover is longer than the film.');
  const tracks: { clips: Record<string,unknown>[] }[] = [];
  if (media.captions) tracks.push({ clips:[{ asset:{ type:'rich-caption',src:media.captions,font:{ family:ASSEMBLY_STYLE.font,size:40,color:ASSEMBLY_STYLE.foreground },background:{color:ASSEMBLY_STYLE.background,opacity:0.65,wrap:true,padding:12}},start:0,length:duration,position:'bottom',offset:{x:0,y:0.12},scale:0.9 }] });
  if (media.logo) { const end=settings.logoEnd ?? duration; if (end<=settings.logoStart || end>duration) throw new Error('Logo timing must be inside the film.'); tracks.push({clips:[{asset:{type:'image',src:media.logo},start:settings.logoStart,length:end-settings.logoStart,scale:0.16,position:'topRight',offset:{x:-0.04,y:-0.04}}]}); }
  if (media.voiceover) tracks.push({clips:[{asset:{type:'audio',src:media.voiceover,volume:1},start:0,length:voiceDuration}]});
  if (media.music) {
    // Known voiceover interval drives deterministic ducking; no unverified speech detector.
    const volume = media.voiceover ? [{from:0.12,to:0.12,start:0,length:voiceDuration},...(voiceDuration<duration?[{from:0.12,to:0.35,start:voiceDuration,length:Math.min(0.3,duration-voiceDuration)}]:[])] : 0.35;
    tracks.push({clips:[{asset:{type:'audio',src:media.music,volume,effect:'fadeInFadeOut'},start:0,length:duration}]});
  }
  let start=0;
  tracks.push({clips:clips.map(c => { const clip={asset:{type:'video',src:c.url,volume:0},start,length:c.duration,fit:'contain',...(settings.transition==='fade'?{transition:{in:'fade',out:'fade'}}:{})}; start+=c.duration; return clip; })});
  return {timeline:{background:ASSEMBLY_STYLE.background,tracks},output:{format:'mp4',size:{width:720,height:1280},fps:30}};
}
export function refundAssemblyOnFailure(status: string, billed: number, refundedAt: string|null) { return status==='failed' && billed>0 && !refundedAt; }