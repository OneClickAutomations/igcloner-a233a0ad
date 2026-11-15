import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

// Source images retain visual/action geometry; generated references preserve continuity.

export const Route = createFileRoute('/api/public/inspiration-still')({
  server: { handlers: { POST: async ({ request }) => {
    const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
    if (!token) return Response.json({ message: 'Sign in required.' }, { status: 401 });
    const { createClient } = await import('@supabase/supabase-js');
    const url = process.env['SUPABASE_URL']; const pub = process.env['SUPABASE_PUBLISHABLE_KEY'];
    if (!url || !pub) return Response.json({ message: 'Auth is not configured.' }, { status: 503 });
    const client = createClient(url, pub, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth } = await client.auth.getUser(token);
    if (!auth.user) return Response.json({ message: 'Sign in required.' }, { status: 401 });
    const input = z.object({ sceneId: z.string().uuid(), requestKey: z.string().uuid(), revision: z.number().int(), confirmedCredits: z.number().int(), stream: z.boolean().default(true), frame: z.enum(['first','last']).default('first') }).safeParse(await request.json());
    if (!input.success) return Response.json({ message: 'Invalid still request.' }, { status: 400 });
    const { STUDIO_PRICING } = await import('@/lib/studio-pricing');
    const usd = STUDIO_PRICING.workspaceCreditUsd; const cost = STUDIO_PRICING.stillWorkspaceCredits;
    if (cost === null) return Response.json({ message: 'Still cost has not been verified yet; no credits charged.' }, { status: 409 });
    const { priceFromWorkspaceCost } = await import('@/lib/inspiration');
    const price = priceFromWorkspaceCost(cost, usd);
    if (price !== input.data.confirmedCredits) return Response.json({ message: 'Price changed. Review a new quote.' }, { status: 409 });
    const key = process.env['LOVABLE_API_KEY']; if (!key) return Response.json({ message: 'AI connection not configured.' }, { status: 503 });
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: scene } = await supabaseAdmin.from('storyboard_scenes').select('*').eq('id', input.data.sceneId).eq('user_id', auth.user.id).single();
    if (!scene || scene.revision !== input.data.revision) return Response.json({ message: 'Scene not found or changed.' }, { status: 409 });
    const referenceIds = (scene.scene_input as {referenceIds?:string[]})?.referenceIds;
    let referenceQuery = supabaseAdmin.from('reference_assets').select('*').eq('user_id', auth.user.id);
    if (Array.isArray(referenceIds)) referenceQuery = referenceQuery.in('id', referenceIds);
    else referenceQuery = referenceQuery.eq('enabled', true);
    const { data: refs } = await referenceQuery.order('created_at').limit(5);
    const frame = input.data.frame;
    const { data: project } = await supabaseAdmin.from('video_inspiration_projects').select('analysis_id').eq('id', scene.project_id).eq('user_id', auth.user.id).single();
    // Exact clone: the owner confirmed they own or may use the source, so the source frame is edited directly.
    const { RIGHTS_STATEMENT_VERSION } = await import('@/lib/clone-rules');
    const { data: rights } = project?.analysis_id ? await supabaseAdmin.from('rights_confirmations').select('mode,statement_version').eq('user_id', auth.user.id).eq('analysis_id', project.analysis_id) : { data: [] };
    const exact = (rights ?? []).some(r => r.mode === 'A0' && r.statement_version === RIGHTS_STATEMENT_VERSION);
    const stillModel = exact ? 'google/gemini-3-pro-image' : 'openai/gpt-image-2.5-sunburst';
    const { allowedStudioReference } = await import('@/lib/look-brief');
    const safeRefs = (refs ?? []).filter(r => allowedStudioReference(r.storage_path, auth.user.id));
    const { data: claimed, error } = await supabaseAdmin.rpc('claim_inspiration_attempt', { p_user: auth.user.id, p_scene: scene.id, p_request: input.data.requestKey, p_operation: 'still', p_model: stillModel, p_billed: price ?? 0, p_workspace: cost, p_references: safeRefs.map(r => r.id) });
    if (error) return Response.json({ message: error.message }, { status: 409 });
    const claim = claimed as any;
    if (!claim.claimed) return Response.json({ message: 'This request already exists or a scene is generating. No duplicate generation was started.' }, { status: 409 });
    try {
      const { editImage } = await import('@/lib/inspiration-image-gateway.server');
      const config = { baseURL: 'https://ai.gateway.lovable.dev', apiKey: key, model: stillModel, format: exact ? 'gemini-chat' as const : 'openai' as const };
      const { sourceLookBrief, continuityStillPath } = await import('@/lib/look-brief');
      const { sourceFramePath, visualStillPrompt, exactClonePrompt } = await import('@/lib/visual-generation');
      const { data: analysis } = project?.analysis_id ? await supabaseAdmin.from('analyses').select('evidence').eq('id', project.analysis_id).eq('user_id', auth.user.id).maybeSingle() : { data: null };
      const { data: sheet } = await supabaseAdmin.from('studio_character_sheets').select('brief').eq('project_id', scene.project_id).eq('user_id', auth.user.id).eq('status', 'approved').order('created_at', { ascending: false }).limit(1).maybeSingle();
      const sceneInput = (scene.scene_input ?? {}) as any;
      const { data: siblings } = await supabaseAdmin.from('storyboard_scenes').select('id,scene_order,still_path,scene_input').eq('project_id', scene.project_id).eq('user_id', auth.user.id).order('scene_order');
      const continuityPath = continuityStillPath(scene, siblings ?? [], auth.user.id);
      const { data: continuityImage, error: continuityError } = continuityPath ? await supabaseAdmin.storage.from('video-inspiration').download(continuityPath) : { data: null, error: null };
      if (continuityPath && (continuityError || !continuityImage || continuityImage.size > 10 * 1024 * 1024)) throw new Error('The saved character reference could not be loaded. Your existing stills are unchanged. Please try again.');
      const brief = sheet?.brief ?? sceneInput.lookBrief ?? sourceLookBrief(analysis, sceneInput.sourceShotIndex ?? 0);
      const keyframes = ((analysis?.evidence as any)?.remakeRefs?.keyframes ?? []) as { shot: number; pos: string; path: string }[];
      const guidePath = sourceFramePath(scene, keyframes, auth.user.id, frame);
      const { data: guideImage, error: guideError } = guidePath ? await supabaseAdmin.storage.from('source-media').download(guidePath) : { data: null, error: null };
      if (guidePath && (guideError || !guideImage || guideImage.size > 10 * 1024 * 1024)) throw new Error('The saved inspiration frame could not be loaded. No replacement was generated; please reload your source frames.');
      const images: { kind: 'source' | 'continuity' | 'character' | 'product' | 'setting' | 'logo'; blob: Blob; filename: string }[] = [];
      if (guideImage) images.push({ kind: 'source', blob: guideImage, filename: 'source-action-guide.jpg' });
      if (continuityImage) images.push({ kind: 'continuity', blob: continuityImage, filename: 'generated-continuity.png' });
      const loadedRefs = await Promise.all(safeRefs.map(async r => {
        const { data: im } = await supabaseAdmin.storage.from('video-inspiration').download(r.storage_path);
        if (!im || im.size > 10 * 1024 * 1024) throw new Error('Reference unavailable or too large.');
        return { kind: (['product','setting','logo'].includes(r.kind) ? r.kind : 'character') as 'product' | 'setting' | 'logo' | 'character', blob: im, filename: r.filename };
      }));
      images.push(...loadedRefs);
      const roles = images.map((im, i) => ({ kind: im.kind, image: i + 1 }));
      const prompt = exact && guideImage ? exactClonePrompt(scene, roles, frame) : visualStillPrompt(scene, brief as any, roles, frame);
      await supabaseAdmin.from('scene_attempts').update({ frame, prompt_snapshot: prompt }).eq('id', claim.attempt.id);
      let upstream: Response;
      if (images.length) {
        const form = new FormData(); form.set('prompt', prompt); form.set('size', '720x1280'); form.set('quality', 'medium');
        for (const image of images) form.append('image[]', image.blob, image.filename);
        upstream = await editImage(config, form);
      } else if (exact) {
        const { generateImage } = await import('@/lib/inspiration-image-gateway.server');
        upstream = await generateImage(config, prompt);
      } else {
        upstream = await fetch('https://ai.gateway.lovable.dev/v1/images/generations', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: config.model, prompt, size: '720x1280', quality: 'medium', stream: true, partial_images: 1 }) });
      }
      if (!upstream.ok) {
        const { safeGatewayError } = await import('@/lib/inspiration.server');
        throw await safeGatewayError(upstream);
      }
      await supabaseAdmin.from('scene_attempts').update({ status: 'in_progress' }).eq('id', claim.attempt.id);
      // Tee the stream: the browser gets live previews while the server saves the final still itself, so a
      // refresh mid-generation is collected rather than failed and refunded.
      let body = upstream.body;
      if (body) {
        const [toClient, toServer] = body.tee(); body = toClient;
        const { collectStillFromStream } = await import('@/lib/inspiration-still.server');
        const job = collectStillFromStream(supabaseAdmin, claim.attempt.id, toServer).catch(() => {});
        try { const mod = 'cloudflare:workers'; const cf: any = await import(/* @vite-ignore */ mod); cf?.waitUntil?.(job); } catch { /* dev server: the promise still runs */ }
      }
      return new Response(body, { status: upstream.status, headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'text/event-stream', 'Cache-Control': 'no-store', 'X-Studio-Attempt': claim.attempt.id, 'X-Outfit-Fallback': '0', 'Access-Control-Expose-Headers': 'X-Outfit-Fallback' } });
    } catch (e) {
      await supabaseAdmin.rpc('fail_inspiration_attempt', { p_attempt: claim.attempt.id, p_reason: (e as Error).message });
      const status = (e as any).status ?? 500;
      if ([402,403,404].includes(status)) await supabaseAdmin.from('video_inspiration_projects').update({ pause_reason: (e as Error).message }).eq('id', scene.project_id);
      return Response.json({ message: (e as Error).message }, { status });
    }
  } } },
});