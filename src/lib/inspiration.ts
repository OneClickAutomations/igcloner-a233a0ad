import { z } from 'zod';
import { buildMotionPrompt } from './video-motion';
import { STUDIO_PRICING } from './studio-pricing';

export const ReferenceKind = z.enum(['character_face', 'character_body', 'character_back', 'product', 'logo', 'setting']);
export const StudioModel = z.enum(['google/veo-3.1-fast', 'google/veo-3.1-lite', 'google/gemini-omni-1.1-flash']);
export const STUDIO_MODELS = [
  { id: 'google/veo-3.1-fast', label: 'Veo 3.1 Fast', note: 'Product / action · default', rate: STUDIO_PRICING.rates['google/veo-3.1-fast'] },
  { id: 'google/veo-3.1-lite', label: 'Veo 3.1 Lite', note: 'cheaper, less motion', rate: STUDIO_PRICING.rates['google/veo-3.1-lite'] },
  { id: 'google/gemini-omni-1.1-flash', label: 'Gemini Omni', note: 'Fallback · provisional price', rate: STUDIO_PRICING.rates['google/gemini-omni-1.1-flash'] },
] as const;
export const ActionObject = z.object({ name: z.string().trim().min(1).max(80), state: z.string().trim().min(1).max(160) });
export const SceneInput = z.object({
  environment: z.string().trim().min(1).max(500), action: z.string().trim().min(1).max(800),
  endState: z.string().trim().min(1).max(300), camera: z.string().trim().min(1).max(160),
  audio: z.string().trim().min(1).max(300), duration: z.union([z.literal(4), z.literal(6), z.literal(8)]).default(8),
  objects: z.array(ActionObject).min(1).max(12), voiceover: z.string().max(1000).optional(), onScreenText: z.string().max(200).optional(), stillPrompt: z.string().max(5000).optional(), motionPrompt: z.string().max(5000).optional(), referenceIds: z.array(z.string().uuid()).max(5).optional(),
});
export type SceneDraft = z.infer<typeof SceneInput>;

/** Remove text-based physical identity; identity anchors are reference pixels only. */
export function stripIdentity(text: string): string {
  return text
    .replace(/\b(?:looks? like|resembling|identical to|likeness of|face of|identity of|named|called)\b[^.;\n]*/gi, 'the reference subject')
    .replace(/\b(?:[\w-]+\s+){0,3}(?:hair|eyes|skin|complexion|ethnicity|race|nationality|facial features|face shape)\b/gi, 'reference-defined appearance')
    .replace(/\b\d{1,3}[ -](?:year[ -]old|years old)\b/gi, 'adult')
    .replace(/\b(?:Asian|African|Caucasian|Latino|Latina|Hispanic|European|blonde|brunette|redhead|male|female|man|woman|boy|girl)\b/gi, 'subject')
    .replace(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, 'the reference subject').trim();
}
export function buildScenePrompts(scene: SceneDraft) {
  const referenced = referencedActionObjects(`${scene.action} ${scene.motionPrompt ?? ''}`);
  const missing = referenced.filter(name => !scene.objects.some(o => `${o.name} ${o.state}`.toLowerCase().includes(name)));
  if (missing.length) throw new Error(`Motion references objects missing from the still checklist: ${missing.join(', ')}.`);
  const objects = scene.objects.map(o => `${stripIdentity(o.name)}: ${stripIdentity(o.state)}`).join('; ');
  const still = stripIdentity(scene.stillPrompt ?? `Portrait 9:16 photograph. New setting: ${scene.environment}. Every required action object is clearly visible in its initial state: ${objects}. Subject identity only from supplied references. Before the action begins; hands positioned to perform: ${scene.action}. Preserve referenced product shape, colors and proportions. No source-person likeness, source words or unreferenced logos.`);
  // Even custom still instructions must include the prerequisites.
  const stillPrompt = `${still}\nRequired initial objects and states: ${objects}.`;
  const motionPrompt = stripIdentity(scene.motionPrompt ?? buildMotionPrompt({ action: scene.action, endState: scene.endState, camera: scene.camera, speed: 'normal speed', audio: scene.audio, durationSeconds: scene.duration }));
  return { stillPrompt, motionPrompt };
}
export function referencedActionObjects(text: string) {
  return ['cup','bottle','hand','cap','glass','backpack','box','phone','lid','table'].filter(word => new RegExp(`\\b${word}s?\\b`, 'i').test(text));
}
export type ObjectCheck = { name: string; state: string; present: boolean | null; reason?: string };
export function missingActionObjects(objects: SceneDraft['objects'], checks: ObjectCheck[]) {
  return objects.filter(o => !checks.some(c => c.name.toLowerCase() === o.name.toLowerCase() && c.state.toLowerCase() === o.state.toLowerCase() && c.present === true));
}
export function assertAnimationReady(scene: { approved_at: string | null; still_path: string | null; revision: number; approved_revision: number | null; object_checks: ObjectCheck[]; action_objects: SceneDraft['objects'] }) {
  if (!scene.still_path || !scene.approved_at || scene.approved_revision !== scene.revision) throw new Error('Approve the current still before animation.');
  if (missingActionObjects(scene.action_objects, scene.object_checks).length) throw new Error('The still has missing or unverified action objects.');
}
export const CUSTOMER_CREDIT_USD = STUDIO_PRICING.customerCreditUsd;
export const COST_CEILING = STUDIO_PRICING.costCeiling;
export function priceFromWorkspaceCost(workspaceCredits: number, usdPerWorkspaceCredit: number | null) {
  if (usdPerWorkspaceCredit === null) return null;
  if (!Number.isFinite(usdPerWorkspaceCredit) || usdPerWorkspaceCredit <= 0 || workspaceCredits < 0) throw new Error('Invalid verified cost.');
  return Math.ceil(workspaceCredits * usdPerWorkspaceCredit / (CUSTOMER_CREDIT_USD * COST_CEILING));
}
export function splitCachedObservations(evidence: any, transcript: string | null, segments: any[] = []) {
  const video = evidence?.video ?? evidence?.partial?.video;
  const shots = Array.isArray(video?.shots) ? video.shots : [];
  const visual = shots.map((s: any) => ({
    start: s.start ?? null, end: s.end ?? null, duration: typeof s.end === 'number' && typeof s.start === 'number' ? s.end - s.start : null,
    subject: null, environment: null, action: s.onScreen ?? null, lighting: null,
    shotSize: s.shotType ?? null, cameraAngle: null, cameraMovement: s.camera ?? null,
    onScreenText: s.onScreenText ?? [], provenance: { kind: 'cached_visual_observation', source: 'saved analysis', timestamp: s.start ?? null },
  }));
  const audio = { spokenWords: transcript, segments, sound: null, provenance: { kind: transcript ? 'cached_transcript' : 'unknown', source: 'saved analysis' } };
  return { visual, audio, limitations: ['Visual and transcript evidence are separated from cached results; no new isolated-media passes were run.', 'Fields absent from saved evidence stay unknown.'], addedWorkspaceCredits: 0 };
}