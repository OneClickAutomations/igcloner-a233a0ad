export const CREATION_STEPS = ['Pick a source', 'Review the post', 'Choose your output', 'Write your words', 'Make your content', 'Review and download'] as const;
export type CreationState = {
  url: string; analysisId?: string; format: 'image' | 'carousel' | 'reel' | 'film';
  mode: 'A0' | 'A1' | 'A2' | 'A3'; title: string; brief: string;
  goal: string; niche: string; tone: string; audience: string; platforms: string[];
  projectId?: string; copyProject?: boolean; production?: Record<string, unknown>; speechMode?: 'voiceover' | 'silent';
};
export const EMPTY_CREATION: CreationState = { url: '', format: 'image', mode: 'A2', title: '', brief: '', goal: '', niche: '', tone: '', audience: '', platforms: ['instagram'], speechMode: 'voiceover' };
export function restoreCreation(state: unknown): CreationState {
  return { ...EMPTY_CREATION, ...(state && typeof state === 'object' ? state : {}) } as CreationState;
}
export function resumeStep(step: number) { return Math.max(0, Math.min(5, Math.trunc(step))); }