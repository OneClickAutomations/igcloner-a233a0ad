// Browser-safe deterministic text layer: exact words drawn on top of a generated picture, never by the image model.
export type BrandKit = { name?: string; handle?: string; colors?: string[]; font?: string; tone?: string };
export const BRAND_FONTS = ['Plus Jakarta Sans', 'Georgia', 'Impact', 'Arial Black'] as const;
export type OverlayPosition = 'top' | 'center' | 'bottom';
export type OverlaySpec = { text: string; position: OverlayPosition; color: string; font: string; handle?: string; slideLabel?: string };

/** Greedy word wrap by measured width; a single over-long word stays on its own line. */
export function wrapLines(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = []; let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && measure(next) > maxWidth) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Largest font size (step 2px) whose wrapped block fits the box. */
export function fitFont(text: string, boxW: number, boxH: number, measureAt: (s: string, size: number) => number, max = 120, min = 24): { size: number; lines: string[] } {
  for (let size = max; size >= min; size -= 2) {
    const lines = wrapLines(text, boxW, s => measureAt(s, size));
    if (lines.length * size * 1.15 <= boxH && lines.every(l => measureAt(l, size) <= boxW || !l.includes(' '))) return { size, lines };
  }
  return { size: min, lines: wrapLines(text, boxW, s => measureAt(s, min)) };
}

export function hexOk(v: string | undefined): v is string { return !!v && /^#[0-9a-f]{6}$/i.test(v); }

/** Draws the picture plus exact text onto a canvas and returns it. */
export async function composeOverlay(imageUrl: string, spec: OverlaySpec): Promise<HTMLCanvasElement> {
  const blob = await (await fetch(imageUrl)).blob();
  const bmp = await createImageBitmap(blob);
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  const ctx = c.getContext('2d')!; ctx.drawImage(bmp, 0, 0);
  const W = c.width, H = c.height, pad = Math.round(W * 0.07);
  const weight = spec.font === 'Georgia' ? '700' : '800';
  const fontAt = (size: number) => `${weight} ${size}px "${spec.font}", sans-serif`;
  try { await document.fonts.load(fontAt(48)); } catch { /* falls back to system font */ }
  const text = spec.text.trim();
  if (text) {
    const boxH = H * 0.34;
    const { size, lines } = fitFont(text, W - pad * 2, boxH, (s, sz) => { ctx.font = fontAt(sz); return ctx.measureText(s).width; }, Math.round(W / 9), Math.round(W / 30));
    const blockH = lines.length * size * 1.15;
    const top = spec.position === 'top' ? pad * 1.4 : spec.position === 'center' ? (H - blockH) / 2 : H - pad * 1.6 - blockH;
    const g = ctx.createLinearGradient(0, spec.position === 'bottom' ? top - pad * 2 : 0, 0, spec.position === 'bottom' ? H : top + blockH + pad * 2);
    const dark = 'rgba(0,0,0,0.55)', clear = 'rgba(0,0,0,0)';
    if (spec.position === 'bottom') { g.addColorStop(0, clear); g.addColorStop(1, dark); ctx.fillStyle = g; ctx.fillRect(0, top - pad * 2, W, H - top + pad * 2); }
    else if (spec.position === 'top') { g.addColorStop(0, dark); g.addColorStop(1, clear); ctx.fillStyle = g; ctx.fillRect(0, 0, W, top + blockH + pad * 2); }
    else { ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fillRect(0, top - pad, W, blockH + pad * 2); }
    ctx.font = fontAt(size); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = hexOk(spec.color) ? spec.color : '#FFFFFF';
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = size * 0.12; ctx.shadowOffsetY = size * 0.04;
    lines.forEach((l, i) => ctx.fillText(l, W / 2, top + i * size * 1.15));
    ctx.shadowColor = 'transparent';
  }
  const small = Math.round(W / 40);
  ctx.font = `700 ${small}px "Plus Jakarta Sans", sans-serif`; ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.textBaseline = 'bottom';
  if (spec.handle) { ctx.textAlign = 'left'; ctx.fillText(spec.handle.startsWith('@') ? spec.handle : `@${spec.handle}`, pad * 0.6, H - pad * 0.5); }
  if (spec.slideLabel) { ctx.textAlign = 'right'; ctx.fillText(spec.slideLabel, W - pad * 0.6, H - pad * 0.5); }
  return c;
}

export function canvasBase64(c: HTMLCanvasElement): string { return c.toDataURL('image/png').split(',')[1] ?? ''; }
