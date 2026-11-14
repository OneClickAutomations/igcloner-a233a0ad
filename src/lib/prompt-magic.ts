import { z } from 'zod';

export const PROMPT_MAGIC_COST = 1;
export const MagicPromptSchema = z.object({
  requested_changes: z.string().max(4000),
  subject_continuity: z.string().max(2000),
  texture_and_lighting: z.string().max(2000),
  action_timeline: z.string().max(3000),
  camera: z.string().max(1000),
  physics: z.string().max(2000),
  avoid: z.string().max(2000),
});
export function formatMagicPrompt(value: z.infer<typeof MagicPromptSchema>, format: 'regular'|'json') {
  if (format === 'json') return JSON.stringify(value, null, 2);
  return `Requested changes: ${value.requested_changes}\n\nGeneration guidance:\n${Object.entries(value).filter(([k])=>k!=='requested_changes').map(([k,v])=>`${k.replaceAll('_',' ')}: ${v}`).join('\n')}`;
}
export function requestedPromptChanges(text: string): string {
  try { const j = JSON.parse(text); if(typeof j.requested_changes === 'string') return j.requested_changes; } catch {}
  const match = text.match(/^Requested changes: ([\s\S]*?)\n\nGeneration guidance:/);
  return match?.[1] ?? text;
}