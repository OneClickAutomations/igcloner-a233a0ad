import { createParser } from 'eventsource-parser';

/** Persist the final original sheet even if the browser goes away. Refusals end this attempt. */
export async function collectCharacterSheet(admin: any, id: string, body: ReadableStream<Uint8Array>) {
  let final = '', failure = '';
  const parser = createParser({ onEvent(ev) {
    try { const p = JSON.parse(ev.data); const type = ev.event || p.type;
      if (type === 'error' || p.type === 'error') failure = p.error?.message ?? 'Character generation failed.';
      if (type === 'image_generation.completed' && p.b64_json) final = p.b64_json;
    } catch { /* Ignore stream heartbeat. */ }
  } });
  try {
    const reader = body.pipeThrough(new TextDecoderStream() as unknown as ReadableWritablePair<string, Uint8Array>).getReader();
    while (true) { const chunk = await reader.read(); if (chunk.done) break; parser.feed(chunk.value); }
    if (failure || !final) throw new Error(failure || 'The character sheet could not be completed.');
    const { data: attempt } = await admin.from('studio_character_sheets').select('*').eq('id', id).single();
    if (!attempt || attempt.status === 'failed') return;
    const bytes = Uint8Array.from(atob(final), c => c.charCodeAt(0));
    const path = `${attempt.user_id}/character-sheets/${id}/sheet.png`;
    const { error } = await admin.storage.from('video-inspiration').upload(path, bytes, { contentType: 'image/png', upsert: true });
    if (error) throw new Error(error.message);
    await admin.from('studio_character_sheets').update({ status: 'completed', result_path: path }).eq('id', id).eq('status', 'in_progress');
  } catch (e) { await failCharacterSheet(admin, id, (e as Error).message); }
}
export async function failCharacterSheet(admin: any, id: string, reason: string) {
  const { data: attempt } = await admin.from('studio_character_sheets').update({ status: 'failed', failure_reason: reason }).eq('id', id).in('status', ['claimed','in_progress']).select('*').maybeSingle();
  if (!attempt) return;
  if (!attempt.billed) return;
  const { refundCredits } = await import('./credits.server');
  await refundCredits(attempt.user_id, attempt.billed, 'character_sheet', attempt.project_id, attempt.id);
}