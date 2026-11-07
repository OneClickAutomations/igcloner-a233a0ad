// Browser-safe pure rules for the four copy modes: rights, availability,
// text-match quality gate, retry/refund decisions, and image sizing.
import type { CloneMethod } from "@/lib/clone-modes";

// ── Rights confirmation ─────────────────────────────────────────────
export const RIGHTS_STATEMENT_VERSION = "2026-11-06.v1";
export const RIGHTS_STATEMENT = "I own this content or have permission from the owner to use it.";
export const RIGHTS_NOTE =
  "Reposting someone else's photos or videos without permission can violate copyright and platform rules. You are responsible for what you publish.";

/** A0 and A1 reuse the creator's actual media and need a rights confirmation. */
export function requiresRights(mode: string): boolean {
  return mode === "A0" || mode === "A1";
}

export interface RightsRow { analysis_id: string; mode: string; statement_version: string }

/** Throws unless a matching confirmation exists. Used server-side by every A0/A1 entry point. */
export function assertRightsConfirmed(mode: string, analysisId: string | null | undefined, rows: RightsRow[]): void {
  if (!requiresRights(mode)) return;
  const ok = !!analysisId && rows.some((r) => r.analysis_id === analysisId && r.mode === mode && r.statement_version === RIGHTS_STATEMENT_VERSION);
  if (!ok) throw new Error("RIGHTS_REQUIRED: Confirm you own this content or have the owner's permission before using its media.");
}

// ── Availability ────────────────────────────────────────────────────
export interface StoredRef { index: number; kind: "image" | "video"; path: string; variant?: "hd" | "sd" }
export interface AvailabilityInput {
  postType: string | null | undefined;
  storedMedia: StoredRef[] | null | undefined;
  expectedSlides: number;
  slidesWithText: number;
}
export interface Availability { available: boolean; reason: string | null }

const isVideoPost = (t?: string | null) => t === "Reel" || t === "Video";

export function modeAvailability(mode: CloneMethod, a: AvailabilityInput): Availability {
  const stored = a.storedMedia ?? [];
  const images = stored.filter((m) => m.kind === "image");
  const videos = stored.filter((m) => m.kind === "video" && m.variant !== "sd");
  if (mode === "A0") {
    if (stored.length === 0) return { available: false, reason: "Only the thumbnail was saved — can't make an exact copy." };
    if (isVideoPost(a.postType)) {
      return videos.length || stored.some((m) => m.kind === "video")
        ? { available: true, reason: null }
        : { available: false, reason: "The video file wasn't saved — only the cover image. Can't make an exact copy." };
    }
    if (a.expectedSlides > 0 && images.length < a.expectedSlides)
      return { available: false, reason: `Only ${images.length} of ${a.expectedSlides} slides were saved — can't make an exact copy.` };
    return { available: true, reason: null };
  }
  if (mode === "A1") {
    if (isVideoPost(a.postType)) {
      return stored.some((m) => m.kind === "video")
        ? { available: true, reason: null }
        : { available: false, reason: "The video file wasn't saved, so its look can't be reused." };
    }
    if (images.length === 0) return { available: false, reason: "The original image wasn't saved, so its look can't be reused." };
    if (a.slidesWithText === 0) return { available: true, reason: "No text was found on these slides — only the caption will change." };
    return { available: true, reason: null };
  }
  return { available: true, reason: null };
}

// ── Text-match quality gate ─────────────────────────────────────────
export function normalizeText(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\p{P}+/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = tmp;
    }
  }
  return prev[b.length];
}

export type TextVerdict = "exact" | "near" | "miss";

/** Exact after whitespace/case normalization passes; anything else fails the gate. */
export function compareText(intended: string, observed: string): { verdict: TextVerdict; similarity: number } {
  const a = normalizeText(intended), b = normalizeText(observed);
  if (a === b) return { verdict: "exact", similarity: 1 };
  const max = Math.max(a.length, b.length) || 1;
  const similarity = Math.round((1 - levenshtein(a, b) / max) * 1000) / 1000;
  return { verdict: similarity >= 0.85 ? "near" : "miss", similarity };
}

export interface VerificationResult {
  observedText: string;
  residualOriginalText: string[];
  sameComposition: boolean;
  compositionNote: string;
}

export interface GateResult { pass: boolean; textVerdict: TextVerdict; similarity: number; problems: string[] }

export function gateCheck(intended: string, v: VerificationResult): GateResult {
  const { verdict, similarity } = compareText(intended, v.observedText);
  const problems: string[] = [];
  if (verdict !== "exact") problems.push(`Text reads "${v.observedText.replace(/\s+/g, " ").trim()}" instead of "${intended.replace(/\s+/g, " ").trim()}".`);
  const residual = v.residualOriginalText.map((t) => t.trim()).filter(Boolean);
  if (residual.length) problems.push(`Original text is still visible: ${residual.map((t) => `"${t}"`).join(", ")}.`);
  if (!v.sameComposition) problems.push(`The picture changed: ${v.compositionNote || "composition differs from the original"}.`);
  return { pass: problems.length === 0, textVerdict: verdict, similarity, problems };
}

export const MAX_TEXT_EDIT_RETRIES = 2;

/** After attempt N (0-based) decide: accept, retry free, or flag + refund. */
export function nextGateAction(attempt: number, gate: GateResult): "accept" | "retry" | "flag" {
  if (gate.pass) return "accept";
  return attempt < MAX_TEXT_EDIT_RETRIES ? "retry" : "flag";
}

/** Prefer the attempt with fewest problems, then highest text similarity. */
export function pickBestAttempt<T extends { gate: GateResult }>(attempts: T[]): T {
  return [...attempts].sort((x, y) => x.gate.problems.length - y.gate.problems.length || y.gate.similarity - x.gate.similarity)[0];
}

/** Slides that need regeneration (have text and new text differs). No-text slides pass through free. */
export function slidesToRegenerate(slides: { index: number; exactText: string }[], newText: Record<number, string>): number[] {
  return slides.filter((s) => s.exactText.trim() && (newText[s.index] ?? "").trim() && normalizeText(newText[s.index]) !== normalizeText(s.exactText)).map((s) => s.index);
}

// ── Image sizing ────────────────────────────────────────────────────
/** Read width/height from a PNG, JPEG, or WebP header. */
export function imageSize(b: Uint8Array): { width: number; height: number } | null {
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50) {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    return { width: dv.getUint32(16), height: dv.getUint32(20) };
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      const len = (b[i + 2] << 8) | b[i + 3];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
      }
      i += 2 + len;
    }
    return null;
  }
  if (b.length > 30 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    const tag = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (tag === "VP8X") return { width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
    if (tag === "VP8 ") return { width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff };
    if (tag === "VP8L") { const v = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24); return { width: (v & 0x3fff) + 1, height: ((v >> 14) & 0x3fff) + 1 }; }
  }
  return null;
}

/**
 * OpenAI image size matching the source aspect: multiples of 16, total
 * pixels within 655,360–8,294,400, edges ≤ 3840, ratio clamped to 1:3–3:1.
 */
export function openAiSizeFor(width: number, height: number): string {
  let ratio = width / height;
  ratio = Math.min(3, Math.max(1 / 3, ratio));
  const target = Math.min(Math.max(width * height, 1_048_576), 2_359_296);
  let h = Math.sqrt(target / ratio);
  let w = h * ratio;
  if (w > 3840) { w = 3840; h = w / ratio; }
  if (h > 3840) { h = 3840; w = h * ratio; }
  const r16 = (n: number) => Math.max(16, Math.round(n / 16) * 16);
  return `${r16(w)}x${r16(h)}`;
}
