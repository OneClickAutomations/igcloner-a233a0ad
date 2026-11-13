import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { sourceShots } from './remix-directions';
import { keyframePlan, Appearance, type KeyframeRef } from './keyframes';

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
    const frames = (((a.evidence as any)?.remakeRefs?.keyframes ?? []) as KeyframeRef[]).slice(0, 6);
    if (!frames.length) throw new Error('Extract the source keyframes first.');
    const key = process.env['LOVABLE_API_KEY']; if (!key) throw new Error('AI connection is not configured.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { toBase64, VIDEO_OBSERVATION_MODEL } = await import('./analysis-ai.server');
    const images = await Promise.all(frames.map(async f => { const { data: b } = await supabaseAdmin.storage.from(BUCKET).download(f.path); if (!b) throw new Error('A keyframe is missing; extract again.'); return `data:image/jpeg;base64,${toBase64(new Uint8Array(await b.arrayBuffer()))}`; }));
    const prompt = `Describe the visual STYLE of the main person in these video frames so a casting team can cast a DIFFERENT, original person with a similar look. Record only: skinTone (broad family, e.g. "dark brown"), build (physique), hair (colour, length, style), outfit (garment types, colours, cut), accessories, footwear ("barefoot" if so), vibe (overall energy). NEVER include names, identity guesses, facial features or face shape, age guesses, or distinctive personal marks (birthmarks, scars, tattoos, skin-condition patterns, piercings unique to them). Write "unclear" when not visible. Return JSON only: {"skinTone":"","build":"","hair":"","outfit":"","accessories":"","footwear":"","vibe":""}`;
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Lovable-AIG-SDK': 'fetch' },
      body: JSON.stringify({ model: VIDEO_OBSERVATION_MODEL, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, ...images.map(url => ({ type: 'image_url', image_url: { url } }))] }] }) });
    const body = await res.json().catch(() => null) as any;
    if (!res.ok) throw new Error(body?.message ?? body?.error?.message ?? `Appearance pass failed (${res.status}).`);
    const { extractJson } = await import('./json-extract');
    const parsed = Appearance.safeParse(extractJson(String(body?.choices?.[0]?.message?.content ?? '')));
    if (!parsed.success) throw new Error('The appearance pass returned no usable fields. Fill them in by hand.');
    await writeRefs(data.analysisId, r => ({ ...r, appearance: parsed.data, appearanceUsage: body?.usage ?? null }));
    return { appearance: parsed.data, charged: 0 };
  });
