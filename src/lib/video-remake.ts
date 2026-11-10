import { z } from 'zod';
import { STUDIO_PRICING, videoCreditsForWorkspace } from './studio-pricing';

export const RemakeApproach = z.object({ id: z.string(), name: z.string(), summary: z.string(), brief: z.string(), script: z.string(), sourceDetail: z.string() });
export const RemakeSuggestions = z.object({ approaches: z.array(RemakeApproach).length(5) });
export type RemakeChoice = z.infer<typeof RemakeApproach>;
export type ReferenceChoice = 'person' | 'product' | 'both' | 'design-person' | 'design-both';
export function referenceKinds(choice: ReferenceChoice): string[] {
  return { person: ['character_face', 'character_body', 'character_back'], product: ['product'], both: ['character_face', 'character_body', 'character_back', 'product'], 'design-person': ['product'], 'design-both': [] }[choice];
}
export function sourceAudioProposal(source: any) {
  const video = source?.evidence?.video ?? source?.evidence?.partial?.video ?? {};
  const dnaAudio = source?.dna_analysis?.reelDNA?.audio ?? source?.dna_analysis?.reelForensics?.audio ?? {};
  const audio = video.audio ?? {};
  const description = String(audio.description ?? dnaAudio.audioVisualSync ?? '');
  const kind = String(audio.kind ?? dnaAudio.musicType ?? 'unknown');
  const music = /music|song|track|vocal|singing/i.test(`${kind} ${description}`) && !/no background music|no music/i.test(description);
  const song = /vocal|singing|song|named artist/i.test(description) && !/no vocal|without vocal/i.test(description);
  const speech = video.hasSpeech === true || /voice|speech|spoken|narrat/i.test(kind) || (Boolean(source?.transcript?.trim()) && !song);
  const ambience = /ambient|wind|water|motor|nature/i.test(kind);
  return { speechMode: (speech ? 'voiceover' : 'silent') as 'voiceover' | 'silent', background: (music ? 'instrumental' : ambience ? 'ambience' : 'none') as 'instrumental' | 'ambience' | 'none', mood: `${audio.energy ?? 'source-matched'} ${description}`.trim(), note: song ? 'The original vocal track cannot be reused; an original instrumental is selected instead.' : description || 'Audio evidence is incomplete; no background track selected.' };
}
export function durationScenes(seconds: number): (4 | 6 | 8)[] {
  let remaining = Math.max(8, Math.min(60, Math.round(seconds / 2) * 2));
  const out: (4 | 6 | 8)[] = [];
  while (remaining > 8) { const n = remaining === 10 ? 6 : 8; out.push(n); remaining -= n; }
  out.push(remaining as 4 | 6 | 8); return out;
}
export function remakeClipCredits(seconds: number, model: 'google/veo-3.1-fast' | 'google/veo-3.1-lite') {
  return durationScenes(seconds).reduce((total, duration) => total + videoCreditsForWorkspace(duration * STUDIO_PRICING.rates[model]), 0);
}