import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { ReferenceKind, SceneInput, StudioModel, STUDIO_MODELS, buildScenePrompts, priceFromWorkspaceCost, splitCachedObservations, missingActionObjects, type ObjectCheck } from './inspiration';

const Id = z.string().uuid();
export const getInspirationStudio = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: Id.optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    await supabaseAdmin.rpc('sweep_inspiration_stills', { p_user: userId });
    const { data: projects, error } = await supabase.from('video_inspiration_projects').select('*').order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    const selected = data.projectId ? projects?.find(p => p.id === data.projectId) : projects?.[0];
    if (data.projectId && !selected) throw new Error('Project not found.');
    const { data: references } = await supabase.from('reference_assets').select('*').eq('user_id', userId).order('created_at');
    const { data: analyses } = await supabase.from('analyses').select('id,instagram_url,source_account,post_type').eq('user_id', userId).eq('analysis_status', 'ready').in('post_type', ['Reel', 'Video']).order('created_at', { ascending: false }).limit(50);
    const { data: scenes } = selected ? await supabase.from('storyboard_scenes').select('*').eq('project_id', selected.id).order('scene_order') : { data: [] };
    const { data: attempts } = selected ? await supabase.from('scene_attempts').select('*').eq('project_id', selected.id).order('created_at', { ascending: false }) : { data: [] };
    const { data: assemblies } = selected ? await supabase.from('assembly_jobs').select('id,project_id,status,billed,duration_seconds,environment,render_quote_usd,result_path,failure_reason,refunded_at,created_at').eq('project_id', selected.id).order('created_at', { ascending: false }) : { data: [] };
    const sign = async (path: string | null) => {
      if (!path || !path.startsWith(`${userId}/`)) return null;
      const { data: url } = await supabase.storage.from('video-inspiration').createSignedUrl(path, 3600);
      return url?.signedUrl ?? null;
    };
    const usd = Number(process.env['VIDEO_WORKSPACE_CREDIT_USD']);
    const conversion = Number.isFinite(usd) && usd > 0 ? usd : null;
    const stillCost = Number(process.env['VIDEO_STILL_WORKSPACE_QUOTE']);
    return {
      projects: projects ?? [], selected: selected ?? null, analyses: analyses ?? [],
      references: await Promise.all((references ?? []).map(async r => ({ ...r, preview: await sign(r.storage_path) }))),
      scenes: await Promise.all((scenes ?? []).map(async s => ({ ...s, preview: await sign(s.still_path) }))),
      attempts: await Promise.all((attempts ?? []).map(async a => ({ ...a, preview: await sign(a.result_url) }))),
      assemblies: await Promise.all((assemblies ?? []).map(async a => ({ ...a, preview: await sign(a.result_path) }))),
      assemblyConfigured: Boolean(process.env['SHOTSTACK_API_KEY'] || process.env['SHOTSTACK_SANDBOX_API_KEY']),
      usdPerWorkspaceCredit: conversion, stillWorkspaceQuote: Number.isFinite(stillCost) && stillCost > 0 ? stillCost : null,
    };
  });

export const createInspirationProject = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ title: z.string().trim().min(1).max(100), analysisId: Id.optional() }).parse(d))
  .handler(async ({ data, context }) => {
    let observations = splitCachedObservations(null, null);
    const t0 = Date.now();
    if (data.analysisId) {
      const { data: a } = await context.supabase.from('analyses').select('evidence,transcript,transcript_segments,analysis_status').eq('user_id', context.userId).eq('id', data.analysisId).single();
      if (!a || a.analysis_status !== 'ready') throw new Error('A ready, owned analysis is required.');
      observations = splitCachedObservations(a.evidence, a.transcript, Array.isArray(a.transcript_segments) ? a.transcript_segments : []);
    }
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: p, error } = await supabaseAdmin.from('video_inspiration_projects').insert({ title: data.title, user_id: context.userId, analysis_id: data.analysisId ?? null, visual_observations: observations.visual, audio_observations: observations.audio, observation_notes: [...observations.limitations, `Cached import: 0 added AI credits; ${Date.now() - t0}ms.`] }).select('id').single();
    if (error || !p) throw new Error(error?.message ?? 'Project could not be created.');
    return p;
  });

export const saveInspirationScene = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: Id, sceneId: Id.optional(), scene: SceneInput }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.supabase.from('video_inspiration_projects').select('id').eq('id', data.projectId).single();
    if (!p) throw new Error('Project not found.');
    if (data.sceneId) {
      const { data: old } = await context.supabase.from('storyboard_scenes').select('id').eq('id', data.sceneId).eq('project_id', p.id).single();
      if (!old) throw new Error('Scene not found.');
    }
    const prompts = buildScenePrompts(data.scene);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const values = { project_id: p.id, user_id: context.userId, duration: data.scene.duration, still_prompt: prompts.stillPrompt, motion_prompt: prompts.motionPrompt, action_objects: data.scene.objects, scene_input: data.scene, object_checks: [] };
    if (data.sceneId) {
      const { error } = await supabaseAdmin.from('storyboard_scenes').update({ ...values, approved_at: null, approved_revision: null, status: 'still_ready' }).eq('id', data.sceneId).eq('user_id', context.userId);
      if (error) throw new Error(error.message);
      return { id: data.sceneId };
    }
    const { data: last } = await context.supabase.from('storyboard_scenes').select('scene_order').eq('project_id', p.id).order('scene_order', { ascending: false }).limit(1);
    const { data: s, error } = await supabaseAdmin.from('storyboard_scenes').insert({ ...values, scene_order: (last?.[0]?.scene_order ?? -1) + 1 }).select('id').single();
    if (error || !s) throw new Error(error?.message ?? 'Scene could not be saved.');
    return s;
  });

export const manageInspirationReference = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.discriminatedUnion('action', [
    z.object({ action: z.literal('upload'), kind: ReferenceKind, filename: z.string().max(120), mime: z.enum(['image/jpeg','image/png','image/webp']), base64: z.string().max(14_000_000) }),
    z.object({ action: z.literal('toggle'), id: Id, enabled: z.boolean() }),
    z.object({ action: z.literal('delete'), id: Id }),
  ]).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    if (data.action === 'upload') {
      const raw = atob(data.base64); const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
      if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new Error('Reference must be an image under 10MB.');
      const { imageSize } = await import('./clone-rules');
      if (!imageSize(bytes)) throw new Error('The file is not a readable image.');
      const path = `${context.userId}/references/${crypto.randomUUID()}.${data.mime.split('/')[1]}`;
      const { error: up } = await supabaseAdmin.storage.from('video-inspiration').upload(path, bytes, { contentType: data.mime });
      if (up) throw new Error(up.message);
      const { error } = await supabaseAdmin.from('reference_assets').insert({ user_id: context.userId, kind: data.kind, filename: data.filename, storage_path: path });
      if (error) { await supabaseAdmin.storage.from('video-inspiration').remove([path]); throw new Error(error.message); }
    } else {
      const { data: r } = await context.supabase.from('reference_assets').select('*').eq('id', data.id).single();
      if (!r) throw new Error('Reference not found.');
      if (data.action === 'toggle') {
        const { error } = await supabaseAdmin.from('reference_assets').update({ enabled: data.enabled }).eq('id', r.id); if (error) throw new Error(error.message);
      } else {
        const { error } = await supabaseAdmin.from('reference_assets').delete().eq('id', r.id); if (error) throw new Error(error.message);
        await supabaseAdmin.storage.from('video-inspiration').remove([r.storage_path]);
      }
    }
    return { ok: true };
  });

export const approveInspirationStill = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sceneId: Id, checks: z.array(z.object({ name: z.string(), state: z.string(), present: z.boolean(), reason: z.string().optional() })).max(12) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: s } = await context.supabase.from('storyboard_scenes').select('*').eq('id', data.sceneId).single();
    if (!s?.still_path) throw new Error('Generate a still first.');
    if (missingActionObjects(s.action_objects as any, data.checks).length) throw new Error('Check each action object and its initial state in the still.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: updated, error } = await supabaseAdmin.from('storyboard_scenes').update({ approved_at: new Date().toISOString(), approved_revision: s.revision, object_checks: data.checks, status: 'approved' }).eq('id', s.id).eq('revision', s.revision).select('id').maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error('The scene changed. Review and approve it again.');
    return { ok: true };
  });

export const inspirationQuote = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sceneId: Id, model: StudioModel, operation: z.enum(['still','animate']) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: s } = await context.supabase.from('storyboard_scenes').select('duration,revision').eq('id', data.sceneId).single();
    if (!s) throw new Error('Scene not found.');
    const usd = Number(process.env['VIDEO_WORKSPACE_CREDIT_USD']);
    const conversion = Number.isFinite(usd) && usd > 0 ? usd : null;
    const rate = STUDIO_MODELS.find(m => m.id === data.model)?.rate ?? null;
    const configuredStill = Number(process.env['VIDEO_STILL_WORKSPACE_QUOTE']);
    const cost = data.operation === 'still' ? (Number.isFinite(configuredStill) && configuredStill > 0 ? configuredStill : null) : rate === null ? null : s.duration * rate;
    const customerCredits = cost === null ? null : priceFromWorkspaceCost(cost, conversion);
    return { model: data.operation === 'still' ? 'openai/gpt-image-2.5-sunburst' : data.model, seconds: data.operation === 'still' ? 0 : s.duration, rate, totalWorkspaceCredits: cost, customerCredits, revision: s.revision, available: customerCredits !== null, reason: customerCredits === null ? 'Generation pricing not configured yet. Verified USD conversion and a measured still quote are required; no credits will be charged.' : null };
  });

export const animateInspirationScene = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sceneId: Id, model: StudioModel, requestKey: Id, revision: z.number().int(), confirmedCredits: z.number().int().nonnegative() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: s } = await context.supabase.from('storyboard_scenes').select('*').eq('id', data.sceneId).single();
    if (!s) throw new Error('Scene not found.');
    const { assertAnimationReady } = await import('./inspiration');
    assertAnimationReady({ ...s, action_objects: s.action_objects as any, object_checks: s.object_checks as unknown as ObjectCheck[] });
    if (data.revision !== s.revision) throw new Error('The scene changed. Review a new quote.');
    const rate = STUDIO_MODELS.find(m => m.id === data.model)?.rate;
    const usd = Number(process.env['VIDEO_WORKSPACE_CREDIT_USD']);
    const price = rate == null ? null : priceFromWorkspaceCost(rate * s.duration, Number.isFinite(usd) && usd > 0 ? usd : null);
    if (price === null) throw new Error('Generation pricing not configured yet; no credits were charged.');
    if (price !== data.confirmedCredits) throw new Error('The price changed. Confirm a new quote.');
    const key = process.env['LOVABLE_API_KEY']; if (!key) throw new Error('AI connection is not configured.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: refs } = await context.supabase.from('reference_assets').select('id').eq('enabled', true);
    const { data: claim, error } = await supabaseAdmin.rpc('claim_inspiration_attempt', { p_user: context.userId, p_scene: s.id, p_request: data.requestKey, p_operation: 'animate', p_model: data.model, p_billed: price, p_workspace: (rate ?? 0) * s.duration, p_references: (refs ?? []).map(r => r.id) });
    if (error) throw new Error(error.message);
    const c = claim as any;
    if (c.busy) throw new Error('A scene is already generating. The queue is sequential.');
    if (c.existing) return { attemptId: c.attempt.id };
    try {
      const { submitApprovedAttempt } = await import('./inspiration.server');
      await submitApprovedAttempt(c.attempt, key);
    } catch (e) {
      const status = (e as any).status;
      if ([402,403,404].includes(status)) await supabaseAdmin.from('video_inspiration_projects').update({ pause_reason: (e as Error).message }).eq('id', s.project_id);
      const { data: current } = await supabaseAdmin.from('scene_attempts').select('status').eq('id', c.attempt.id).single();
      if (current?.status !== 'submission_unknown') await supabaseAdmin.rpc('fail_inspiration_attempt', { p_attempt: c.attempt.id, p_reason: (e as Error).message });
      throw e;
    }
    return { attemptId: c.attempt.id };
  });

export const recoverInspirationClips = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = process.env['LOVABLE_API_KEY']; if (!key) return { collected: 0 };
    const { collectPending } = await import('./inspiration.server');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    return { collected: await collectPending(key, context.userId) };
  });

export const finishInspirationStill = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ requestKey: Id, base64: z.string().max(14_000_000).optional(), error: z.string().max(600).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: a } = await context.supabase.from('scene_attempts').select('*').eq('user_id', context.userId).eq('request_key', data.requestKey).eq('operation', 'still').single();
    if (!a) throw new Error('Still attempt not found.');
    if (a.status === 'completed') return { ok: true };
    if (a.status === 'failed') throw new Error('This attempt failed; start a fresh request.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    if (data.error || !data.base64) { await supabaseAdmin.rpc('fail_inspiration_attempt', { p_attempt: a.id, p_reason: data.error ?? 'Still generation incomplete.' }); return { ok: false }; }
    const bytes = Uint8Array.from(atob(data.base64), c => c.charCodeAt(0));
    const { imageSize } = await import('./clone-rules'); const dims = imageSize(bytes);
    if (!dims || dims.width >= dims.height || bytes.length > 10 * 1024 * 1024) {
      await supabaseAdmin.rpc('fail_inspiration_attempt', { p_attempt: a.id, p_reason: 'Still must be a portrait image under 10MB.' }); throw new Error('Still was not a valid portrait image. Credits refunded.');
    }
    const path = `${context.userId}/${a.project_id}/stills/${a.id}.png`;
    const { error: up } = await supabaseAdmin.storage.from('video-inspiration').upload(path, bytes, { contentType: 'image/png', upsert: true }); if (up) throw new Error(up.message);
    await supabaseAdmin.from('scene_attempts').update({ status: 'completed', result_url: path, lease_until: null }).eq('id', a.id);
    const { error } = await supabaseAdmin.from('storyboard_scenes').update({ still_path: path, object_checks: [], approved_at: null, approved_revision: null, status: 'still_ready' }).eq('id', a.scene_id).eq('revision', a.scene_revision);
    if (error) throw new Error(error.message);
    return { ok: true };
  });