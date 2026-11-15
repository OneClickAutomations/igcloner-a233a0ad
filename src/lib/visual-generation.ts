import { safeLookText, writtenLook, type LookBrief } from './look-brief';
import { shotReviewInstruction } from './film-review';
import { requestedPromptChanges } from './prompt-magic';

type Scene = { revision: number; scene_input?: any; action_objects?: unknown; still_prompt?: string; motion_prompt?: string; review_history?: unknown; look_correction?: string | null };
type Keyframe = { shot: number; pos: string; path: string };
export type VisualReference = { kind: 'source' | 'continuity' | 'character' | 'product' | 'setting' | 'logo'; image: number };

/** Never borrow an unrelated shot or another owner's frame as an action target. */
export function sourceFramePath(scene: Scene, frames: Keyframe[], owner: string, frame: 'first' | 'last'): string | null {
  const input = scene.scene_input ?? {};
  const owned = (path: unknown): path is string => typeof path === 'string' && path.startsWith(`${owner}/`);
  const saved = input.keyframes?.[frame];
  if (owned(saved)) return saved;
  const matching = frames.filter(k => k.shot === Number(input.sourceShotIndex ?? 0) && owned(k.path));
  return (matching.find(k => k.pos === frame) ?? matching.find(k => k.pos === 'mid') ?? matching[0])?.path ?? null;
}

/** All subjects use the same visual contract; human appearance is optional, never a default subject. */
export function visualAnchor(scene: Scene) {
  const i = scene.scene_input ?? {};
  return {
    action: String(i.remakeAction || i.action || ''),
    opening: String(i.openingPose || ''),
    ending: String(i.endState || ''),
    environment: String(i.environment || ''),
    camera: String(i.camera || ''),
    objects: (Array.isArray(scene.action_objects) ? scene.action_objects : i.objects ?? []) as { name: string; state: string }[],
  };
}

function changes(scene: Scene): string {
  const i = scene.scene_input ?? {};
  const edits = i.remakeEdits ?? {};
  // Generated remakePerson/remakeOutfit are descriptions, not explicit user overrides.
  return [i.ownerInstructions, edits.person, edits.outfit, edits.setting, i.settingTweak, scene.look_correction, requestedPromptChanges(shotReviewInstruction(scene))]
    .filter(v => typeof v === 'string' && v.trim()).map(v => safeLookText(v)).join('; ');
}

export function visualStillPrompt(scene: Scene, brief: LookBrief, references: VisualReference[], frame: 'first' | 'last'): string {
  const anchor = visualAnchor(scene);
  const source = references.find(r => r.kind === 'source');
  const continuity = references.find(r => r.kind === 'continuity');
  const pose = frame === 'first' ? anchor.opening : anchor.ending;
  const base = source
    ? `Transform image ${source.image} into an original photoreal production. Retain subject type, scale, proportions, action setup, pose, equipment geometry, camera, lighting and environment dynamics. For people, create different facial features, not a different physique.`
    : `Create a photoreal 9:16 scene. Action setup: ${anchor.action}. ${pose}. Environment: ${anchor.environment}. Camera: ${anchor.camera}. ${writtenLook(brief).replace(/\b\w+: unclear;?\s*/g, '')}`;
  const roles = references.filter(r => r.kind !== 'source').map(r => r.kind === 'continuity'
    ? `Image ${r.image}: keep this generated subject's appearance, colours, proportions and materials; use the target scene's pose and layout.`
    : `Image ${r.image}: approved ${r.kind} reference; use it for ${r.kind} only.`);
  const userChanges = changes(scene);
  return [base, ...roles,
    source && scene.scene_input?.faithful !== true ? `New scene direction: ${anchor.action}. Environment: ${anchor.environment}. Camera: ${anchor.camera}.` : '',
    !source && !continuity && !references.length ? scene.still_prompt : '',
    source && frame === 'last' ? `Ending pose: ${pose || 'the target image pose'}.` : '',
    anchor.objects.length ? `Required objects: ${anchor.objects.map(o => `${o.name}: ${o.state}`).join('; ')}.` : '',
    userChanges ? `User changes (override conflicting references; keep unmentioned details): ${userChanges}. Apply now, not during animation.` : '',
    'Natural surface texture, clear detail and coherent lighting. Remove source captions, handles and watermarks.',
  ].filter(Boolean).join('\n');
}

/** Submission rebuilds legacy essay prompts from saved action data, without altering the draft. */
export function visualMotionPrompt(scene: Scene, snapshot?: string | null, duration = 8): string {
  const a = visualAnchor(scene);
  const i = scene.scene_input ?? {};
  const instruction = requestedPromptChanges(shotReviewInstruction(scene));
  const custom = scene.motion_prompt && !/Single continuous|The action starts immediately|Keep the product shape|Pacing:|By the end of/i.test(scene.motion_prompt) ? scene.motion_prompt : '';
  const action = custom || a.action || snapshot || 'Animate the visible action setup';
  const contact = /\b(barbell|deadlift|weightlift|clean and press)\b/i.test(action)
    ? 'Keep the bar rigid and grips attached; move it around the body, never through it, with controlled effort.' : '';
  return [action, `Start immediately; ${duration}s, ${i.speed || 'source-like pace'}, one continuous shot.`,
    `Camera: ${a.camera || 'match the approved frame'}.`, a.ending ? `End: ${a.ending}.` : '',
    'Keep approved subjects, surface markings, proportions and materials stable from frame one. Animate movement, not appearance.',
    'Coherent contact, weight and gravity.', contact,
    instruction ? `Requested action changes: ${safeLookText(instruction)}.` : '',
    i.audio ? `Audio: ${i.audio}.` : '',
  ].filter(Boolean).join(' ');
}