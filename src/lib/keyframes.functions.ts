import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { sourceLookBrief, writtenLook, LookBrief } from './look-brief';
import { sourceShots } from './remix-directions';
import { keyframePlan, Appearance, consensusAppearance, skinBand, SKIN_BANDS, type KeyframeRef } from './keyframes';

const STYLE_PROMPT = `Describe the visual STYLE of the main person in this video frame so a casting team can cast a DIFFERENT, original person with the same look. Be precise:
- skinTone: exactly one of ${SKIN_BANDS.map(b => `"${b}"`).join(', ')}. Judge the skin itself under the lighting; do not drift lighter. Dark-brown skin is "deep" or "very deep".
- undertone: "warm", "cool" or "neutral".
- build: concrete physique words (e.g. "muscular, curvy, broad hips, defined arms, thick thighs").
- hair: colour, length, texture, style (e.g. "black, long, coily, pulled back in a high bun").
- outfit: garment types, exact colours, cut and coverage (e.g. "white ribbed two-piece: cropped sleeveless top and high-waist short shorts, midriff exposed").
- coveredOutfit: the closest MORE-COVERED version in the SAME colours (e.g. "white sports bra under a white fitted crop tee and white mid-thigh bike shorts").
- accessories (e.g. "clear-frame glasses"), footwear ("barefoot" if so), vibe (overall energy).
NEVER include names, identity guesses, facial features or face shape, age guesses, or distinctive personal marks (birthmarks, scars, tattoos, skin-condition patterns, unique piercings). Write "unclear" when not visible. Return JSON only: {"skinTone":"","undertone":"","build":"","hair":"","outfit":"","coveredOutfit":"","accessories":"","footwear":"","vibe":""}`;

const LookCheck = z.object({ skinTone: z.string().catch('unclear'), undertone: z.string().catch('unclear'), buildMatches: z.boolean().catch(true), buildNote: z.string().catch(''), hairMatches: z.boolean().catch(true), hairNote: z.string().catch(''), outfitColourMatches: z.boolean().catch(true), outfitNote: z.string().catch(''), poseMatches: z.boolean().catch(true), poseNote: z.string().catch(''), environmentMatches: z.boolean().catch(true), environmentNote: z.string().catch(''), pigmentationMatches: z.boolean().catch(true), pigmentationNote: z.string().catch('') });

/** Plain-English drift list from a look check against the requested style fields. Browser-safe logic kept here for the server fn. */
function driftsFrom(requested: Partial<Appearance>, got: z.infer<typeof LookCheck>, outfitFallback: boolean) {
  const want = skinBand(requested.skinTone), have = skinBand(got.skinTone);
  const drifts: string[] = [];
  if (want >= 0 && have >= 0 && have !== want) drifts.push(`Skin tone came out ${have < want ? 'lighter' : 'darker'} than requested (${SKIN_BANDS[have]} instead of ${SKIN_BANDS[want]}).`);
  if (!got.buildMatches) drifts.push(`Build doesn't match${got.buildNote ? `: ${got.buildNote}` : '.'}`);
  if (!got.hairMatches) drifts.push(`Hair doesn't match${got.hairNote ? `: ${got.hairNote}` : '.'}`);
  if (!got.outfitColourMatches && !outfitFallback) drifts.push(`Outfit colour doesn't match${got.outfitNote ? `: ${got.outfitNote}` : '.'}`);
  if (!got.poseMatches) drifts.push(`Opening pose differs: ${got.poseNote}`);
  if (!got.environmentMatches) drifts.push(`Environment type differs: ${got.environmentNote}`);
  if (!got.pigmentationMatches) drifts.push(`Visible pigmentation differs: ${got.pigmentationNote}`);
  return drifts;
}

/** Included, no charge: vision check against the written brief, never source pixels. Warns only. */
export const checkStillLook = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ sceneId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { data: s } = await context.supabase.from('storyboard_scenes').select('id,project_id,still_path,user_id,scene_input,look_check').eq('id', data.sceneId).eq('user_id', context.userId).single();
    if (!s?.still_path) throw new Error('This scene has no still yet.');
    const { data: p } = await context.supabase.from('video_inspiration_projects').select('analysis_id').eq('id', s.project_id).single();
    const { data: a } = p?.analysis_id ? await context.supabase.from('analyses').select('evidence').eq('id', p.analysis_id).maybeSingle() : { data: null };
    if ((s.look_check as any)?.stillPath === s.still_path && (s.look_check as any)?.checked) return s.look_check as any;
    const { data: sheet } = await context.supabase.from('studio_character_sheets').select('brief,instructions').eq('project_id', s.project_id).eq('status','approved').order('created_at',{ascending:false}).limit(1).maybeSingle();
    const input = (s.scene_input ?? {}) as any;
    const brief = LookBrief.parse(sheet?.brief ?? input.lookBrief ?? sourceLookBrief(a, input.sourceShotIndex ?? 0));
    const requested = { ...brief, undertone: 'unclear' };
    const key = process.env['LOVABLE_API_KEY']; if (!key) throw new Error('AI connection is not configured.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: im } = await supabaseAdmin.storage.from('video-inspiration').download(s.still_path);
    if (!im) throw new Error('Still file missing.');
    const { toBase64, VIDEO_OBSERVATION_MODEL } = await import('./analysis-ai.server');
    const { data: last } = await supabaseAdmin.from('scene_attempts').select('outfit_fallback').eq('scene_id', s.id).eq('operation', 'still').eq('status', 'completed').order('created_at', { ascending: false }).limit(1).maybeSingle();
    const prompt = `Compare this GENERATED still ONLY with the WRITTEN look brief: ${writtenLook(brief)}. Owner styling overrides: ${sheet?.instructions ?? input.ownerInstructions ?? ''}; person ${input.remakePerson ?? ''}; outfit ${input.remakeOutfit ?? ''}. Do not compare with any source image. Judge skin shade, visible pigmentation, build, hair, outfit colour/cut, opening pose and environment TYPE. No face descriptions or demographic inference. Ignore minor variations; flag only clear mismatches. Report skinTone using ${SKIN_BANDS.join(', ')}. JSON only: {"skinTone":"","undertone":"","buildMatches":true,"buildNote":"","hairMatches":true,"hairNote":"","outfitColourMatches":true,"outfitNote":"","poseMatches":true,"poseNote":"","environmentMatches":true,"environmentNote":"","pigmentationMatches":true,"pigmentationNote":""}`;
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Lovable-AIG-SDK': 'fetch' },
      body: JSON.stringify({ model: VIDEO_OBSERVATION_MODEL, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: `data:${im.type || 'image/png'};base64,${toBase64(new Uint8Array(await im.arrayBuffer()))}` } }] }] }) });
    const body = await res.json().catch(() => null) as any;
    if (!res.ok) throw new Error(body?.message ?? `Look check failed (${res.status}).`);
    const { extractJson } = await import('./json-extract');
    const got = LookCheck.safeParse(extractJson(String(body?.choices?.[0]?.message?.content ?? '')));
    if (!got.success) return { checked: false, drifts: [] as string[] };
    const drifts = driftsFrom(requested, got.data, last?.outfit_fallback === true);
    const result = { checked: true, drifts, observed: got.data, stillPath: s.still_path, at: new Date().toISOString() };
    await supabaseAdmin.from('storyboard_scenes').update({ look_check: result } as any).eq('id', s.id);
    return result;
  });

/** Free: saves a correction note the next still prompt leads with. Does not generate anything. */
export const setLookCorrection = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ sceneId: z.string().uuid(), correction: z.string().max(800) }).parse(v))
  .handler(async ({ data, context }) => {
    const { data: s } = await context.supabase.from('storyboard_scenes').select('id').eq('id', data.sceneId).eq('user_id', context.userId).single();
    if (!s) throw new Error('Scene not found.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { error } = await supabaseAdmin.from('storyboard_scenes').update({ look_correction: data.correction } as any).eq('id', s.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const BUCKET = 'source-media';
async function ownedAnalysis(supabase: any, userId: string, id: string) {
  const { data } = await supabase.from('analyses').select('id,user_id,evidence,scraped_data,dna_analysis,blueprint').eq('id', id).eq('user_id', userId).single();
  if (!data) throw new Error('Saved analysis not found.');
  return data;
}

/** Free: signed source video, keyframe plan, saved keyframes and appearance fields. */
export const getSourceKeyframes = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ analysisId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const a = await ownedAnalysis(context.supabase, context.userId, data.analysisId);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const videos = ((a.scraped_data as any)?.storedMedia ?? []).filter((m: any) => m.kind === 'video');
    const video = videos.find((m: any) => m.variant === 'sd') ?? videos[0];
    const videoUrl = video ? (await supabaseAdmin.storage.from(BUCKET).createSignedUrl(video.path, 300)).data?.signedUrl ?? null : null;
    const refs = ((a.evidence as any)?.remakeRefs ?? {}) as { keyframes?: KeyframeRef[]; appearance?: unknown; appearanceUsage?: unknown };
    const keyframes = await Promise.all((refs.keyframes ?? []).map(async k => ({ ...k, preview: (await supabaseAdmin.storage.from(BUCKET).createSignedUrl(k.path, 900)).data?.signedUrl ?? null })));
    return { videoUrl, plan: keyframePlan(sourceShots(a)), keyframes, appearance: refs.appearance ?? null };
  });

async function writeRefs(id: string, update: (r: any) => any) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data } = await supabaseAdmin.from('analyses').select('evidence').eq('id', id).single();
  const evidence = (data?.evidence ?? {}) as any;
  const { error } = await supabaseAdmin.from('analyses').update({ evidence: { ...evidence, remakeRefs: update(evidence.remakeRefs ?? {}) } }).eq('id', id);
  if (error) throw new Error(error.message);
}

/** Free: browser-extracted JPEG keyframe saved privately under the owner's source folder. */
export const saveSourceKeyframe = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ analysisId: z.string().uuid(), shot: z.number().int().min(0).max(100), pos: z.enum(['first', 'mid', 'last']), time: z.number().min(0).max(600), base64: z.string().max(4_000_000) }).parse(v))
  .handler(async ({ data, context }) => {
    await ownedAnalysis(context.supabase, context.userId, data.analysisId);
    const bytes = Uint8Array.from(atob(data.base64), c => c.charCodeAt(0));
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Keyframe must be a JPEG.');
    const path = `${context.userId}/${data.analysisId}/keyframes/shot${data.shot}-${data.pos}.jpg`;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
    if (error) throw new Error(error.message);
    await writeRefs(data.analysisId, r => ({ ...r, keyframes: [...(r.keyframes ?? []).filter((k: KeyframeRef) => !(k.shot === data.shot && k.pos === data.pos)), { shot: data.shot, pos: data.pos, time: data.time, path }] }));
    return { path };
  });

/** Style-only appearance pass over the saved keyframes (no identity). Included free; refusals return a clear message. */
export const analyzeSourceAppearance = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ analysisId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const a = await ownedAnalysis(context.supabase, context.userId, data.analysisId);
    const all = (((a.evidence as any)?.remakeRefs?.keyframes ?? []) as KeyframeRef[]);
    if (!all.length) throw new Error('Extract the source keyframes first.');
    // 2–3 frames spread across the video; each is read on its own and the consistent answer is kept.
    const frames = [all[0], all[Math.floor(all.length / 2)], all[all.length - 1]].filter((f, i, xs) => xs.findIndex(x => x.path === f.path) === i).slice(0, 3);
    const key = process.env['LOVABLE_API_KEY']; if (!key) throw new Error('AI connection is not configured.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { toBase64, VIDEO_OBSERVATION_MODEL } = await import('./analysis-ai.server');
    const { extractJson } = await import('./json-extract');
    const images = await Promise.all(frames.map(async f => { const { data: b } = await supabaseAdmin.storage.from(BUCKET).download(f.path); if (!b) throw new Error('A keyframe is missing; extract again.'); return `data:image/jpeg;base64,${toBase64(new Uint8Array(await b.arrayBuffer()))}`; }));
    const prompt = STYLE_PROMPT;
    const usage: unknown[] = [];
    const reads = await Promise.all(images.map(async url => {
      const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Lovable-AIG-SDK': 'fetch' },
        body: JSON.stringify({ model: VIDEO_OBSERVATION_MODEL, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url } }] }] }) });
      const body = await res.json().catch(() => null) as any;
      if (!res.ok) throw new Error(body?.message ?? body?.error?.message ?? `Appearance pass failed (${res.status}).`);
      usage.push(body?.usage ?? null);
      const r = Appearance.safeParse(extractJson(String(body?.choices?.[0]?.message?.content ?? '')));
      return r.success ? r.data : null;
    }));
    const good = reads.filter(Boolean) as Appearance[];
    if (!good.length) throw new Error('The appearance pass returned no usable fields. Fill them in by hand.');
    const parsed = { data: consensusAppearance(good) };
    const frameReads = good;
    await writeRefs(data.analysisId, r => ({ ...r, appearance: parsed.data, appearanceReads: frameReads, appearanceUsage: usage }));
    return { appearance: parsed.data, charged: 0 };
  });
