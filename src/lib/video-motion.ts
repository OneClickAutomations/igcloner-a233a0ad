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

export const PHYSICAL_REALISM = 'Realistic anatomy, materials and lighting are the default unless the user explicitly requests a stylized or physically impossible effect; apply that exception only to the requested effect. Rigid objects stay rigid, opaque objects stay opaque, and every object remains physically continuous and in the scene. Solid objects never pass through skin, the neck, head, torso, hands or other solid objects. Contact has correct depth and occlusion, without fused hands or floating grips. Keep anatomically plausible joints, stable limb counts, grounded feet and balanced posture. Gravity, inertia, acceleration, load and effort must agree: heavy objects move with controlled effort, not weightless snapping; never invent a numerical load from appearance. Preserve the written action sequence, opening pose, framing, environment and observed pace unless explicitly changed; fit only the phases that can realistically occur within the clip, never rush a full repetition. Skin has natural texture and lighting, not waxy smoothing; preserve approved skin shade and pigmentation from frame one, hair, build and outfit throughout unless the user explicitly requests a transformation.';
export const PHYSICAL_NEGATIVES = 'teleporting objects, appearing objects, disappearing props, changing product shape, changing product colors, changing proportions, scene cuts, unintended morphing, deformed anatomy, extra limbs, missing limbs, fused fingers, sliding grips, body-object interpenetration, objects passing through neck or head, floating feet, weightless heavy objects, abrupt acceleration, rubbery rigid objects, waxy skin, unintended skin-tone drift, pigmentation appearing midway';

/** Applied at submission too, so saved/custom prompts cannot skip the current contract. */
export function realismGuidance(action: string): string {
  const lifting = /\b(barbell|deadlift|weightlifting|clean\s*(?:and|&)\s*(?:press|jerk)|bench press)\b/i.test(action);
  return [PHYSICAL_REALISM, lifting && 'Barbell contact and load: keep the shaft, sleeves and plates a single stable assembly with consistent dimensions and symmetrical plate placement. Maintain the established grip with both hands wrapping the shaft, wrists and elbows moving naturally under load. The bar travels around the body, never through the neck, head or torso; a front-rack position rests on the front shoulders, not inside the throat. Raise or move the chin only when required by the specified lift to clear the bar, then restore alignment. Preserve the specified exercise and its ordered phases; do not invent a press, jerk or extra repetition. Keep a controlled bar path, credible balance, gradual acceleration and realistic settling at the end.'].filter(Boolean).join(' ');
}

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
    realismGuidance(input.action),
    `Audio: ${input.audio.trim()}.`,
  ].filter(Boolean).join(' ');
}
