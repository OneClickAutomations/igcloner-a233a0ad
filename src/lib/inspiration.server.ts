import { createVideo, pollVideo } from './inspiration-video-gateway.server';
import { PHYSICAL_NEGATIVES, PHYSICAL_REALISM } from './video-motion';
import { stripIdentity } from './inspiration';
import { toBase64 } from './analysis-ai.server';
import { CHARACTER_CONTINUITY } from './film-review';

export const INSPIRATION_BUCKET = 'video-inspiration';
export class StudioGatewayError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function safeGatewayError(res: Response) {
  const j = await res.json().catch(() => null) as any;
  return new StudioGatewayError(res.status, j?.message ?? j?.error?.message ?? `AI request failed (${res.status}).`);
}
export async function loadInspirationImage(path: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.storage.from(INSPIRATION_BUCKET).download(path);
  if (error || !data) throw new Error('Saved image could not be loaded.');
  if (data.size > 10 * 1024 * 1024) throw new Error('Reference image exceeds 10MB.');
  return { bytesBase64Encoded: toBase64(new Uint8Array(await data.arrayBuffer())), mimeType: data.type || 'image/png' };
}
export async function submitApprovedAttempt(attempt: any, apiKey: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: scene, error } = await supabaseAdmin.from('storyboard_scenes').select('*').eq('id', attempt.scene_id).eq('user_id', attempt.user_id).single();
  if (error || !scene?.still_path || scene.revision !== attempt.scene_revision || scene.approved_revision !== scene.revision) throw new Error('Scene approval changed; animation was not submitted.');
  if (!scene.still_path.startsWith(`${attempt.user_id}/${attempt.project_id}/stills/`)) throw new Error('Use a generated Studio still for animation. Source media is never sent to the video generator.');
  const { data: project } = await supabaseAdmin.from('video_inspiration_projects').select('pause_reason').eq('id', attempt.project_id).single();
  if (project?.pause_reason) throw new Error(project.pause_reason);
  const { data: won } = await supabaseAdmin.from('scene_attempts').update({ status: 'submitting', updated_at: new Date().toISOString() }).eq('id', attempt.id).eq('status', 'claimed').select('id').maybeSingle();
  if (!won) return;
  const config = { baseURL: 'https://ai.gateway.lovable.dev', apiKey, model: attempt.model };
  const start = await loadInspirationImage(scene.still_path);
  let request: any;
  const rawMotion = attempt.prompt_snapshot ?? scene.motion_prompt;
  const prompt = `${(scene.scene_input as {faithful?:boolean})?.faithful === true ? rawMotion : stripIdentity(rawMotion)} ${CHARACTER_CONTINUITY} ${PHYSICAL_REALISM}`;
  if (attempt.model === 'google/gemini-omni-1.1-flash') {
    request = { input: [{ type: 'text', text: `${prompt} <FIRST_FRAME> is the approved starting frame. No teleporting objects. No changing product shape, colors or opacity.` }, { type: 'image', data: start.bytesBase64Encoded, mime_type: start.mimeType }], response_format: { type: 'video', resolution: '720p', duration: `${scene.duration}s`, aspect_ratio: '9:16' } };
  } else {
    // Veo rejects ingredient references beside a starting-frame image. Approval mode
    // must animate the approved frame; references are already used in that frame.
    const endPath = (scene as any).end_still_path as string | null;
    const end = endPath?.startsWith(`${attempt.user_id}/${attempt.project_id}/stills/`) && attempt.model !== 'google/veo-3.1-lite' ? await loadInspirationImage(endPath) : null;
    request = { instances: [{ prompt, image: start, ...(end ? { lastFrame: end } : {}) }], parameters: { durationSeconds: scene.duration, resolution: '720p', sampleCount: 1, generateAudio: true, negativePrompt: PHYSICAL_NEGATIVES } };
  }
  let job;
  try { job = await createVideo(config, request); }
  catch (e) {
    if (!(e as any).status) {
      await supabaseAdmin.from('scene_attempts').update({ status: 'submission_unknown', failure_reason: 'Submission response was lost. Do not retry until reconciled.', lease_until: null }).eq('id', attempt.id);
      await supabaseAdmin.from('video_inspiration_projects').update({ pause_reason: 'Animation submission needs reconciliation; no paid retry is allowed.' }).eq('id', attempt.project_id);
    }
    throw e;
  }
  if (!job.id) throw new Error('AI job returned no durable job ID; do not retry automatically.');
  const { error: saveError } = await supabaseAdmin.from('scene_attempts').update({ gateway_job_id: job.id, status: job.status, lease_until: null, updated_at: new Date().toISOString() }).eq('id', attempt.id);
  if (saveError) {
    await supabaseAdmin.from('scene_attempts').update({ status: 'submission_unknown', gateway_job_id: job.id, failure_reason: 'Submitted job needs reconciliation. Do not resubmit.' }).eq('id', attempt.id);
    throw new Error('Submitted job needs reconciliation; no automatic retry is allowed.');
  }
  await supabaseAdmin.rpc('arm_inspiration_collector');
}
export async function collectAttempt(attempt: any, apiKey: string) {
  if (!attempt.gateway_job_id || attempt.status === 'completed' || attempt.status === 'failed') return;
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const now = new Date();
  const { data: locked } = await supabaseAdmin.from('scene_attempts').update({ lease_until: new Date(now.getTime() + 120000).toISOString() }).eq('id', attempt.id).in('status', ['queued','in_progress','collecting']).or(`lease_until.is.null,lease_until.lt.${now.toISOString()}`).select('id').maybeSingle();
  if (!locked) return;
  let job;
  try { job = await pollVideo({ baseURL: 'https://ai.gateway.lovable.dev', apiKey, model: attempt.model }, attempt.gateway_job_id); }
  catch (e) { await supabaseAdmin.from('scene_attempts').update({ lease_until: null }).eq('id', attempt.id); throw e; }
  if (job.status === 'failed') {
    await supabaseAdmin.rpc('fail_inspiration_attempt', { p_attempt: attempt.id, p_reason: job.error?.message ?? 'Animation failed.' });
    return;
  }
  if (job.status !== 'completed') {
    await supabaseAdmin.from('scene_attempts').update({ status: job.status, lease_until: null, updated_at: new Date().toISOString() }).eq('id', attempt.id).in('status', ['queued','in_progress','collecting']);
    return;
  }
  const { data: won } = await supabaseAdmin.from('scene_attempts').update({ status: 'collecting' }).eq('id', attempt.id).in('status', ['queued','in_progress','collecting']).select('id').maybeSingle();
  if (!won) return;
  const path = `${attempt.user_id}/${attempt.project_id}/clips/${attempt.id}.mp4`;
  try {
    const res = await fetch(`https://ai.gateway.lovable.dev/v1/videos/${encodeURIComponent(attempt.gateway_job_id)}/content`, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!res.ok) throw await safeGatewayError(res);
    if (Number(res.headers.get('content-length') ?? 0) > 50 * 1024 * 1024) throw new Error('Clip exceeds the 50MB limit.');
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length || bytes.length > 50 * 1024 * 1024) throw new Error('Clip is empty or exceeds the 50MB limit.');
    const { error } = await supabaseAdmin.storage.from(INSPIRATION_BUCKET).upload(path, bytes, { contentType: 'video/mp4', upsert: true });
    if (error) throw new Error(error.message);
    const { error: saved } = await supabaseAdmin.from('scene_attempts').update({ status: 'completed', result_url: path, lease_until: null, updated_at: new Date().toISOString() }).eq('id', attempt.id);
    if (saved) throw new Error(saved.message);
    await supabaseAdmin.from('storyboard_scenes').update({ status: 'animated', selected_attempt_id:attempt.id }).eq('id', attempt.scene_id).eq('revision',attempt.scene_revision);
  } catch (e) {
    await supabaseAdmin.from('scene_attempts').update({ lease_until: null, failure_reason: `Clip generated; saving needs recovery: ${(e as Error).message}` }).eq('id', attempt.id);
    throw e;
  }
}

/** Bounded read-only-provider collector. Never starts or retries paid generation. */
export async function collectPending(apiKey: string, owner?: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  let q = supabaseAdmin.from('scene_attempts').select('*').in('status', ['queued', 'in_progress', 'collecting']).not('gateway_job_id', 'is', null).order('updated_at').limit(4);
  if (owner) q = q.eq('user_id', owner);
  const { data } = await q;
  let collected = 0;
  for (const a of data ?? []) {
    const { data: project } = await supabaseAdmin.from('video_inspiration_projects').select('pause_reason').eq('id', a.project_id).single();
    if (project?.pause_reason) continue;
    try { await collectAttempt(a, apiKey); collected++; }
    catch (e) {
      const status = (e as any).status;
      if ([401, 402, 403, 404].includes(status)) {
        await supabaseAdmin.from('video_inspiration_projects').update({ pause_reason: (e as Error).message }).eq('id', a.project_id);
        break;
      }
    }
  }
  return collected;
}