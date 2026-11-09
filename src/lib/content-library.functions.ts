import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

async function libraryRows(context: any, id?: string) {
  const db = context.supabase, uid = context.userId;
  let pq = db.from('projects').select('*').eq('user_id', uid).order('updated_at', { ascending: false });
  let fq = db.from('video_inspiration_projects').select('*').eq('user_id', uid).order('updated_at', { ascending: false });
  if (id) { pq = pq.eq('id', id); fq = fq.eq('id', id); }
  const [pr, fr, ar, jr] = await Promise.all([pq, fq, db.from('project_assets').select('*').eq('user_id', uid).order('created_at', { ascending: false }), db.from('publishing_jobs').select('*,publishing_results(*)').eq('user_id', uid).order('created_at', { ascending: false })]);
  for (const r of [pr, fr, ar, jr]) if (r.error) throw new Error(r.error.message);
  const films = fr.data ?? [];
  const filmIds = films.map((f: any) => f.id);
  const [renders, scenes, attempts] = filmIds.length ? await Promise.all([
    db.from('assembly_jobs').select('*').eq('user_id', uid).in('project_id', filmIds).eq('status', 'completed').order('created_at', { ascending: false }),
    db.from('storyboard_scenes').select('*').eq('user_id', uid).in('project_id', filmIds).order('scene_order'),
    db.from('scene_attempts').select('*').eq('user_id', uid).in('project_id', filmIds).eq('operation', 'animate').eq('status', 'completed').order('created_at', { ascending: false }),
  ]) : [{ data: [] }, { data: [] }, { data: [] }];
  const sources = [...new Set([...(pr.data ?? []), ...films].map((p: any) => p.analysis_id).filter(Boolean))];
  const { data: analyses } = sources.length ? await db.from('analyses').select('id,instagram_url,source_account').in('id', sources).eq('user_id', uid) : { data: [] };
  const sign = async (bucket: string, path: string, fallback = '') => {
    if (!path.startsWith(`${uid}/`)) return fallback;
    const { data } = await db.storage.from(bucket).createSignedUrl(path, 604800);
    return data?.signedUrl ?? fallback;
  };
  const rows = [...(pr.data ?? []).filter((p: any) => !filmIds.includes(p.id)), ...films.map((f: any) => ({ ...(pr.data ?? []).find((p: any) => p.id === f.id), ...f, format: 'film' }))];
  return Promise.all(rows.map(async (p: any) => {
    const pd = p.project_data ?? {};
    let media: { url: string; type: string; path?: string }[] = [];
    let thumbnail = '';
    if (p.format === 'film') {
      const render = renders.data?.find((r: any) => r.project_id === p.id && r.result_path);
      if (render) media = [{ url: await sign('video-inspiration', render.result_path), type: 'video', path: render.result_path }];
      else {
        const clip = attempts.data?.find((r: any) => r.project_id === p.id && r.result_url);
        if (clip) media = [{ url: await sign('video-inspiration', clip.result_url), type: 'video' }];
      }
      const still = scenes.data?.find((s: any) => s.project_id === p.id && s.still_path);
      if (still) thumbnail = await sign('video-inspiration', still.still_path);
    } else {
      const assets = (ar.data ?? []).filter((a: any) => a.project_id === p.id && ['image', 'video'].includes(a.asset_type));
      const videoAsset = assets.find((a: any) => a.asset_type === 'video');
      if (pd.videoUrl || videoAsset) media = [{ url: videoAsset ? await sign('project-assets', videoAsset.filename ?? '', videoAsset.url) : pd.videoUrl, type: 'video' }];
      else if (p.format === 'carousel' && Array.isArray(pd.slides)) {
        media = await Promise.all(pd.slides.filter((s: any) => s.imageUrl).map(async (s: any) => {
          const a = assets.find((a: any) => a.url === s.imageUrl || Number(a.metadata?.slideIndex) === Number(s.index));
          return { url: a ? await sign('project-assets', a.filename ?? '', a.url) : s.imageUrl, type: 'image' };
        }));
      } else if (p.format === 'carousel') media = await Promise.all(assets.slice().reverse().map(async (a: any) => ({ url: await sign('project-assets', a.filename ?? '', a.url), type: a.asset_type })));
      else if (assets[0]) media = [{ url: await sign('project-assets', assets[0].filename ?? '', assets[0].url), type: assets[0].asset_type }];
      else if (pd.imageUrl) media = [{ url: pd.imageUrl, type: 'image' }];
      thumbnail = media.find(m => m.type === 'image')?.url ?? '';
    }
    const source = analyses?.find((a: any) => a.id === p.analysis_id);
    return { ...p, media, thumbnail, source_url: p.source_url ?? source?.instagram_url, source_account: p.source_account ?? source?.source_account, job: jr.data?.find((j: any) => j.project_id === p.id) ?? null, finished: p.format !== 'film' || !!renders.data?.find((r: any) => r.project_id === p.id) };
  }));
}

export const listContentLibrary = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => ({ items: await libraryRows(context) }));
export const getLibraryContent = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d)).handler(async ({ data, context }) => {
  const items = await libraryRows(context, data.id);
  if (!items[0]) throw new Error('Content not found');
  const { data: accounts, error } = await context.supabase.from('social_accounts').select('*').eq('user_id', context.userId).eq('is_connected', true);
  if (error) throw new Error(error.message);
  return { item: items[0], accounts: accounts ?? [] };
});

// Films already have private storage. A matching ordinary project connects them
// to the existing captions/assets/publishing engine without a second library store.
export const saveLibraryContent = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => z.object({ id: z.string().uuid(), wrapup: z.any().optional() }).parse(d)).handler(async ({ data, context }) => {
  const db = context.supabase;
  const [item] = await libraryRows(context, data.id);
  if (!item) throw new Error('Content not found');
  const { data: existing } = await db.from('projects').select('*').eq('id', item.id).eq('user_id', context.userId).maybeSingle();
  if (!existing) {
    const { error } = await db.from('projects').insert({ id: item.id, user_id: context.userId, analysis_id: item.analysis_id, title: item.title, format: 'reel', status: item.finished && item.media.length ? 'complete' : 'draft', source_url: item.source_url, source_account: item.source_account, project_data: { libraryFilm: true } });
    if (error) throw new Error(error.message);
  }
  const pd = existing?.project_data && typeof existing.project_data === 'object' && !Array.isArray(existing.project_data) ? existing.project_data : { libraryFilm: true };
  const { error } = await db.from('projects').update({ project_data: { ...pd, ...(data.wrapup ? { wrapup: data.wrapup } : {}) }, ...(item.media.length && item.finished ? { status: 'complete' } : {}) }).eq('id', item.id).eq('user_id', context.userId);
  if (error) throw new Error(error.message);
  if (item.format === 'film' && item.media[0]?.path) {
    const path = item.media[0].path;
    const { data: assets } = await db.from('project_assets').select('id').eq('project_id', item.id).eq('filename', path).eq('user_id', context.userId);
    if (!assets?.length) {
      const { error } = await db.from('project_assets').insert({ project_id: item.id, user_id: context.userId, asset_type: 'video', source: 'generated', filename: path, url: item.media[0].url, metadata: { bucket: 'video-inspiration' } });
      if (error) throw new Error(error.message);
    }
  }
  return { ok: true };
});