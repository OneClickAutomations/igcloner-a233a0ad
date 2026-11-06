// Server-only media persistence. CDN URLs from scrapers expire within
// hours, so every captured image/video is downloaded and stored in the
// private "source-media" bucket under {userId}/{analysisId}/. Failures are
// recorded in scrapeCoverage.notes — one bad slide never fails the run.

import type { MediaItem, StoredMediaItem } from "@/lib/source-ingest";

export const SOURCE_MEDIA_BUCKET = "source-media";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 25_000;
const CONCURRENCY = 4;

interface DownloadResult {
  item: MediaItem;
  buffer: ArrayBuffer;
  mime: string;
}

async function downloadOne(item: MediaItem): Promise<DownloadResult> {
  const cap = item.kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(item.url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        Referer: /fbcdn|facebook/i.test(item.url)
          ? "https://www.facebook.com/"
          : "https://www.instagram.com/",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const mime = res.headers.get("content-type")?.split(";")[0]?.trim()
      || (item.kind === "video" ? "video/mp4" : "image/jpeg");
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength === 0) throw new Error("empty download");
    if (buffer.byteLength > cap) {
      throw new Error(`too large (${Math.round(buffer.byteLength / 1024 / 1024)}MB > ${Math.round(cap / 1024 / 1024)}MB cap)`);
    }
    return { item, buffer, mime };
  } finally {
    clearTimeout(timer);
  }
}

function extFor(mime: string, kind: "image" | "video"): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("quicktime")) return "mov";
  if (mime.includes("webm")) return "webm";
  return kind === "video" ? "mp4" : "jpg";
}

/**
 * Download every media item (parallel, concurrency-limited) and upload to
 * storage. Returns the stored paths and human-readable failure notes.
 */
export async function persistSourceMedia(
  userId: string,
  analysisId: string,
  items: MediaItem[],
): Promise<{ storedMedia: StoredMediaItem[]; notes: string[] }> {
  const storedMedia: StoredMediaItem[] = [];
  const notes: string[] = [];
  if (items.length === 0) return { storedMedia, notes };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Small concurrency-limited pool.
  const queue = [...items];
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()!;
      const label = item.kind === "video" ? "video" : `slide ${item.index + 1}`;
      try {
        const { buffer, mime } = await downloadOne(item);
        const path = `${userId}/${analysisId}/${item.index}-${item.kind}.${extFor(mime, item.kind)}`;
        const { error } = await supabaseAdmin.storage
          .from(SOURCE_MEDIA_BUCKET)
          .upload(path, buffer, { contentType: mime, upsert: true });
        if (error) throw new Error(error.message);
        storedMedia.push({ index: item.index, kind: item.kind, path, bytes: buffer.byteLength, mime });
      } catch (e) {
        const msg = (e as Error).message;
        console.warn("[source-media] download failed", { url: item.url.slice(0, 80), msg });
        notes.push(`Couldn't save ${label}: ${msg}`);
      }
    }
  });
  await Promise.all(workers);

  storedMedia.sort((a, b) => a.index - b.index);
  return { storedMedia, notes };
}
