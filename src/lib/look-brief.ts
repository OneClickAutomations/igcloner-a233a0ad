import { z } from 'zod';

const detail = z.string().max(600).default('unclear');
export const LookBrief = z.object({ skinTone: detail, pigmentation: detail, hair: detail, build: detail, outfit: detail, accessories: detail, openingPose: detail, environment: detail });
export type LookBrief = z.infer<typeof LookBrief>;
export const LOOK_FIELDS = ['skinTone', 'pigmentation', 'hair', 'build', 'outfit', 'accessories', 'openingPose', 'environment'] as const;

/** Only descriptive style; no names, demographic labels, faces or exact identifying marks. */
export function safeLookText(text: string): string {
  return text
    .replace(/\b(?:looks? like|resembling|likeness of|identical to|face of|identity of|named|called)\b[^.;\n]*/gi, 'a new original person')
    .replace(/\b(?:[\w-]+\s+){0,2}(?:eyes|nose|lips|cheekbones|jawline|face shape|facial features|ethnicity|race|nationality)\b[^.;\n]*/gi, '')
    .replace(/\b(?:Asian|African|Caucasian|Latino|Latina|Hispanic|European|American|British|Chinese|Japanese|Indian|Brazilian|ethnic)\b/gi, '')
    .replace(/@[\w.]+/g, '').trim();
}
export function sourceLookBrief(source: any, shotIndex = 0): LookBrief {
  const ev = source?.evidence ?? {}; const video = ev.video ?? source?.dna_analysis?.verifiedVideo ?? source?.dna?.verifiedVideo;
  const shot = video?.shots?.[shotIndex];
  const brief = shot?.lookBriefs?.[0] ?? video?.lookBriefs?.[0];
  const old = ev.remakeRefs?.appearance ?? {};
  const value = LookBrief.parse(brief ?? { skinTone: [old.skinTone, old.undertone && `${old.undertone} undertone`].filter(Boolean).join(', ') || 'unclear', hair: old.hair ?? 'unclear', build: old.build ?? 'unclear', outfit: old.outfit ?? 'unclear', accessories: old.accessories ?? 'unclear', openingPose: shot?.openingPose ?? 'unclear', environment: shot?.setting ?? 'unclear' });
  return Object.fromEntries(LOOK_FIELDS.map(k => [k, safeLookText(value[k]) || 'unclear'])) as LookBrief;
}
export function writtenLook(brief: LookBrief): string {
  return LOOK_FIELDS.map(k => `${k}: ${safeLookText(brief[k])}`).join('; ');
}
export function characterSheetPrompt(brief: LookBrief, instructions: string): string {
  return `Create ONE photoreal character sheet, exactly three equal-width panels arranged left to right with no gutters, text or labels. Left: clean front-facing head-and-shoulders portrait. Middle: full-body front view, head and feet visible. Right: full-body back view, head and feet visible. All three show the SAME new original ADULT person, same skin shade (do not lighten), hair, build, clothing and accessories. Neutral plain studio background. Written casting brief: ${writtenLook(brief)}. Pigmentation is an original arrangement of visible light/dark patches, never an exact identifying pattern or a medical diagnosis. Create different, original facial features; do not imitate any real individual. Owner styling changes override conflicting brief fields BEFORE rendering all three panels: ${safeLookText(instructions) || 'none'}. Changes apply to every view. No props, brands, handles or watermarks.`;
}
export function textOnlyStillPrompt(scene: any, brief: LookBrief, roles: string, frame: 'first'|'last') {
  const input = scene.scene_input ?? {};
  const pose = frame === 'last' ? scene.scene_input?.endState ?? 'the described final position' : brief.openingPose !== 'unclear' ? brief.openingPose : input.openingPose ?? 'the described opening position, not a later action pose';
  const env = input.faithful && brief.environment !== 'unclear' ? brief.environment : input.environment ?? brief.environment;
  return `Photoreal portrait 9:16. Written look brief: ${writtenLook(brief)}. Preserve skin shade and pigmentation; do not lighten. ${roles}. Approved character references define the SAME original person in every scene; written instructions define styling when no references are selected. Pose: ${safeLookText(String(pose))}. Same type of environment as the brief: ${safeLookText(String(env))}; no invented props that are not in the brief or required object list. Camera: ${safeLookText(String(input.camera ?? 'static full shot'))}. Required objects and initial states: ${safeLookText(JSON.stringify(scene.action_objects ?? []))}. Owner changes: ${safeLookText(String(input.ownerInstructions ?? ''))}; person: ${safeLookText(String(input.remakePerson ?? ''))}; outfit: ${safeLookText(String(input.remakeOutfit ?? ''))}; setting tweak: ${safeLookText(String(input.settingTweak ?? ''))}. ${safeLookText(String(scene.look_correction ?? ''))}. Use a different original face, never real-person likeness. No source text, usernames, handles, logos or watermarks. ${input.faithful ? '' : `Scene instructions: ${safeLookText(String(scene.still_prompt ?? '')).replace(/New setting/gi, 'Environment type')}`}`;
}
export function allowedStudioReference(path: string, userId: string) {
  return path.startsWith(`${userId}/references/`) || path.startsWith(`${userId}/character-sheets/`);
}