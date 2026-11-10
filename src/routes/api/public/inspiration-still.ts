import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

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
    const input = z.object({ sceneId: z.string().uuid(), requestKey: z.string().uuid(), revision: z.number().int(), confirmedCredits: z.number().int(), stream: z.boolean().default(true) }).safeParse(await request.json());
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
    const { data: claimed, error } = await supabaseAdmin.rpc('claim_inspiration_attempt', { p_user: auth.user.id, p_scene: scene.id, p_request: input.data.requestKey, p_operation: 'still', p_model: 'openai/gpt-image-2.5-sunburst', p_billed: price ?? 0, p_workspace: cost, p_references: (refs ?? []).map(r => r.id) });
    if (error) return Response.json({ message: error.message }, { status: 409 });
    const claim = claimed as any;
    if (!claim.claimed) return Response.json({ message: 'This request already exists or a scene is generating. No duplicate generation was started.' }, { status: 409 });
    try {
      const { generateImage, editImage } = await import('@/lib/inspiration-image-gateway.server');
      const config = { baseURL: 'https://ai.gateway.lovable.dev', apiKey: key, model: 'openai/gpt-image-2.5-sunburst', format: 'openai' as const };
      const prompt = `${stripIdentity(scene.still_prompt)}. Compose a portrait 9:16 image, 720 by 1280 framing. Reference identity only; create the new scene, not a copy of reference setting.`;
      let upstream: Response;
      if (refs?.length) {
        const form = new FormData(); form.set('prompt', prompt); form.set('size', '720x1280'); form.set('quality', 'low');
        for (const r of refs) {
          const { data: im } = await supabaseAdmin.storage.from('video-inspiration').download(r.storage_path);
          if (!im || im.size > 10 * 1024 * 1024) throw new Error('Reference unavailable or too large.');
          form.append('image[]', im, r.filename);
        }
        upstream = await editImage(config, form);
      } else {
        // Supported portrait size supplied explicitly, not just through prompt text.
        upstream = await fetch('https://ai.gateway.lovable.dev/v1/images/generations', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: config.model, prompt, size: '720x1280', quality: 'low', stream: true, partial_images: 1 }) });
      }
      if (!upstream.ok) {
        const { safeGatewayError } = await import('@/lib/inspiration.server');
        throw await safeGatewayError(upstream);
      }
      await supabaseAdmin.from('scene_attempts').update({ status: 'in_progress' }).eq('id', claim.attempt.id);
      return new Response(upstream.body, { status: upstream.status, headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'text/event-stream', 'Cache-Control': 'no-store', 'X-Studio-Attempt': claim.attempt.id } });
    } catch (e) {
      await supabaseAdmin.rpc('fail_inspiration_attempt', { p_attempt: claim.attempt.id, p_reason: (e as Error).message });
      const status = (e as any).status ?? 500;
      if ([402,403,404].includes(status)) await supabaseAdmin.from('video_inspiration_projects').update({ pause_reason: (e as Error).message }).eq('id', scene.project_id);
      return Response.json({ message: (e as Error).message }, { status });
    }
  } } },
});