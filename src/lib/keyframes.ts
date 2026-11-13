import { z } from 'zod';
/** Browser-safe keyframe and appearance helpers for frame-referenced faithful remakes. */
export type KeyframePos = 'first' | 'mid' | 'last';
export type KeyframeRef = { shot: number; pos: KeyframePos; time: number; path: string };
const field = z.string().max(200).catch('unclear');
export const Appearance = z.object({ skinTone: field, build: field, hair: field, outfit: field, accessories: field, footwear: field, vibe: field });
export type Appearance = z.infer<typeof Appearance>;

/** First and last frame for every shot, plus the mid-point for shots over 6s. Times stay inside the shot. */
export function keyframePlan(shots: any[]): { shot: number; pos: KeyframePos; time: number }[] {
  return shots.flatMap((s, i) => {
    const start = Number(s.start ?? 0), end = Number(s.end ?? start + 1);
    const out: { shot: number; pos: KeyframePos; time: number }[] = [{ shot: i, pos: 'first', time: Math.round((start + 0.05) * 100) / 100 }];
    if (end - start > 6) out.push({ shot: i, pos: 'mid', time: Math.round(((start + end) / 2) * 100) / 100 });
    out.push({ shot: i, pos: 'last', time: Math.round(Math.max(start, end - 0.15) * 100) / 100 });
    return out;
  });
}
const useful = (v?: string) => v && !/^unclear$/i.test(v.trim()) ? v.trim() : '';
/** Editable "Person" text built from style fields only. */
export function personFromAppearance(a?: Partial<Appearance> | null): string {
  if (!a) return '';
  return [useful(a.skinTone) && `${useful(a.skinTone)} skin`, useful(a.build) && `${useful(a.build)} build`, useful(a.hair) && `hair: ${useful(a.hair)}`, useful(a.accessories) && useful(a.accessories), useful(a.footwear) && useful(a.footwear), useful(a.vibe) && `${useful(a.vibe)} energy`].filter(Boolean).join(', ');
}
export function outfitFromAppearance(a?: Partial<Appearance> | null): string { return useful(a?.outfit); }
