// Browser-safe Creator Studio contract: directions, idea shape, DNA summary and image prompt.
import { z } from 'zod';

export const STUDIO_STEPS = ['Analyze', 'Direction', 'Ideas', 'Create', 'Publish'] as const;
export type StudioFormat = 'image' | 'reel' | 'carousel';
export type StudioDirection = 'refresh' | 'edit' | 'remix';

export const DIRECTIONS: { id: StudioDirection; title: string; tagline: string; example: string }[] = [
  { id: 'refresh', title: 'Clone & Refresh', tagline: 'Keep the winning concept. Give it a fresh look.', example: 'Same scene and mood, new outfit, colors and setting.' },
  { id: 'edit', title: 'Edit Specific Elements', tagline: 'Keep what you like. Change only what you choose.', example: 'Keep the wall and the person, replace the painted words.' },
  { id: 'remix', title: 'Full Remix', tagline: 'Keep the idea. Reinvent everything else.', example: 'Same curiosity hook, a completely new scene and message.' },
];

export const EDIT_TARGETS = ['Text', 'Person', 'Background', 'Clothing', 'Colors', 'An object', 'Surface'] as const;

export const IdeaSchema = z.object({
  group: z.enum(['engagement', 'bold', 'fresh']),
  title: z.string().min(1),
  angle: z.string(),
  visual: z.string(),
  hook: z.string(),
  reaction: z.string(),
  why: z.string(),
  format: z.enum(['image', 'reel', 'carousel']),
});
export type StudioIdea = z.infer<typeof IdeaSchema>;
export const IdeasResultSchema = z.object({ ideas: z.array(IdeaSchema).min(1).max(15), recommendedIndex: z.number().int().min(0), recommendedWhy: z.string() });

export const GROUP_LABEL: Record<StudioIdea['group'], string> = { engagement: 'Engagement & Curiosity', bold: 'Bold & Contrarian', fresh: 'Fresh Concepts' };

/** Top-3 shortlist: the recommended idea first, then the first idea of each other group. */
export function shortlist(ideas: StudioIdea[], recommended: number): StudioIdea[] {
  const rec = ideas[recommended] ?? ideas[0];
  if (!rec) return [];
  const out = [rec];
  for (const g of ['engagement', 'bold', 'fresh'] as const) {
    if (out.length >= 3) break;
    const next = ideas.find(i => i.group === g && !out.includes(i));
    if (next && !out.some(o => o.group === g)) out.push(next);
  }
  for (const i of ideas) { if (out.length >= 3) break; if (!out.includes(i)) out.push(i); }
  return out;
}

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '');

/** Summary uses only saved analysis fields; empty lists mean the analysis did not record them. */
export function dnaSummary(dna: any): { worked: string[]; improve: string[]; opportunity: string } {
  const d = dna ?? {}, hook = d.hookBreakdown ?? {};
  const worked = [...(Array.isArray(d.whyItWorks) ? d.whyItWorks : []), text(hook.whatWorks)].map(text).filter(Boolean).slice(0, 3);
  const improve = [text(hook.improvement), ...(Array.isArray(d.weaknesses) ? d.weaknesses : []), ...(Array.isArray(d.improvements) ? d.improvements : []), text(d.captionDNA?.improvement), text(hook.scoreReasoning)]
    .map(text).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3);
  const opportunity = text(d.opportunity) || text(d.strategicInsight) || text(d.keyInsight) || (worked[0] ? `Keep what made it work (${worked[0].replace(/\.$/, '')}) and fix the weakest part to make something better.` : '');
  return { worked, improve, opportunity };
}

export const ASPECTS = { '4:5': '1024x1280', '1:1': '1024x1024', '9:16': '1024x1536' } as const;
export type StudioAspect = keyof typeof ASPECTS;

export type ImageBrief = { direction: StudioDirection; idea: Pick<StudioIdea, 'title' | 'visual' | 'hook'>; keep?: string; change?: string[]; newText?: string; textOnImage: boolean; style?: string; brandColors?: string; notes?: string };

/** Short, specific prompt: long concatenated prompts make image models drop details. */
export function studioImagePrompt(b: ImageBrief, hasSource: boolean): string {
  const parts: string[] = [];
  if (b.direction === 'refresh' && hasSource) parts.push('Using the reference image, create a fresh new photo of the same concept: keep its composition style, mood, subject type and storytelling, but change outfit, colors, props and setting so it is clearly new.');
  else if (b.direction === 'edit' && hasSource) parts.push(`Edit the reference image. Keep everything else the same${b.keep ? `, especially: ${b.keep}` : ''}. Change only: ${(b.change ?? []).join(', ') || 'the details described below'}.`);
  else parts.push('Create an original, scroll-stopping social media image.');
  parts.push(`Concept: ${b.idea.visual || b.idea.title}.`);
  const words = b.newText?.trim() || (b.textOnImage ? b.idea.hook.trim() : '');
  parts.push(words ? `Render this exact text, spelled exactly, large and legible: "${words}".` : 'No text, letters or logos in the image.');
  if (b.style) parts.push(`Style: ${b.style}.`);
  if (b.brandColors) parts.push(`Use these brand colors where natural: ${b.brandColors}.`);
  if (b.notes?.trim()) parts.push(b.notes.trim());
  parts.push('Photoreal unless the style says otherwise, sharp, professional lighting.');
  return parts.join(' ');
}
