import { z } from 'zod';
const useful = (v?: string) => v && !/^unclear$/i.test(v.trim()) ? v.trim() : '';
/** Browser-safe keyframe and appearance helpers for frame-referenced faithful remakes. */
export type KeyframePos = 'first' | 'mid' | 'last';
export type KeyframeRef = { shot: number; pos: KeyframePos; time: number; path: string };
const field = z.string().max(200).catch('unclear');
/** Ordered skin-depth scale; index distance is the "band" drift used by the look check. */
export const SKIN_BANDS = ['very light', 'light', 'light-medium', 'medium', 'medium-deep', 'deep', 'very deep'] as const;
export const Appearance = z.object({ skinTone: field, undertone: field.default('unclear'), build: field, hair: field, outfit: field, coveredOutfit: field.default('unclear'), accessories: field, footwear: field, vibe: field });
export type Appearance = z.infer<typeof Appearance>;
/** Band index for free text such as "deep brown" or "medium-deep"; -1 when unknown. Longest match wins. */
export function skinBand(text?: string): number {
  const t = String(text ?? '').toLowerCase().replace(/\s+/g, ' ');
  if (/very deep|very dark/.test(t)) return 6;
  if (/medium[- ]deep|medium[- ]dark/.test(t)) return 4;
  if (/light[- ]medium/.test(t)) return 2;
  if (/very light|very fair/.test(t)) return 0;
  if (/\bdeep\b|\bdark\b/.test(t)) return 5;
  if (/\bmedium\b|\bolive\b|\btan\b/.test(t)) return 3;
  if (/\blight\b|\bfair\b/.test(t)) return 1;
  return -1;
}
const mode = <T,>(xs: T[]): T | undefined => { const c = new Map<T, number>(); for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1); return [...c].sort((a, b) => b[1] - a[1])[0]?.[0]; };
/** Consistent answer across per-frame reads: majority skin band (ties go deeper, never lighter) and undertone; other fields from the first clear read. */
export function consensusAppearance(reads: Partial<Appearance>[]): Appearance {
  const ok = reads.filter(Boolean);
  const bands = ok.map(r => skinBand(r.skinTone)).filter(b => b >= 0);
  const counts = SKIN_BANDS.map((_, i) => bands.filter(b => b === i).length); const top = Math.max(0, ...counts);
  const band = bands.length ? counts.lastIndexOf(top) : -1;
  // Medoid: the reading that agrees most with the others; "none" loses to a read that saw something.
  const words = (t: string) => new Set(t.toLowerCase().match(/[a-z]+/g) ?? []);
  const pick = (k: keyof Appearance) => {
    let vals = ok.map(r => useful(r[k] as string)).filter(Boolean);
    const seen = vals.filter(v => !/^none( visible)?$/i.test(v)); if (seen.length) vals = seen;
    if (!vals.length) return 'unclear';
    const score = (v: string) => vals.reduce((n, o) => n + [...words(v)].filter(w => words(o).has(w)).length, 0);
    return [...vals].sort((a, b) => score(b) - score(a))[0];
  };
  return Appearance.parse({ skinTone: band >= 0 ? `${SKIN_BANDS[band]} brown` .replace(/^(very light|light) brown$/, '$1') : pick('skinTone'), undertone: mode(ok.map(r => useful(r.undertone)?.toLowerCase()).filter(Boolean) as string[]) ?? 'unclear', build: pick('build'), hair: pick('hair'), outfit: pick('outfit'), coveredOutfit: (() => { const o = pick('outfit'); return useful(ok.find(r => useful(r.outfit) === o)?.coveredOutfit) || 'unclear'; })(), accessories: pick('accessories'), footwear: pick('footwear'), vibe: pick('vibe') });
}
/** Leading, explicit skin and build lock for image prompts. */
export function lookLock(a?: Partial<Appearance> | null): string {
  if (!a) return '';
  const skin = useful(a.skinTone), under = useful(a.undertone), build = useful(a.build);
  return [skin && `Skin: ${skin} skin${under ? ` with a ${under} undertone` : ''} — keep exactly this depth, do not lighten or darken it.`, build && `Build: ${build} — keep this physique, do not slim it.`].filter(Boolean).join(' ');
}
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
/** Editable "Person" text built from style fields only. */
export function personFromAppearance(a?: Partial<Appearance> | null): string {
  if (!a) return '';
  return [useful(a.skinTone) && `${useful(a.skinTone)} skin${useful(a.undertone) ? ` (${useful(a.undertone)} undertone)` : ''}`, useful(a.build) && `${useful(a.build)} build`, useful(a.hair) && `hair: ${useful(a.hair)}`, useful(a.accessories) && useful(a.accessories), useful(a.footwear) && useful(a.footwear), useful(a.vibe) && `${useful(a.vibe)} energy`].filter(Boolean).join(', ');
}
export function outfitFromAppearance(a?: Partial<Appearance> | null): string { return useful(a?.outfit); }
/** Closest more-covered version of the source outfit in the same colour, for one provider-refusal retry. */
export function coveredOutfit(a?: Partial<Appearance> | null, requestedOutfit?: string): string {
  const c = useful(a?.coveredOutfit); if (c && !requestedOutfit?.trim()) return c;
  const colour = useful(requestedOutfit || a?.outfit).match(/\b(white|black|grey|gray|beige|cream|red|pink|navy|green|olive|brown|tan|purple|yellow|orange)\b/i)?.[1];
  return colour ? `a ${colour} sports bra with a ${colour} fitted crop top over it and ${colour} mid-thigh bike shorts` : '';
}
