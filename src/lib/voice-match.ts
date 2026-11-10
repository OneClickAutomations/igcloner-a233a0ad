import { VOICE_CATALOG } from './voice-catalog';

function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(text).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(text).join(' ');
  return '';
}

/** Match delivery characteristics, never clone the source speaker's identity. */
export function matchSourceVoice(source: unknown) {
  const data = source && typeof source === 'object' ? source as Record<string, unknown> : {};
  const dna = (data.dna ?? data.dna_analysis ?? {}) as Record<string, unknown>;
  const evidence = (data.evidence ?? {}) as Record<string, unknown>;
  const partial = (evidence.partial ?? {}) as Record<string, unknown>;
  const video = (evidence.video ?? partial.video ?? {}) as Record<string, unknown>;
  const blueprint = (data.blueprint ?? dna.blueprint ?? {}) as Record<string, unknown>;
  const audio = text(data.audio_observations ?? video.audio ?? blueprint.audio ?? dna.reelDNA ?? dna.reelForensics);
  const visual = text(data.visual_observations ?? video.shots ?? blueprint.scenes ?? dna.videoVisualDNA);
  // Explicit audio speaker evidence takes priority over a visible person.
  const gender = (value: string) => /\bfemale\b|\bwoman\b|\bwomen\b|\blady\b|\bgirl\b|\bgrandmother\b/i.test(value) ? 'female' : /\bmale\b|\bman\b|\bmen\b|\bboy\b|\bgrandfather\b/i.test(value) ? 'male' : undefined;
  const speaker = gender(audio) ?? gender(visual);
  const context = gender(audio) ? audio : `${audio} ${visual}`;
  const mature = /\bolder\b|\belderly\b|\bmature\b|\bsenior\b|grandmother|grandfather|\b60s\b|\b70s\b/i.test(context);
  const energetic = /energetic|upbeat|high.energy|excited|youthful|\byoung\b|\b20s\b/i.test(context);
  const calm = /calm|soothing|gentle|soft.spoken/i.test(audio);
  const british = /british|\buk accent\b|english accent/i.test(audio);
  const australian = /australian|aussie/i.test(audio);
  let name = 'River';
  if (speaker === 'female') name = mature ? 'Matilda' : british ? (calm ? 'Lily' : 'Alice') : energetic ? 'Jessica' : calm ? 'Laura' : 'Sarah';
  if (speaker === 'male') name = mature ? 'Bill' : australian ? 'Charlie' : british ? 'George' : energetic ? 'Liam' : calm ? 'Eric' : 'Will';
  if (!speaker && /documentary|professional narration/i.test(audio)) name = 'Laura';
  const voice = VOICE_CATALOG.find(v => v.name === name) ?? VOICE_CATALOG[0];
  const traits = [mature ? 'mature delivery' : energetic ? 'upbeat delivery' : calm ? 'calm delivery' : 'natural delivery', speaker ? `${speaker} speaker` : 'speaker details not recorded', british ? 'British accent' : australian ? 'Australian accent' : ''].filter(Boolean);
  return { voice, reason: `Matched to source: ${traits.join(', ')}. Original ElevenLabs voice, not a clone of the speaker.` };
}