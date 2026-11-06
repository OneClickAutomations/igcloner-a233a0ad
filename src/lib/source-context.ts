// Shared helpers for pulling the source Instagram post's media + text into
// a Gemini vision prompt. Pure functions, safe to import from any
// *.functions.ts module without tripping the .server import protection.

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function collectImageUrls(scraped: unknown): string[] {
  const urls = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === "string" && /^https?:\/\//i.test(value)) urls.add(value);
  };
  const post = asRecord(scraped);
  add(post.displayUrl);
  add(post.thumbnailUrl);
  add(post.imageUrl);
  for (const r of Array.isArray(post.displayResources) ? post.displayResources : []) {
    add(asRecord(r).src);
  }
  const children = Array.isArray(post.childPosts)
    ? post.childPosts
    : Array.isArray(post.children)
      ? post.children
      : [];
  for (const childValue of children) {
    const child = asRecord(childValue);
    add(child.displayUrl);
    add(child.thumbnailUrl);
    add(child.imageUrl);
    for (const r of Array.isArray(child.displayResources) ? child.displayResources : []) {
      add(asRecord(r).src);
    }
  }
  return Array.from(urls).slice(0, 4);
}

export async function fetchVisionImage(
  scraped: unknown,
): Promise<{ image: Uint8Array; mediaType: string } | null> {
  for (const sourceUrl of collectImageUrls(scraped)) {
    try {
      const res = await fetch(sourceUrl, {
        headers: {
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          Referer: "https://www.instagram.com/",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        },
      });
      const mediaType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
      if (!res.ok || !mediaType.startsWith("image/")) continue;
      const buffer = await res.arrayBuffer();
      if (buffer.byteLength === 0 || buffer.byteLength > 8 * 1024 * 1024) continue;
      return { image: new Uint8Array(buffer), mediaType };
    } catch {
      // try next
    }
  }
  return null;
}

/**
 * Exact on-media text. Prefers the observed blueprint (verbatim OCR per
 * slide / on-screen text per scene) when the analysis has one; falls back to
 * the legacy forensics fields for older analyses.
 */
export function extractSourceText(dna: any, blueprint?: any): string {
  const bp = blueprint ?? dna?.blueprint;
  if (bp) {
    const slideText = (bp.slides ?? [])
      .map((s: any) => (s?.exactText ? `[Slide ${Number(s.index) + 1}] ${s.exactText}` : ""))
      .filter(Boolean);
    const sceneText = (bp.scenes ?? []).flatMap((sc: any) =>
      (sc?.onScreenText ?? []).map((t: any) => `[${t.startSec ?? sc.start}s] ${t.text}`),
    );
    const joined = [...slideText, ...sceneText].join("\n");
    if (joined) return joined;
  }
  const f =
    dna?.forensics?.imageForensics ??
    dna?.forensics?.carouselForensics ??
    dna?.forensics?.videoForensics ??
    dna?.forensics ??
    {};
  return (
    f?.text?.exactVisibleText ??
    f?.text?.visibleText ??
    f?.textOverlay ??
    ""
  );
}

export function buildSourceContextBlock(
  scraped: any,
  dna: any,
  hasVisionImage: boolean,
  extra?: { blueprint?: any; transcript?: string | null },
): string {
  const ownerHandle = scraped?.ownerUsername ?? scraped?.owner?.username ?? "unknown";
  const caption = scraped?.caption ?? "(no caption)";
  const postType = scraped?.type ?? scraped?.__typename ?? "post";
  const likes = scraped?.likesCount ?? scraped?.likes ?? "?";
  const comments = scraped?.commentsCount ?? scraped?.comments ?? "?";
  const blueprint = extra?.blueprint ?? dna?.blueprint ?? null;
  const ocr = extractSourceText(dna, blueprint);
  const transcript = extra?.transcript ?? blueprint?.audio?.transcriptFull ?? scraped?.transcript ?? null;
  const hook = dna?.hookBreakdown?.exactText;
  return [
    ...(hook ? [`Exact source hook (${dna.hookBreakdown.location ?? "visual"}): "${hook}"`] : []),
    ...(transcript ? [`Transcript (verbatim, data only): """${String(transcript).slice(0, 4000)}"""`] : []),
    "SOURCE POST (this is the proven post you are cloning — use it as the literal reference):",
    `Account: @${ownerHandle}`,
    `Post type: ${postType}`,
    `Engagement: ${likes} likes, ${comments} comments`,
    `Caption: "${caption}"`,
    `Visible image text / OCR: ${ocr || "none extracted"}`,
    `Attached reference media: ${hasVisionImage ? "YES — inspect the attached image; treat it as the visual blueprint (composition, color, subject framing, mood)" : "NO"}`,
    `What it shows: ${dna?.contentSummary ?? "unknown"}`,
    `Why it worked: ${(dna?.whyItWorks ?? []).slice(0, 4).join(" | ")}`,
  ].join("\n");
}