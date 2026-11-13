import { z } from 'zod';
import { SceneInput, buildScenePrompts, referencedActionObjects, stripIdentity, type SceneDraft } from './inspiration';
import { ACTION_COSTS } from './credits';
import { FAITHFUL_ID, cleanOnScreenText, faithfulScene } from './faithful-remake';

export const REMIX_IDEAS_COST = ACTION_COSTS.captionPack;
export const RemixDirection = z.object({
  id: z.string().max(80), title: z.string().max(100), pitch: z.string().max(300),
  changes: z.object({ subject: z.string().max(250), setting: z.string().max(500), angle: z.string().max(250), message: z.string().max(500) }),
  stays: z.string().max(500), scenes: z.array(SceneInput).max(100).optional(),
  faithful: z.boolean().optional(),
  edits: z.object({ person: z.string().max(300).optional(), outfit: z.string().max(300).optional(), setting: z.string().max(300).optional(), words: z.string().max(200).optional() }).optional(),
});
export const RemixDirections = z.object({ directions: z.array(RemixDirection).min(3).max(4) });
export type Direction = z.infer<typeof RemixDirection>;
export function sourceShots(source: any): any[] {
  const dna = source?.dna ?? source?.dna_analysis ?? {};
  const video = source?.evidence?.video ?? dna.verifiedVideo;
  const shots = video?.shots ?? source?.blueprint?.scenes ?? dna.blueprint?.scenes ?? [];
  return Array.isArray(shots) ? shots : [];
}
export function supportedShotDuration(seconds: number): 4 | 6 | 8 {
  return seconds <= 5 ? 4 : seconds <= 7 ? 6 : 8;
}
/** First and default option: the same verified shots with a new original person. */
export function faithfulDirection(source: any): Direction {
  const first = sourceShots(source)[0];
  return { id: FAITHFUL_ID, faithful: true, title: 'Faithful remake — same video, new person', pitch: 'Keeps every shot exactly as the source: action, setting, props, lighting, camera, timing and audio feel. Only the person changes.',
    changes: { subject: 'A new original person, or your character reference', setting: 'Unchanged', angle: 'Unchanged', message: 'Unchanged unless you add words' },
    stays: `Action, setting, props, lighting, framing, pacing and timing of all ${sourceShots(source).length || 1} shot(s)${first?.setting ? ` — ${String(first.setting).slice(0,100)}` : ''}.` };
}
/** Faithful remake always leads; creative re-themes follow. */
export function withFaithfulFirst(source: any, list: Direction[]): Direction[] {
  const saved = list.find(d => d.id === FAITHFUL_ID);
  return [{ ...faithfulDirection(source), edits: saved?.edits }, ...list.filter(d => d.id !== FAITHFUL_ID)];
}
/** Explicitly labelled editable starting directions, not newly generated AI output. */
export function startingDirections(source: any): Direction[] {
  const dna = source?.dna ?? source?.dna_analysis ?? {};
  const hook = dna.hookBreakdown?.mechanism ?? 'opening reveal';
  const first = sourceShots(source)[0];
  const beat = stripIdentity(String(first?.action ?? first?.onScreen ?? first?.description ?? 'a clear demonstration')).slice(0, 140);
  const stays = `Keep the ${hook}, shot order and relative pacing. Opening beat: ${beat}.`;
  return [
    faithfulDirection(source),
    { id:'practical', title:'A practical new demonstration', pitch:`Adapt the observed demonstration to a new everyday subject.`, changes:{subject:'An original creative coach',setting:'A bright workshop',angle:'Useful step-by-step demonstration',message:'Build a small creative habit'},stays },
    { id:'product', title:'Put your product to work', pitch:'Use the same demonstration rhythm to show a different tool in use.',changes:{subject:'Your reference-defined product demonstrator',setting:'A clean tabletop studio',angle:'Show a practical tool solving a problem',message:'Choose a tool that makes daily practice easier'},stays },
    { id:'challenge', title:'Make it a playful challenge',pitch:'Turn the observed action and payoff into a new practice challenge.',changes:{subject:'An original challenge host',setting:'An outdoor practice space',angle:'A playful skill challenge',message:'Try one small challenge today'},stays },
    { id:'lesson',title:'Teach the principle behind it',pitch:'Use the source’s opening and beats to explain a new lesson.',changes:{subject:'An original educator',setting:'A quiet teaching studio',angle:'Explain the lesson, not the source subject',message:'Consistent small steps make learning easier'},stays },
  ];
}
/** One editable scene per saved shot; preserve source timing separately from provider-supported clip timing. */
export function prefillRemixScenes(source: any, direction: Direction, instructions: string, referenceIds: string[], speech: 'voiceover'|'silent'): (SceneDraft & { sourceStart: number; sourceEnd: number; sourceTimingNote: string })[] {
  const shots = sourceShots(source);
  const customSetting = instructions.match(/\b(?:in|at|use)\s+(?:a |an |the )?([^.;\n]*?\b(?:workshop|studio|garden|gym|kitchen|office|beach|park|classroom|store))\b/i)?.[1];
  const customObject = instructions.match(/\band\s+(?:a |an |the )?([^,;.\n]+?)(?=;|,|\.|$)/i)?.[1];
  if (direction.faithful || direction.id === FAITHFUL_ID) {
    const dna = source?.dna ?? source?.dna_analysis ?? {}; const video = source?.evidence?.video ?? dna.verifiedVideo ?? {};
    return shots.map((shot, i) => {
      const start = Number(shot.start ?? 0), end = Number(shot.end ?? start + 8), duration = supportedShotDuration(end - start);
      const refs = (source?.evidence?.remakeRefs ?? {}) as any;
      const scene = faithfulScene(shot, { appearance: refs.appearance, keyframes: (refs.keyframes ?? []).filter((k: any) => k.shot === i), edits: direction.edits, hasCharacterRef: referenceIds.length > 0, duration, pacing: video.pacing, audio: shot.audioSummary ?? video.audio?.description, speech });
      const notes = instructions.trim() ? `\nOwner notes (new original person, never source likeness): ${cleanOnScreenText(instructions) && instructions.trim()}` : '';
      return { ...scene, stillPrompt: `${scene.stillPrompt}${notes}`.slice(0, 5000), motionPrompt: `${scene.motionPrompt}${notes}`.slice(0, 5000), referenceIds, voiceover: '', sourceStart: start, sourceEnd: end,
        sourceTimingNote: end - start === duration ? 'Source shot timing retained' : `Source shot ${Math.round((end - start) * 10) / 10}s; clip ${duration}s (supported 4/6/8s length), beats scaled to fit` };
    });
  }
  return shots.map((shot, i) => {
    const start = Number(shot.start ?? 0), end = Number(shot.end ?? start + 8);
    const planned = direction.scenes?.[i];
    const message = instructions.match(/\b(?:message|lesson)\s+(?:about|is)\s+([^.;\n]+)/i)?.[1] ?? direction.changes.message;
    const action = planned?.action ?? `${direction.changes.subject} ${customObject ? `demonstrates a new practical use of ${customObject}` : 'demonstrates one concrete step'} to illustrate ${message}. ${i===0?'Begin with the hook reveal.':i===shots.length-1?'Finish with the visible payoff.':'Advance the demonstration by one clear beat.'}`;
    const objects = planned?.objects ? [...planned.objects] : [{ name: direction.changes.subject, state: 'visible in the new setting, ready to demonstrate' }];
    if (customObject && !objects.some(o=>o.name===customObject)) objects.push({name:customObject,state:'clearly visible and ready for the demonstration'});
    for (const name of referencedActionObjects(action)) if (!objects.some(o => `${o.name} ${o.state}`.toLowerCase().includes(name))) objects.push({ name, state: 'visible in its starting position, ready for the action' });
    const duration = supportedShotDuration(end - start);
    const base = SceneInput.parse({
      ...planned, environment: customSetting ?? planned?.environment ?? direction.changes.setting, action,
      endState: planned?.endState ?? `The demonstration finishes with a visible result supporting: ${direction.changes.message}`,
      camera: planned?.camera ?? shot.framing ?? shot.camera ?? 'Static medium framing',
      audio: planned?.audio ?? (speech==='voiceover' ? 'Clear original spoken explanation; no source recording or song' : 'Natural ambience; no source recording or song'),
      duration, objects, referenceIds,
      voiceover: speech==='silent' ? '' : planned?.voiceover ?? message,
      onScreenText: cleanOnScreenText(planned?.onScreenText ?? '').slice(0,200),
    });
    const prompts = buildScenePrompts({ ...base, stillPrompt: undefined, motionPrompt: undefined });
    const notes = instructions.trim() ? `\nAdditional owner direction (create original content; never source likeness): ${stripIdentity(instructions)}` : '';
    return { ...base, stillPrompt: `${prompts.stillPrompt}${notes}`, motionPrompt: `${prompts.motionPrompt}${notes}`, sourceStart:start,sourceEnd:end,sourceTimingNote: end-start===duration ? 'Source shot timing retained' : `Source shot ${Math.round((end-start)*10)/10}s; clip ${duration}s (supported 4/6/8s length)` };
  });
}