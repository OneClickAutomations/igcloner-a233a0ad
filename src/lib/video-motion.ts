/** Browser-safe prompt builder; scene identity is supplied by reference media. */
export type MotionPromptInput = {
  action: string;
  endState: string;
  camera: string;
  speed: string;
  audio: string;
  durationSeconds: 4 | 6 | 8;
  referenceScene?: string;
};

export const VIDEO_MOTION_CANDIDATE = {
  model: 'google/veo-3.1-fast',
  durationSeconds: 8,
  resolution: '720p',
  productionApproved: false,
} as const;

export const PHYSICAL_REALISM = 'Water flows only from the bottle opening. The cap stays where the approved still shows it. Opaque objects stay opaque. All objects remain physically continuous and in the scene.';
export const PHYSICAL_NEGATIVES = 'water from caps or bottle sides, transparent opaque bottles, teleporting objects, appearing objects, disappearing props, changing product shape, changing product colors, changing proportions, scene cuts';

/** Best tested pattern, not a guarantee of physical correctness or action completion. */
export function buildMotionPrompt(input: MotionPromptInput): string {
  for (const value of [input.action, input.endState, input.camera, input.speed, input.audio]) {
    if (!value.trim()) throw new Error('Action, end state, camera, speed and audio are required.');
  }
  return [
    input.referenceScene?.trim(),
    input.action.trim(),
    `The action starts immediately and proceeds at ${input.speed.trim()}.`,
    `Camera: ${input.camera.trim()}.`,
    'Keep the product shape, colors and proportions unchanged.',
    `By the end of ${input.durationSeconds} seconds: ${input.endState.trim()}.`,
    'Single continuous shot.',
    PHYSICAL_REALISM,
    `Audio: ${input.audio.trim()}.`,
  ].filter(Boolean).join(' ');
}

export const POUR_MOTION_FIXTURE: MotionPromptInput = {
  action: 'A hand grips the product, removes its cap, then tilts the open bottle downward over a cup placed beside it. Water visibly streams from the bottle into the cup, filling the cup halfway by the end.',
  endState: 'the bottle is upright beside the half-filled cup',
  camera: 'slow push-in',
  speed: 'normal speed',
  audio: 'water pouring and outdoor ambience',
  durationSeconds: 8,
};