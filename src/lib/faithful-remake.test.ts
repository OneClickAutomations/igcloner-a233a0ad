import { describe, expect, it } from 'vitest';
import { cleanOnScreenText, DEFAULT_OUTFIT } from './faithful-remake';
import { prefillRemixScenes, startingDirections, withFaithfulFirst, faithfulDirection } from './remix-directions';

const gym = { evidence: { video: { pacing: 'slow', audio: { description: 'Breathing and barbell handling' }, shots: [{ start: 0, end: 9.8, camera: 'static', framing: 'full shot', setting: 'Indoor gym with hexagonal ceiling lights',
  onScreen: 'Barbell, weights, treadmill, skeleton prop, geometric overhead lights',
  subjects: [{ count: 1, position: 'center', action: 'Lifts a barbell from the floor overhead, pauses, and lowers it back down.' }],
  onScreenText: [{ text: 'helena_mendes12' }], audioSummary: 'Breathing, barbell settling' }] } } };

describe('faithful remake', () => {
  it('is the first and default direction', () => {
    expect(startingDirections(gym)[0].id).toBe('faithful');
    expect(withFaithfulFirst(gym, [{ ...faithfulDirection(gym), id: '1', faithful: false }])[0].id).toBe('faithful');
  });
  it('gym barbell shot keeps setting/props/pose and has no bottle, water, cup, kitchen or handle text', () => {
    const [s] = prefillRemixScenes(gym, faithfulDirection(gym), '', [], 'silent');
    const all = `${s.stillPrompt} ${s.motionPrompt} ${s.onScreenText}`;
    expect(all).not.toMatch(/bottle|\bwater\b|\bcup\b|kitchen|helena|bakeshop/i);
    expect(s.stillPrompt).toMatch(/hexagonal ceiling lights/); expect(s.stillPrompt).toMatch(/treadmill/);
    expect(s.stillPrompt).toMatch(/behind a loaded barbell/); expect(s.stillPrompt).toMatch(/9:16/);
    expect(s.onScreenText).toBe('');
    expect(s.motionPrompt).toMatch(/cleans it to the front of the shoulders.*presses it straight overhead.*lowers it under control back to the floor by 8s/);
  });
  it('blank outfit defaults to fitted athletic wear; owner edits override', () => {
    const [a] = prefillRemixScenes(gym, faithfulDirection(gym), '', [], 'silent');
    expect(a.stillPrompt).toContain(DEFAULT_OUTFIT);
    const [b] = prefillRemixScenes(gym, { ...faithfulDirection(gym), edits: { person: 'a new original woman', outfit: 'red tank top' } }, '', [], 'silent');
    expect(b.stillPrompt).toContain('a new original woman'); expect(b.stillPrompt).toContain('red tank top');
  });
  it('strips handles and watermark text and never invents text', () => {
    expect(cleanOnScreenText([{ text: 'helena_mendes12' }])).toBe('');
    expect(cleanOnScreenText('@bakeshop_daily Leg day')).toBe('Leg day');
    expect(cleanOnScreenText('bakeshop_daily')).toBe('');
  });
});

import { pickActiveDirection, needsStoryboardReplace } from './remix-directions';
import { keyframePlan } from './keyframes';
import { frameReferencedPrompt } from './faithful-remake';
describe('frame-referenced remakes', () => {
  const dirs = startingDirections({ evidence: { video: { shots: [{ start: 0, end: 9.8 }] } } });
  it('resumed draft saved on a re-theme still opens the faithful remake', () => {
    expect(pickActiveDirection(dirs, { remixDirectionId: 'practical' })?.id).toBe('faithful');
    expect(pickActiveDirection(dirs, { remixDirectionId: 'practical', remixDirectionPicked: true })?.id).toBe('practical');
  });
  it('replaces a saved re-theme storyboard when faithful is active', () => {
    expect(needsStoryboardReplace(dirs[0], [{ scene_input: { remixDirectionId: 'practical' } }])).toBe(true);
    expect(needsStoryboardReplace(dirs[0], [{ scene_input: { remixDirectionId: 'faithful', keyframes: { first: 'x' } } }], true)).toBe(false);
  });
  it('plans first, mid and last frames for a 9.8s shot', () => {
    expect(keyframePlan([{ start: 0, end: 9.8 }]).map(k => k.pos)).toEqual(['first', 'mid', 'last']);
    expect(keyframePlan([{ start: 0, end: 4 }]).map(k => k.pos)).toEqual(['first', 'last']);
  });
  it('frame prompt forbids resembling the source face', () => {
    expect(frameReferencedPrompt({ remakePerson: 'a new woman' }, 'first')).toMatch(/must NOT resemble the person in Image 1/);
  });
});
