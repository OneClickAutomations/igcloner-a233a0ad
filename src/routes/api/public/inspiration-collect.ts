import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/api/public/inspiration-collect')({ server: { handlers: { POST: async ({ request }) => {
  const token = request.headers.get('authorization')?.replace(/^Bearer /,'');
  if (!token || token.length !== 64) return Response.json({ message: 'Unauthorized' }, { status: 401 });
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: won } = await supabaseAdmin.rpc('claim_inspiration_collector', { p_token: token });
  if (!won) return Response.json({ message: 'Unavailable' }, { status: 403 });
  try {
    const key = process.env['LOVABLE_API_KEY'];
    if (!key) return Response.json({ message: 'AI connection unavailable' }, { status: 503 });
    const { collectPending } = await import('@/lib/inspiration.server');
    await collectPending(key);
    return Response.json({ ok: true });
  } finally { await supabaseAdmin.rpc('finish_inspiration_collector'); }
} } } });