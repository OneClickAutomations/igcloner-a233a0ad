import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { LookBrief, characterSheetPrompt } from '@/lib/look-brief';

export const Route = createFileRoute('/api/public/character-sheet')({ server: { handlers: { POST: async ({ request }) => {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token) return Response.json({ message: 'Sign in required.' }, { status: 401 });
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env['SUPABASE_URL'], pub = process.env['SUPABASE_PUBLISHABLE_KEY'], key = process.env['LOVABLE_API_KEY'];
  if (!url || !pub || !key) return Response.json({ message: 'AI connection is not configured.' }, { status: 503 });
  const client = createClient(url, pub, { auth: { persistSession: false } });
  const { data: auth } = await client.auth.getUser(token);
  if (!auth.user) return Response.json({ message: 'Sign in required.' }, { status: 401 });
  const input = z.object({ projectId: z.string().uuid(), requestKey: z.string().uuid(), brief: LookBrief, instructions: z.string().max(2000), confirmedCredits: z.number().int() }).safeParse(await request.json());
  if (!input.success) return Response.json({ message: 'Check the character brief.' }, { status: 400 });
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: project } = await supabaseAdmin.from('video_inspiration_projects').select('id').eq('id', input.data.projectId).eq('user_id', auth.user.id).single();
  if (!project) return Response.json({ message: 'Project not found.' }, { status: 404 });
  const { STUDIO_PRICING } = await import('@/lib/studio-pricing');
  const { priceFromWorkspaceCost } = await import('@/lib/inspiration');
  const price = priceFromWorkspaceCost(STUDIO_PRICING.stillWorkspaceCredits ?? 1, STUDIO_PRICING.workspaceCreditUsd) ?? 6;
  if (input.data.confirmedCredits !== price) return Response.json({ message: 'Review the updated price before generating.' }, { status: 409 });
  const { error: claimError } = await supabaseAdmin.from('studio_character_sheets').insert({ id: input.data.requestKey, project_id: project.id, user_id: auth.user.id, brief: input.data.brief, instructions: input.data.instructions });
  if (claimError) return Response.json({ message: 'A character request already exists. Wait for its result; no duplicate was charged.' }, { status: 409 });
  try {
    const { debitCredits } = await import('@/lib/credits.server');
    await debitCredits(auth.user.id, price, 'debit_image', 'character_sheet', project.id, input.data.requestKey);
    await supabaseAdmin.from('studio_character_sheets').update({ billed: price, status: 'in_progress' }).eq('id', input.data.requestKey);
    const upstream = await fetch('https://ai.gateway.lovable.dev/v1/images/generations', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'openai/gpt-image-2.5-sunburst', prompt: characterSheetPrompt(input.data.brief, input.data.instructions), size: '1536x1024', quality: 'medium', stream: true, partial_images: 1 }) });
    if (!upstream.ok || !upstream.body) {
      const { safeGatewayError } = await import('@/lib/inspiration.server'); throw await safeGatewayError(upstream);
    }
    const [browser, collector] = upstream.body.tee();
    const { collectCharacterSheet } = await import('@/lib/character-sheet.server');
    const job = collectCharacterSheet(supabaseAdmin, input.data.requestKey, collector);
    try { const mod = 'cloudflare:workers'; const cf: any = await import(/* @vite-ignore */ mod); cf.waitUntil?.(job); } catch { /* The development promise continues. */ }
    return new Response(browser, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' } });
  } catch (e) {
    const { failCharacterSheet } = await import('@/lib/character-sheet.server');
    await failCharacterSheet(supabaseAdmin, input.data.requestKey, (e as Error).message);
    return Response.json({ message: `${(e as Error).message} Any charged plan credits were refunded.` }, { status: (e as any).status ?? 500 });
  }
} } } });