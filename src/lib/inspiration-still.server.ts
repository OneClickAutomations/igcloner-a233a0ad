// Server-only: persists a finished inspiration still for an attempt. Shared by the browser finish call and the
// server-side collector, so a still that finishes while the user refreshes is saved instead of refunded.
import { createParser } from 'eventsource-parser';

type Admin = any;
export async function saveInspirationStill(admin: Admin, a: any, bytes: Uint8Array): Promise<{ ok: boolean; outfitFallback: boolean; outfitUsed?: string; error?: string }> {
  const { data: cur } = await admin.from('scene_attempts').select('status,outfit_fallback,outfit_used').eq('id', a.id).single();
  if (cur?.status === 'completed') return { ok: true, outfitFallback: (cur?.outfit_fallback ?? a.outfit_fallback) === true, outfitUsed: cur?.outfit_used ?? a.outfit_used ?? undefined };
  if (cur?.status === 'failed') return { ok: false, outfitFallback: false, error: 'This attempt failed; start a fresh request.' };
  const { imageSize } = await import('./clone-rules'); const dims = imageSize(bytes);
  if (!dims || dims.width >= dims.height || bytes.length > 10 * 1024 * 1024) {
    await admin.rpc('fail_inspiration_attempt', { p_attempt: a.id, p_reason: 'Still must be a portrait image under 10MB.' });
    return { ok: false, outfitFallback: false, error: 'Still was not a valid portrait image. Credits refunded.' };
  }
  const path = `${a.user_id}/${a.project_id}/stills/${a.id}.png`;
  const { error: up } = await admin.storage.from('video-inspiration').upload(path, bytes, { contentType: 'image/png', upsert: true }); if (up) throw new Error(up.message);
  await admin.from('scene_attempts').update({ status: 'completed', result_url: path, lease_until: null }).eq('id', a.id).neq('status', 'failed');
  if (a.frame === 'last') {
    const { error } = await admin.from('storyboard_scenes').update({ end_still_path: path }).eq('id', a.scene_id); if (error) throw new Error(error.message);
  } else {
    const { error } = await admin.from('storyboard_scenes').update({ still_path: path, object_checks: [], approved_at: null, approved_revision: null, status: 'still_ready' }).eq('id', a.scene_id).eq('revision', a.scene_revision); if (error) throw new Error(error.message);
  }
  return { ok: true, outfitFallback: (cur?.outfit_fallback ?? a.outfit_fallback) === true, outfitUsed: cur?.outfit_used ?? a.outfit_used ?? undefined };
}

/** Reads the image event stream to its final frame and saves it; never fails/refunds (the browser or sweep does that). */
export async function collectStillFromStream(admin: Admin, attemptId: string, body: ReadableStream<Uint8Array>) {
  let final = '';
  const parser = createParser({ onEvent(ev) {
    try { const p = JSON.parse(ev.data); const t = ev.event || p?.type; if ((t === 'image_generation.completed' || t === 'image_edit.completed') && p?.b64_json) final = p.b64_json; } catch { /* ignore */ }
  } });
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  while (true) { const c = await reader.read(); if (c.done) break; parser.feed(c.value); }
  if (!final) return;
  const { data: a } = await admin.from('scene_attempts').select('*').eq('id', attemptId).single();
  if (!a) return;
  await saveInspirationStill(admin, { ...a, frame: a.frame ?? 'first' }, Uint8Array.from(atob(final), c => c.charCodeAt(0)));
}
