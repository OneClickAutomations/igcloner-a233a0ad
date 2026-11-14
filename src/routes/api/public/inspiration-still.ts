import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

// Remake generators receive only written briefs and approved library references, never source media.

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
    const { priceFromWorkspaceCost, stripIdentity } = await import('@/lib/inspiration');
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
    const stillModel = 'openai/gpt-image-2.5-sunburst';
    const { allowedStudioReference } = await import('@/lib/look-brief');
    const safeRefs = (refs ?? []).filter(r => allowedStudioReference(r.storage_path, auth.user.id));
    const { data: claimed, error } = await supabaseAdmin.rpc('claim_inspiration_attempt', { p_user: auth.user.id, p_scene: scene.id, p_request: input.data.requestKey, p_operation: 'still', p_model: stillModel, p_billed: price ?? 0, p_workspace: cost, p_references: safeRefs.map(r => r.id) });
    if (error) return Response.json({ message: error.message }, { status: 409 });
    const claim = claimed as any;
    if (!claim.claimed) return Response.json({ message: 'This request already exists or a scene is generating. No duplicate generation was started.' }, { status: 409 });
    try {
      const { editImage } = await import('@/lib/inspiration-image-gateway.server');
      const config = { baseURL: 'https://ai.gateway.lovable.dev', apiKey: key, model: stillModel, format: 'openai' as const };
      const { sourceLookBrief, textOnlyStillPrompt } = await import('@/lib/look-brief');
      const { data: project } = await supabaseAdmin.from('video_inspiration_projects').select('analysis_id').eq('id', scene.project_id).eq('user_id', auth.user.id).single();
      const { data: analysis } = project?.analysis_id ? await supabaseAdmin.from('analyses').select('evidence').eq('id', project.analysis_id).eq('user_id', auth.user.id).maybeSingle() : { data: null };
      const { data: sheet } = await supabaseAdmin.from('studio_character_sheets').select('brief').eq('project_id', scene.project_id).eq('user_id', auth.user.id).eq('status', 'approved').order('created_at', { ascending: false }).limit(1).maybeSingle();
      const sceneInput = (scene.scene_input ?? {}) as any;
      const brief = sheet?.brief ?? sceneInput.lookBrief ?? sourceLookBrief(analysis, sceneInput.sourceShotIndex ?? 0);
      const roles = safeRefs.map((r,i)=>`Reference image ${i+1}: ${r.kind==='setting'?'approved environment reference':r.kind==='product'?'approved product':r.kind==='logo'?'approved logo':'approved original character; preserve skin shade, pigmentation, hair and build'}`).join('. ');
      const { realismGuidance } = await import('@/lib/video-motion');
      let prompt = `${textOnlyStillPrompt(scene, brief as any, roles, frame)}\nStill-frame realism: ${realismGuidance(`${JSON.stringify(sceneInput)} ${JSON.stringify(scene.action_objects ?? [])}`)} Depict only the requested ${frame === 'last' ? 'ending' : 'opening'} pose in this image; no motion trails or blended action phases.`;
      // Composition guide: the matching source keyframe (owner's own saved analysis) locks camera, pose and
      // setting geometry; the prompt orders a completely different, original person.
      const shotIdx = Number(sceneInput.sourceShotIndex ?? 0);
      const keyframes = ((analysis?.evidence as any)?.remakeRefs?.keyframes ?? []) as { shot: number; pos: string; path: string }[];
      const guide = keyframes.find(k => k.shot === shotIdx && k.pos === frame) ?? keyframes.find(k => k.shot === shotIdx) ?? keyframes[0];
      const guideImage = guide && guide.path.startsWith(`${auth.user.id}/`) ? (await supabaseAdmin.storage.from('source-media').download(guide.path)).data : null;
      if (guideImage) prompt += `\nCOMPOSITION GUIDE: the LAST attached image is a frame from the inspiration reel. Match its camera angle, framing, lens height, body pose, grip, equipment placement, lighting direction and setting layout as closely as possible. It is NOT an identity reference: generate a completely different, original person with different facial features and face shape, using only the written look and any approved character references above. Never copy the face, tattoos, logos or on-screen text from that frame.`;
      await supabaseAdmin.from('scene_attempts').update({ frame, prompt_snapshot: prompt }).eq('id', claim.attempt.id);
      let upstream: Response;
      if (safeRefs.length || guideImage) {
        const form = new FormData(); form.set('prompt', prompt); form.set('size', '720x1280'); form.set('quality', 'medium');
        for (const r of safeRefs) {
          const { data: im } = await supabaseAdmin.storage.from('video-inspiration').download(r.storage_path);
          if (!im || im.size > 10 * 1024 * 1024) throw new Error('Reference unavailable or too large.');
          form.append('image[]', im, r.filename);
        }
        if (guideImage) form.append('image[]', guideImage, 'composition-guide.jpg');
        upstream = await editImage(config, form);
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