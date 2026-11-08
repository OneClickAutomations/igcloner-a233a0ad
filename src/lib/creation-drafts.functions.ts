import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

const DraftInput = z.object({ id: z.string().uuid(), title: z.string().max(200), step: z.number().int().min(0).max(5), state: z.record(z.unknown()), completed: z.boolean().default(false) });
export const saveCreationDraft = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => DraftInput.parse(v)).handler(async ({ data, context }) => {
    const { error } = await context.supabase.from('creation_drafts').upsert({ ...data, state: data.state as any, user_id: context.userId, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { saved: true };
  });
export const loadCreationDraft = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v)).handler(async ({ data, context }) => {
    const { data: draft, error } = await context.supabase.from('creation_drafts').select('*').eq('id', data.id).eq('user_id', context.userId).single();
    if (error) throw new Error(error.message);
    return draft;
  });
export const listCreationDrafts = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from('creation_drafts').select('*').eq('user_id', context.userId).eq('completed', false).order('updated_at', { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
});
export const creationSources = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from('analyses').select('id, instagram_url, source_account').eq('user_id', context.userId).eq('analysis_status', 'ready').order('created_at', { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
});