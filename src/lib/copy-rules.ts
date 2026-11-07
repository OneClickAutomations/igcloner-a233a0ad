import { z } from "zod";
import { PLATFORM_CAPABILITY_MATRIX, type PublishingPlatform } from "./upload-post/shared";

export const COPY_DIMENSIONS = ["specificity", "hookStrength", "voiceFit", "sourceGrounding", "originality", "platformFit", "postReady"] as const;
export const ScoresSchema = z.object(Object.fromEntries(COPY_DIMENSIONS.map(k => [k, z.number().min(1).max(10)])) as Record<typeof COPY_DIMENSIONS[number], z.ZodNumber>);
export type CopyScores = z.infer<typeof ScoresSchema>;
export function qualitySummary(scores: CopyScores) {
  const values = COPY_DIMENSIONS.map(k => scores[k]);
  const average = values.reduce((a,b) => a+b,0) / values.length;
  return { average, minimum: Math.min(...values), pass: average >= 9 && Math.min(...values) >= 8 };
}
/** JSON escaping prevents scraped strings from closing their data boundary. */
export function copyData(label: string, value: unknown) {
  const safe = JSON.stringify(value ?? null).replace(/</g,"\\u003c").replace(/>/g,"\\u003e");
  return `<data_${label}>${safe}</data_${label}>`;
}
export const tokens = (s: string):string[] => Array.from(s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
export function tokenOverlap(a: string, b: string) {
  const aa = new Set(tokens(a)), bb = new Set(tokens(b));
  return aa.size && bb.size ? [...aa].filter(t => bb.has(t)).length / Math.min(aa.size, bb.size) : 0;
}
export function copiesSource(candidate: string, source: string) { return !!source.trim() && tokenOverlap(candidate, source) > 0.4; }
export function bannedHook(s: string) { return /are you ready|in today['’]?s video/i.test(s); }
export const HookSchema = z.object({
  id: z.number().int(), mechanism: z.string(), sourceForm: z.enum(["onScreen", "spoken", "caption", "carousel"]),
  onScreen: z.string(), spoken: z.string(), caption: z.string(), carousel: z.string(),
  bestUse: z.string(), researchPattern: z.string(),
});
export type HookCandidate = z.infer<typeof HookSchema>;
export function hookText(h: HookCandidate) { return h[h.sourceForm]; }
export function validHookForms(h: HookCandidate) {
  return tokens(h.onScreen).length <= 8 && tokens(h.carousel).length <= 9 && h.caption.length <= 125 &&
    h.spoken.split(/[.!?]+/).filter(s => s.trim()).length <= 2 && [h.onScreen,h.spoken,h.caption,h.carousel].every(s=>s.trim() && !bannedHook(s));
}
export function dedupeHooks(hooks: HookCandidate[]) {
  return hooks.filter((h,i,a) => !a.slice(0,i).some(other => tokenOverlap(hookText(h),hookText(other)) >= 0.75));
}
export const HookRankSchema = z.object({ id: z.number(), scores: z.object({ specificity:z.number().min(1).max(10), tension:z.number().min(1).max(10), firstThreeWords:z.number().min(1).max(10), voiceFit:z.number().min(1).max(10), novelty:z.number().min(1).max(10), platformFit:z.number().min(1).max(10) }), reason: z.string() });
export function rankHooks(hooks: HookCandidate[], ranks: z.infer<typeof HookRankSchema>[]) {
  const ranked = hooks.flatMap(h => { const r=ranks.find(r=>r.id===h.id); if(!r) return []; const v=Object.values(r.scores); return [{...h,...r,totalScore:v.reduce((a,b)=>a+b,0)/v.length,text:hookText(h),type:h.mechanism,why:r.reason}]; });
  return dedupeHooks(ranked.sort((a,b)=>b.totalScore-a.totalScore)).map(h=>ranked.find(r=>r.id===h.id)).filter((h):h is typeof ranked[number]=>!!h).slice(0,10);
}
export const CaptionSchema = z.object({ platform:z.string(), title:z.string().default(""), hook:z.string(), caption:z.string(), description:z.string(), hashtags:z.array(z.string()), cta:z.string(), altText:z.string(), platformFitNotes:z.string() });
export type NativeCaption = z.infer<typeof CaptionSchema>;
export function renderedCaption(c: NativeCaption) { return [c.caption,c.hashtags.map(h=>`#${h.replace(/^#/,"")}`).join(" ")].filter(Boolean).join("\n\n"); }
export function captionIssues(c: NativeCaption): string[] {
  const cap = PLATFORM_CAPABILITY_MATRIX[c.platform as PublishingPlatform];
  if(!cap) return ["Unknown platform"];
  const issues:string[]=[];
  const limit=cap.captionAimChars ?? cap.maxCaptionChars;
  const text = cap.maxDescriptionChars ? [c.description,c.hashtags.map(h=>`#${h.replace(/^#/,"")}`).join(" ")].filter(Boolean).join("\n\n") : renderedCaption(c);
  if(limit && text.length>limit) issues.push(`Caption including hashtags exceeds ${limit} characters (${text.length})`);
  if(cap.maxTitleChars && c.title.length>cap.maxTitleChars) issues.push(`Title exceeds ${cap.maxTitleChars}`);
  if(cap.maxDescriptionChars && text.length>cap.maxDescriptionChars) issues.push(`Description exceeds ${cap.maxDescriptionChars}`);
  if(cap.visibleChars && c.hook.length>cap.visibleChars) issues.push(`Opening hook exceeds visible ${cap.visibleChars} characters`);
  if(c.hashtags.length < (cap.minHashtags ?? 0) || c.hashtags.length > (cap.maxHashtags ?? 30)) issues.push("Hashtag count outside platform range");
  if(!c.caption.trim()) issues.push("Caption is empty");
  return issues;
}
export function compactCopyContext(analysis:any, profile:any={}, preferences:any={}, reports:any[]=[], platform?:string) {
  const dna=analysis?.dna_analysis ?? {}, bp=analysis?.blueprint ?? dna.blueprint ?? null;
  const niche=preferences.niche ?? profile.default_niche ?? dna.contentCategory ?? "general";
  const terms=tokens(`${niche} ${preferences.subject ?? ""}`);
  const research=reports.find(r=>r.status==="ready" && tokens(r.subject??"").some(t=>terms.includes(t)));
  const rd=research?.dna_report ?? {}, analytics=rd.analytics ?? rd;
  return {
    source:{ exactHook:dna.hookBreakdown?.exactText ?? "", hookMechanism:dna.hookBreakdown?.mechanism ?? dna.hookBreakdown?.type ?? "", hookLocation:dna.hookBreakdown?.location ?? "caption", caption:analysis?.source_caption ?? bp?.caption?.exact ?? analysis?.scraped_data?.caption ?? "", captionDNA:dna.captionDNA ?? {}, blueprint:bp, transcript:analysis?.transcript ?? bp?.audio?.transcriptFull ?? "", performance:{likes:analysis?.scraped_data?.likesCount ?? null,comments:analysis?.scraped_data?.commentsCount ?? null,views:analysis?.scraped_data?.videoViewCount ?? null,score:dna.performanceScore ?? null}, legacyStructure:bp ? null : dna.storyStructure ?? null },
    voice:{niche,name:profile.full_name,language:preferences.default_language ?? profile.language, audience:preferences.targetAudience ?? dna.targetAudience?.who ?? "",tone:preferences.toneOfVoice ?? preferences.default_caption_style ?? "natural, specific",keywords:preferences.keywords ?? [],branding:preferences.branding ?? null},
    research:research ? {id:research.id,subject:research.subject,hookStats:analytics.hookStats ?? rd.hookStats ?? null,winningHooks:rd.winningHookPatterns ?? rd.hookPatterns ?? null,formats:analytics.formatStats ?? rd.formatStats ?? null,outliers:(analytics.outlierPosts ?? rd.outliers ?? []).slice(0,3)} : null,
    platform:platform ?? null,
  };
}