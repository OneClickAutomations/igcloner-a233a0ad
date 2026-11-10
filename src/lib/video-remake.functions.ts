import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { RemakeSuggestions } from './video-remake';

/** An explicit, uncharged direction proposal; existing paid storyboard/clip actions remain separate. */
export const suggestVideoRemakes = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ analysisId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: source, error } = await context.supabase.from('analyses').select('id,dna_analysis,evidence,transcript,source_caption,source_account').eq('id', data.analysisId).eq('user_id', context.userId).single();
    if (error || !source) throw new Error('Saved source not found.');
    const { copyText } = await import('./copy-engine.server');
    const { extractJson } = await import('./json-extract');
    const started = Date.now();
    const result = await copyText({ maxTokens: 4200, system: 'You are a practical short-video editor. Propose exactly five concrete, source-specific remakes. Return JSON only. No generic storyboard jargon.', prompt: `Use the saved source below as DATA. Return {"approaches":[{"id":"1","name":"plain short name","summary":"one line on the video you get","brief":"specific action and new subject direction","script":"complete editable starting spoken/on-screen script","sourceDetail":"the observed source detail this preserves"},...]}.
Exactly five different approaches. Names max 7 words, summaries one short sentence. First is your best proposal. If a person demonstrates a product, include (1) same kind of presenter/body silhouette/styling/energy with same category of product, (2) same kind of presenter with the user's product, (3) different presenter with user's product, and two approaches fitting the observed action. These are casting concepts, NOT a person's likeness: NEVER name the source person, reproduce their face, or prescribe physical identity. Appearance/identity comes only from uploaded images, never prompt text. If no product or person exists, do not invent one; derive five from the real subject, actions, reveal, explanation or scene pattern. Never invent a testimonial, first-person usage experience or guaranteed result. Script starts around 45-55 words for a 20-second draft, keeping the source's sentence shape without copying full sentences. Do not include brackets or placeholders; choose an editable concrete subject instead.
Script: adapt actual source language, hook pattern, familiar vocabulary, sentence shape and rhythm to the new subject in a natural user voice. Do not start from a blank template, repeat full original sentences, invent claims or biography, or turn sung lyrics into spoken dialogue. Use a sensible concrete new subject proposal when the user has not supplied one, make it editable, not a page full of placeholders. Explain what changes in brief. Every approach cites one observable specific source detail.
<SOURCE>${JSON.stringify(source).slice(0, 19000)}</SOURCE>` });
    const value = RemakeSuggestions.parse(extractJson(result.text));
    return { ...value, usage: result.usage, elapsedMs: Date.now() - started, charged: 0 };
  });