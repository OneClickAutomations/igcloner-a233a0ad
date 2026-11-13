import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { LookBrief, sourceLookBrief } from './look-brief';

export const getCharacterSheet = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.supabase.from('video_inspiration_projects').select('analysis_id').eq('id', data.projectId).eq('user_id', context.userId).single();
    if (!p) throw new Error('Project not found.');
    const { data: a } = p.analysis_id ? await context.supabase.from('analyses').select('evidence').eq('id', p.analysis_id).eq('user_id', context.userId).maybeSingle() : { data: null };
    const { data: sheet } = await context.supabase.from('studio_character_sheets').select('*').eq('project_id', data.projectId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const { data: preview } = sheet?.result_path ? await context.supabase.storage.from('video-inspiration').createSignedUrl(sheet.result_path, 900) : { data: null };
    return { brief: LookBrief.parse(sheet?.brief ?? sourceLookBrief(a)), sheet: sheet ? { ...sheet, preview: preview?.signedUrl ?? null } : null };
  });

/** Saves owner-approved crops of an original generated sheet, never source frames. */
export const approveCharacterSheet = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), views: z.array(z.object({ kind: z.enum(['character_face','character_body','character_back']), base64: z.string().max(5_000_000) })).length(3) }).parse(d))
  .handler(async ({ data, context }) => {
    if (new Set(data.views.map(v => v.kind)).size !== 3) throw new Error('Approve all three character views.');
    const { data: sheet } = await context.supabase.from('studio_character_sheets').select('*').eq('id', data.id).eq('user_id', context.userId).single();
    if (!sheet || !['completed','approved'].includes(sheet.status)) throw new Error('The character sheet is not ready yet.');
    if (sheet.status === 'approved') return { ids: sheet.reference_ids };
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { imageSize } = await import('./clone-rules');
    const rows = [];
    for (const v of data.views) {
      const bytes = Uint8Array.from(atob(v.base64), c => c.charCodeAt(0));
      if (!imageSize(bytes) || bytes.length > 4_000_000) throw new Error('One character view is unreadable or too large.');
      const path = `${context.userId}/character-sheets/${sheet.id}/${v.kind}.jpg`;
      const { error } = await supabaseAdmin.storage.from('video-inspiration').upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
      if (error) throw new Error(error.message);
      rows.push({ user_id: context.userId, project_id: sheet.project_id, character_sheet_id: sheet.id, kind: v.kind, filename: `Original character — ${v.kind.replace('character_','')}`, storage_path: path, enabled: true });
    }
    const { data: old } = await supabaseAdmin.from('reference_assets').select('id').eq('character_sheet_id', sheet.id);
    const { data: inserted, error } = old?.length === 3 ? { data: old, error: null } : await supabaseAdmin.from('reference_assets').insert(rows).select('id');
    if (error || !inserted) throw new Error(error?.message ?? 'Character references could not be saved.');
    const ids = inserted.map(r => r.id);
    await supabaseAdmin.from('studio_character_sheets').update({ status: 'approved', reference_ids: ids }).eq('id', sheet.id);
    // Existing storyboard scenes receive the same anchors without changing their saved instructions/history.
    const { data: scenes } = await context.supabase.from('storyboard_scenes').select('id,scene_input').eq('project_id', sheet.project_id);
    for (const scene of scenes ?? []) {
      const input = (scene.scene_input ?? {}) as any;
      const existing = Array.isArray(input.referenceIds) ? input.referenceIds : [];
      const { data: other } = existing.length ? await context.supabase.from('reference_assets').select('id,kind').in('id', existing) : { data: [] };
      await supabaseAdmin.from('storyboard_scenes').update({ scene_input: { ...input, lookBrief: sheet.brief, referenceIds: [...ids, ...(other ?? []).filter(r => !r.kind.startsWith('character_')).map(r => r.id)].slice(0,5) } }).eq('id', scene.id);
    }
    return { ids };
  });