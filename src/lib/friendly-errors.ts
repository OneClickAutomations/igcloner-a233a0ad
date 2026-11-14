/** Browser-safe: turns raw provider safety rejections into plain guidance. */
const SAFETY = /usage guidelines|violat|safety|responsible ai|content policy|blocked|moderation|support codes?:/i;
export function friendlyVideoError(raw?: string | null): string | null {
  if (!raw) return raw ?? null;
  if (SAFETY.test(raw)) {
    return "Google's safety check wouldn't animate this still. This usually happens with realistic close-up faces, swimwear, or other people in the background. Your video credits for this try are refunded. Regenerate the still with a wider shot, sportswear, or a blurred background, then animate again.";
  }
  return raw;
}
