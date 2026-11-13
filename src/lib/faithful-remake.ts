import { stripIdentity } from './inspiration';
import { personFromAppearance, outfitFromAppearance, type Appearance, type KeyframeRef } from './keyframes';
/** Browser-safe faithful remake: same verified shot, new original person; owner edits override only what they name. */
export type RemakeEdits = { person?: string; outfit?: string; setting?: string; words?: string };
export const FAITHFUL_ID = 'faithful';
export const DEFAULT_OUTFIT = 'fitted athletic wear (sports top and leggings) in the same colour family as the source outfit';

/** Remove @handles, usernames and watermark text; never invent replacement text. */
export function cleanOnScreenText(text: unknown): string {
  const raw = Array.isArray(text) ? text.map((t: any) => t?.text ?? t).join(' ') : String(text ?? '');
  return raw
    .replace(/@[\w.]+/g, ' ')
    .replace(/\b(?=[\w.]*[_\d])(?=[\w.]*[a-z])[\w.]{4,}\b/gi, ' ') // handle-like tokens (helena_mendes12, bakeshop_daily)
    .replace(/\b(?:tiktok|instagram|watermark|follow (?:me|us)|via|credit)\b[:\s]*/gi, ' ')
    .replace(/\s+/g, ' ').trim();
}

const LIFT = /\b(barbell|clean|press|deadlift|snatch|squat|jerk)\b/i;
export function startPose(action: string): string {
  if (LIFT.test(action)) return 'standing behind a loaded barbell resting on the floor, feet hip-width apart, hips hinged, back flat, both hands gripping the bar just outside the knees, about to lift';
  return `in the exact first position of this action, about to begin: ${action}`;
}
export function motionBeats(action: string, seconds: number): string {
  if (LIFT.test(action) && /overhead|press/i.test(action) && /floor/i.test(action)) {
    const t = (f: number) => `${Math.round(seconds * f * 10) / 10}s`;
    return `From 0s pulls the loaded barbell from the floor and cleans it to the front of the shoulders by ${t(0.3)}, presses it straight overhead to full lockout by ${t(0.55)}, holds it still overhead briefly until ${t(0.7)}, then lowers it under control back to the floor by ${t(1)}.`;
  }
  return `${action} The movement fills the full ${seconds}s at the source's pace.`;
}
export function liftPhysics(action: string) {
  return LIFT.test(action) ? 'The barbell is one rigid straight bar that stays level; the weight plates stay fixed on the sleeves and never change size or count; feet stay planted; joints bend naturally.' : '';
}
function props(onScreen: unknown): string[] {
  return String(onScreen ?? '').split(/[,;]/).map(s => s.trim()).filter(Boolean).filter(p => !/@|_|\d{2,}/.test(p));
}

export function faithfulScene(shot: any, opts: { edits?: RemakeEdits; hasCharacterRef: boolean; duration: 4 | 6 | 8; pacing?: string; audio?: string; speech: 'voiceover' | 'silent'; appearance?: Partial<Appearance> | null; keyframes?: KeyframeRef[] }) {
  const e = opts.edits ?? {};
  const subject = shot?.subjects?.[0] ?? {};
  const action = stripIdentity(String(subject.action ?? shot?.action ?? 'performs the same action'));
  const setting = stripIdentity(String(shot?.setting ?? 'the same setting'));
  const propList = props(shot?.onScreen).map(stripIdentity).filter(p => !/reference subject|subject/i.test(p));
  const framing = [shot?.framing ?? shot?.shotType, shot?.camera, 'eye level'].filter(Boolean).join(', ');
  const position = subject.position ?? 'center';
  const styled = personFromAppearance(opts.appearance);
  const person = e.person?.trim() || (opts.hasCharacterRef ? 'the person from the supplied character reference image' : styled ? `a new original adult with ${styled} (a different face from the source person)` : 'a new original adult athlete (not the source person)');
  const outfit = e.outfit?.trim() || outfitFromAppearance(opts.appearance) || DEFAULT_OUTFIT;
  const frames = Object.fromEntries((opts.keyframes ?? []).map(k => [k.pos, k.path])) as Partial<Record<'first'|'mid'|'last', string>>;
  const words = cleanOnScreenText(e.words ?? '');
  const settingLine = `${setting}${propList.length ? `, with ${propList.join(', ')} visible` : ''}`;
  const tweak = e.setting?.trim() ? ` Setting change requested by the owner: ${e.setting.trim()}.` : '';
  const stillPrompt = [
    `Photoreal vertical 9:16 photograph, top-tier commercial quality, natural skin texture, sharp focus.`,
    `Setting: ${settingLine}. Match the source lighting, walls and floor described here exactly.${tweak}`,
    `Camera: ${framing}; whole body in frame.`,
    `Subject: ${person}, wearing ${outfit}, positioned ${position} of frame, ${startPose(action)}.`,
    words ? `On-screen text: "${words}".` : 'No on-screen text, captions, usernames, logos or watermarks.',
    `A new original person; never the source person's likeness.`,
  ].join(' ');
  const motionPrompt = [
    `Single continuous ${framing} shot in ${settingLine}.`,
    `${person}, wearing ${outfit}: ${motionBeats(`${action} ${stripIdentity(String(shot?.action ?? ''))}`, opts.duration)}`,
    liftPhysics(action),
    `Camera stays ${shot?.camera ?? 'static'}. Pacing: ${opts.pacing ?? 'as the source'}.`,
    `Audio: ${opts.speech === 'voiceover' ? 'clear original voiceover; ' : ''}${opts.audio ?? 'natural room ambience'}; no source recording or song.`,
    words ? '' : 'No on-screen text, usernames or watermarks.',
  ].filter(Boolean).join(' ');
  return {
    environment: settingLine.slice(0, 500), action: `${person} ${action}`.slice(0, 800), endState: 'Same final position as the source shot'.slice(0, 300),
    camera: framing.slice(0, 160), audio: (opts.audio ?? 'Natural room ambience').slice(0, 300), duration: opts.duration,
    objects: [{ name: 'person', state: startPose(action).slice(0, 160) }, ...propList.slice(0, 11).map(p => ({ name: p.slice(0, 80), state: 'visible in the scene as in the source' }))],
    onScreenText: words.slice(0, 200), stillPrompt: stillPrompt.slice(0, 5000), motionPrompt: motionPrompt.slice(0, 5000), faithful: true as const,
    keyframes: frames, remakePerson: person.slice(0, 400), remakeOutfit: outfit.slice(0, 300), settingTweak: (e.setting ?? '').trim().slice(0, 300), remakeAction: action.slice(0, 400),
  };
}

/** Prompt for recreating a source keyframe: the image supplies composition only; the subject is a new person. */
export function frameReferencedPrompt(input: { remakePerson?: string; remakeOutfit?: string; settingTweak?: string; remakeAction?: string; onScreenText?: string }, frame: 'first' | 'last', opts: { fallbackOutfit?: boolean; hasCharacterRef?: boolean } = {}) {
  const outfit = opts.fallbackOutfit ? DEFAULT_OUTFIT : (input.remakeOutfit || DEFAULT_OUTFIT);
  const words = cleanOnScreenText(input.onScreenText ?? '');
  return [
    `Image 1 is a frame from a source video. Recreate it as a new photoreal vertical 9:16 photograph with the SAME composition: identical camera position, height and angle, lens and framing, the same pose and body position, the same background layout, every prop in the same place, the same lighting, walls and floor.`,
    `Replace the person with ${input.remakePerson || 'a new original adult'}, wearing ${outfit}.`,
    opts.hasCharacterRef ? 'Additional images are the owner\'s own character reference: use that person\'s identity for the subject.' : `The face must be clearly different and original; it must NOT resemble the person in Image 1 in any way. Do not copy their face, facial features, tattoos, birthmarks, scars or other distinctive marks.`,
    frame === 'last' ? `This is the final frame of the action (${input.remakeAction ?? 'as in the source'}): match the pose shown in Image 1.` : `This is the starting frame of the action: match the starting pose in Image 1 exactly.`,
    input.settingTweak ? `Owner-requested setting change: ${input.settingTweak}.` : '',
    words ? `On-screen text: "${words}".` : 'Remove all on-screen text, captions, usernames, handles, logos and watermarks.',
    'Top-tier commercial photo quality, natural skin texture, physically correct equipment.',
  ].filter(Boolean).join(' ');
}
