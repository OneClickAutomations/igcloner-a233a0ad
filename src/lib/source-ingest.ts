// ─────────────────────────────────────────────────────────────────────
// Source ingest — URL classification, share-link resolution, and
// normalization of scraped Instagram/Facebook posts into one honest
// "source package". Pure and browser-safe except resolveCanonicalUrl,
// which takes an injectable fetch so it is testable and server-only in
// practice.
// ─────────────────────────────────────────────────────────────────────

export type SourceKind = "Image" | "Carousel" | "Reel" | "Video" | "Post";
export type SourcePlatform = "instagram" | "facebook";

export interface ClassifiedUrl {
  platform: SourcePlatform;
  /** Provisional kind from the URL alone. IG /p/ is "Image" until the
   *  scrape reveals childPosts (Carousel); share links are "Post" until
   *  resolved. */
  kind: SourceKind;
  /** True when the kind can only be confirmed from scraped data. */
  provisional: boolean;
  /** True for share/short links that must be redirect-resolved first. */
  shareLink: boolean;
}

const IG_HOST = /(^|\.)(instagram\.com)$/i;
const FB_HOST = /(^|\.)(facebook\.com|fb\.watch|fb\.com)$/i;

export function isSupportedSocialUrl(u: string): boolean {
  try {
    const h = new URL(u).hostname;
    return IG_HOST.test(h) || FB_HOST.test(h);
  } catch {
    return false;
  }
}

export function isFacebookUrl(u: string): boolean {
  try {
    return FB_HOST.test(new URL(u).hostname);
  } catch {
    return false;
  }
}

/** Classify a post URL. Share links must be resolved before this is final. */
export function classifySourceUrl(rawUrl: string): ClassifiedUrl | null {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  const path = u.pathname.toLowerCase();
  const host = u.hostname.toLowerCase();

  if (IG_HOST.test(host)) {
    if (path.startsWith("/share/")) return { platform: "instagram", kind: "Post", provisional: true, shareLink: true };
    if (path.includes("/reel/") || path.includes("/reels/") || path.includes("/tv/"))
      return { platform: "instagram", kind: "Reel", provisional: false, shareLink: false };
    if (path.includes("/p/"))
      // A /p/ URL is a single image OR a carousel — only the scraped
      // childPosts/sidecar data can tell them apart.
      return { platform: "instagram", kind: "Image", provisional: true, shareLink: false };
    return { platform: "instagram", kind: "Post", provisional: true, shareLink: false };
  }

  if (FB_HOST.test(host)) {
    if (host.endsWith("fb.watch"))
      return { platform: "facebook", kind: "Video", provisional: true, shareLink: true };
    if (path.startsWith("/share/"))
      return { platform: "facebook", kind: "Post", provisional: true, shareLink: true };
    if (path.includes("/reel/") || path.includes("/reels/"))
      return { platform: "facebook", kind: "Reel", provisional: false, shareLink: false };
    if (path.includes("/watch") || path.includes("/videos/"))
      return { platform: "facebook", kind: "Video", provisional: false, shareLink: false };
    if (
      path.includes("/posts/") ||
      path.includes("/permalink.php") ||
      path.includes("/photo") ||
      path.includes("/story.php")
    )
      return { platform: "facebook", kind: "Post", provisional: false, shareLink: false };
    return { platform: "facebook", kind: "Post", provisional: true, shareLink: false };
  }

  return null;
}

// ── Share-link / short-link resolution ───────────────────────────────

const TRACKING_PARAMS = new Set([
  "fbclid", "gclid", "dclid", "igsh", "igshid", "mibextid", "ref", "ref_src",
  "s", "fs", "m", "rdid", "share_url", "si", "feature", "kw",
]);

export function stripTrackingParams(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith("utm_")) {
        u.searchParams.delete(key);
      }
    }
    return u.toString();
  } catch {
    return rawUrl;
  }
}

export interface ResolvedUrl {
  /** Canonical URL after redirects, tracking params stripped. */
  canonicalUrl: string;
  /** The URL the user actually pasted (kept for display). */
  originalUrl: string;
  /** How many redirects were followed. */
  hops: number;
}

type FetchLike = (url: string, init?: any) => Promise<{ status: number; headers: { get(name: string): string | null } }>;

/**
 * Follow redirects server-side (max 5 hops, 5s per hop) to turn share/short
 * links into the canonical post URL before classification.
 */
export async function resolveCanonicalUrl(
  rawUrl: string,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
  maxHops = 5,
): Promise<ResolvedUrl> {
  let current = rawUrl;
  let hops = 0;
  while (hops < maxHops) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await fetchImpl(current, {
        method: "HEAD",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        },
      });
    } catch (e) {
      // Timeout / network error: keep the best URL we have.
      console.warn("[ingest] redirect resolution stopped:", (e as Error).message);
      break;
    } finally {
      clearTimeout(timer);
    }
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current).toString();
      hops++;
      continue;
    }
    break;
  }
  return { canonicalUrl: stripTrackingParams(current), originalUrl: rawUrl, hops };
}

// ── Normalized source package ────────────────────────────────────────

export interface MediaItem {
  index: number;
  kind: "image" | "video";
  url: string;
  width?: number;
  height?: number;
  durationSec?: number;
}

export interface ScrapeCoverage {
  slidesExpected: number;
  slidesCaptured: number;
  videoCaptured: boolean;
  transcriptCaptured: boolean;
  thumbnailOnly: boolean;
  notes: string[];
}

export interface ScrapedPost {
  caption: string;
  ownerUsername: string;
  likesCount: number;
  commentsCount: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  hashtags?: string[];
  mentions?: string[];
  type: string;
  url: string;
  displayUrl?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  productType?: string;
  timestamp?: string;
  locationName?: string;
  isSponsored?: boolean;
  firstComment?: string;
  musicInfo?: any;
  owner?: {
    username?: string;
    fullName?: string;
    followersCount?: number;
    followingCount?: number;
    mediaCount?: number;
    verified?: boolean;
    isBusinessAccount?: boolean;
    biography?: string;
    externalUrl?: string;
    profilePicUrl?: string;
    businessCategoryName?: string;
    isPrivate?: boolean;
  };
  // ── Source package extensions ──
  mediaItems: MediaItem[];
  primaryVideoUrl?: string;
  durationSec?: number;
  transcript?: string;
  audio?: { title?: string; artist?: string; original?: boolean };
  scrapeCoverage: ScrapeCoverage;
  /** Storage paths of persisted media, filled after download. */
  storedMedia?: StoredMediaItem[];
}

export interface StoredMediaItem {
  index: number;
  kind: "image" | "video";
  path: string;
  bytes: number;
  mime: string;
}

const MAX_CAROUSEL_SLIDES = 20;

function hashtagsFrom(text: string): string[] {
  return Array.from(new Set((text.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((h) => h.slice(1))));
}

function mentionsFrom(text: string): string[] {
  return Array.from(new Set((text.match(/@[\w.]+/g) ?? []).map((m) => m.slice(1))));
}

/** Decide the final storage type from the scraped data, not the URL. */
export function finalKindFromData(classified: ClassifiedUrl, post: { mediaItems: MediaItem[]; productType?: string; type?: string }): SourceKind {
  if (classified.platform === "instagram") {
    if (classified.kind === "Reel") return "Reel";
    const slides = post.mediaItems.length;
    const hasVideo = post.mediaItems.some((m) => m.kind === "video");
    if (slides > 1) return "Carousel";
    if (hasVideo || post.productType === "clips" || post.type === "Video") return "Reel";
    return "Image";
  }
  // Facebook
  if (classified.kind === "Reel") return "Reel";
  if (classified.kind === "Video") return "Video";
  const hasVideo = post.mediaItems.some((m) => m.kind === "video");
  if (hasVideo && post.mediaItems.length === 1) return "Video";
  if (post.mediaItems.length > 1) return "Carousel";
  return "Post";
}

// ── Instagram normalization ──────────────────────────────────────────

export function normalizeInstagramPost(raw: any, requestedUrl: string, provisional: ClassifiedUrl): ScrapedPost {
  const children: any[] = Array.isArray(raw?.childPosts) ? raw.childPosts : [];
  const mediaItems: MediaItem[] = [];

  if (children.length > 0) {
    for (const child of children.slice(0, MAX_CAROUSEL_SLIDES)) {
      const isVideo = child?.type === "Video" || Boolean(child?.videoUrl);
      const url = isVideo ? child?.videoUrl : child?.displayUrl;
      if (typeof url === "string" && url.startsWith("http")) {
        mediaItems.push({
          index: mediaItems.length,
          kind: isVideo ? "video" : "image",
          url,
          width: Number(child?.dimensionsWidth) || undefined,
          height: Number(child?.dimensionsHeight) || undefined,
          durationSec: Number(child?.videoDuration) || undefined,
        });
      }
    }
  } else {
    const isVideo = raw?.type === "Video" || Boolean(raw?.videoUrl) || raw?.productType === "clips";
    const url = isVideo ? raw?.videoUrl : raw?.displayUrl;
    if (typeof url === "string" && url.startsWith("http")) {
      mediaItems.push({
        index: 0,
        kind: isVideo ? "video" : "image",
        url,
        width: Number(raw?.dimensionsWidth) || undefined,
        height: Number(raw?.dimensionsHeight) || undefined,
        durationSec: Number(raw?.videoDuration) || undefined,
      });
    }
  }

  const caption = String(raw?.caption ?? "");
  const music = raw?.musicInfo ?? raw?.clipsMetadata?.musicInfo ?? null;
  const audio = music
    ? {
        title: music.song_name ?? music.songName ?? music.track_name ?? undefined,
        artist: music.artist_name ?? music.artistName ?? music.display_artist ?? undefined,
        original: music.uses_original_audio ?? music.isOriginalAudio ?? undefined,
      }
    : undefined;

  const slidesExpected = children.length > 0 ? children.length : mediaItems.length;
  const videoCaptured = mediaItems.some((m) => m.kind === "video");
  const notes: string[] = [];
  if (children.length > MAX_CAROUSEL_SLIDES) {
    notes.push(`Carousel has ${children.length} slides; captured the first ${MAX_CAROUSEL_SLIDES}.`);
  }
  if ((raw?.type === "Video" || raw?.productType === "clips") && !videoCaptured) {
    notes.push("Video URL missing from scrape — thumbnail only.");
  }

  const post: ScrapedPost = {
    caption,
    ownerUsername: raw?.ownerUsername ?? raw?.owner?.username ?? "unknown",
    likesCount: Number(raw?.likesCount ?? 0) || 0,
    commentsCount: Number(raw?.commentsCount ?? 0) || 0,
    videoViewCount: Number(raw?.videoViewCount ?? 0) || undefined,
    videoPlayCount: Number(raw?.videoPlayCount ?? 0) || undefined,
    hashtags: Array.isArray(raw?.hashtags) && raw.hashtags.length ? raw.hashtags : hashtagsFrom(caption),
    mentions: Array.isArray(raw?.mentions) && raw.mentions.length ? raw.mentions : mentionsFrom(caption),
    type: raw?.type ?? provisional.kind,
    url: raw?.url ?? requestedUrl,
    displayUrl: raw?.displayUrl,
    thumbnailUrl: raw?.displayUrl,
    videoUrl: raw?.videoUrl,
    productType: raw?.productType,
    timestamp: raw?.timestamp,
    locationName: raw?.locationName ?? raw?.location?.name ?? undefined,
    isSponsored: Boolean(raw?.isSponsored),
    firstComment: raw?.firstComment,
    musicInfo: raw?.musicInfo,
    owner: raw?.owner,
    mediaItems,
    primaryVideoUrl: mediaItems.find((m) => m.kind === "video")?.url,
    durationSec: Number(raw?.videoDuration) || mediaItems.find((m) => m.durationSec)?.durationSec,
    audio,
    scrapeCoverage: {
      slidesExpected,
      slidesCaptured: mediaItems.length,
      videoCaptured,
      transcriptCaptured: false,
      thumbnailOnly: (raw?.type === "Video" || raw?.productType === "clips") && !videoCaptured,
      notes,
    },
  };
  post.type = finalKindFromData(provisional, post);
  return post;
}

// ── Facebook reels normalization (apify~facebook-reels-scraper) ──────
// Field names verified against a live run of build 0.0.323 (Nov 2026).

export function normalizeFacebookReel(raw: any, requestedUrl: string): ScrapedPost {
  const caption = String(raw?.text ?? "");
  const playback = raw?.playback_video ?? {};
  const legacy = playback?.videoDeliveryLegacyFields ?? {};
  const videoUrl =
    legacy?.browser_native_hd_url ?? legacy?.browser_native_sd_url ?? undefined;
  const thumb =
    raw?.video?.first_frame_thumbnail ??
    playback?.thumbnailImage?.uri ??
    playback?.preferred_thumbnail?.image?.uri ??
    undefined;
  const durationSec = Number(playback?.length_in_second) || undefined;
  const owner = raw?.video_owner ?? {};

  const mediaItems: MediaItem[] = [];
  if (typeof videoUrl === "string" && videoUrl.startsWith("http")) {
    mediaItems.push({
      index: 0,
      kind: "video",
      url: videoUrl,
      width: Number(playback?.width) || undefined,
      height: Number(playback?.height) || undefined,
      durationSec,
    });
  }
  if (mediaItems.length === 0 && typeof thumb === "string" && thumb.startsWith("http")) {
    mediaItems.push({ index: 0, kind: "image", url: thumb });
  }

  const notes: string[] = [];
  if (mediaItems.length === 0) notes.push("No playable video URL in scrape — thumbnail only.");
  if (mediaItems[0]?.kind === "image") notes.push("Video couldn't be captured — thumbnail only.");

  const audio = raw?.track_title
    ? { title: String(raw.track_title), original: Boolean(raw?.is_original_audio_on_facebook) }
    : undefined;

  return {
    caption,
    ownerUsername: owner?.name ?? "facebook",
    likesCount: Number(raw?.likes ?? raw?.likesCount ?? 0) || 0,
    commentsCount: Number(raw?.comments ?? raw?.commentsCount ?? 0) || 0,
    videoPlayCount: Number(raw?.play_count ?? raw?.playCountRounded ?? 0) || undefined,
    hashtags: hashtagsFrom(caption),
    mentions: mentionsFrom(caption),
    type: "Reel",
    url: raw?.facebookUrl ?? raw?.topLevelReelUrl ?? requestedUrl,
    displayUrl: thumb,
    thumbnailUrl: thumb,
    videoUrl,
    timestamp: raw?.time ?? undefined,
    owner: {
      username: owner?.name ?? undefined,
      fullName: owner?.name ?? undefined,
      verified: Boolean(owner?.is_verified),
      externalUrl: owner?.url ?? undefined,
      profilePicUrl: owner?.displayPicture?.uri ?? undefined,
    },
    mediaItems,
    primaryVideoUrl: mediaItems.find((m) => m.kind === "video")?.url,
    durationSec,
    // SRT caption file URL — downloaded and inlined by the ingest pipeline.
    transcript: undefined,
    audio,
    scrapeCoverage: {
      slidesExpected: 1,
      slidesCaptured: mediaItems.length,
      videoCaptured: mediaItems.some((m) => m.kind === "video"),
      transcriptCaptured: Boolean(playback?.captions_url),
      thumbnailOnly: !mediaItems.some((m) => m.kind === "video"),
      notes,
    },
    // Keep the captions URL reachable for the transcript fetch step.
    ...(playback?.captions_url ? { captionsUrl: playback.captions_url } : {}),
  } as ScrapedPost & { captionsUrl?: string };
}

// ── Facebook posts normalization (apify~facebook-posts-scraper) ──────

export function normalizeFacebookPost(raw: any, requestedUrl: string, provisional: ClassifiedUrl): ScrapedPost {
  const text: string = raw?.text ?? raw?.message ?? raw?.postText ?? "";
  const media = Array.isArray(raw?.media) ? raw.media : [];

  const mediaItems: MediaItem[] = [];
  for (const m of media.slice(0, MAX_CAROUSEL_SLIDES)) {
    const videoUrl = m?.video_url ?? m?.videoUrl ?? undefined;
    const imageUrl =
      m?.photo_image?.uri ?? m?.image?.uri ?? m?.url ?? m?.thumbnail ?? undefined;
    if (typeof videoUrl === "string" && videoUrl.startsWith("http")) {
      mediaItems.push({ index: mediaItems.length, kind: "video", url: videoUrl });
    } else if (typeof imageUrl === "string" && imageUrl.startsWith("http")) {
      mediaItems.push({ index: mediaItems.length, kind: "image", url: imageUrl });
    }
  }
  // Single-media posts sometimes carry the URL at the top level instead.
  if (mediaItems.length === 0) {
    const topVideo = raw?.videoUrl ?? undefined;
    const topImage =
      raw?.thumbnailUrl ?? raw?.previewImage?.uri ?? undefined;
    if (typeof topVideo === "string" && topVideo.startsWith("http")) {
      mediaItems.push({ index: 0, kind: "video", url: topVideo });
    } else if (typeof topImage === "string" && topImage.startsWith("http")) {
      mediaItems.push({ index: 0, kind: "image", url: topImage });
    }
  }

  const firstMedia = media[0] ?? {};
  const image =
    raw?.thumbnailUrl ??
    raw?.previewImage?.uri ??
    firstMedia?.thumbnail ??
    firstMedia?.photo_image?.uri ??
    firstMedia?.image?.uri ??
    firstMedia?.url ??
    undefined;
  const author = raw?.user ?? raw?.author ?? raw?.pageInfo ?? {};

  const notes: string[] = [];
  if (media.length > MAX_CAROUSEL_SLIDES) {
    notes.push(`Post has ${media.length} media items; captured the first ${MAX_CAROUSEL_SLIDES}.`);
  }
  const transcript = typeof raw?.captionText === "string" && raw.captionText.trim() ? raw.captionText : undefined;

  const post: ScrapedPost = {
    caption: text,
    ownerUsername:
      author?.name ?? author?.username ?? raw?.pageName ?? raw?.facebookUrl ?? "facebook",
    likesCount: Number(raw?.likes ?? raw?.likesCount ?? raw?.reactionsCount ?? 0) || 0,
    commentsCount: Number(raw?.comments ?? raw?.commentsCount ?? 0) || 0,
    videoViewCount: Number(raw?.viewsCount ?? raw?.videoViewCount ?? 0) || undefined,
    videoPlayCount: Number(raw?.videoPlayCount ?? 0) || undefined,
    hashtags: hashtagsFrom(text),
    mentions: mentionsFrom(text),
    type: provisional.kind,
    url: raw?.url ?? raw?.topLevelUrl ?? requestedUrl,
    displayUrl: image,
    thumbnailUrl: image,
    videoUrl: raw?.videoUrl ?? firstMedia?.video_url ?? undefined,
    timestamp: raw?.time ?? raw?.timestamp ?? undefined,
    isSponsored: Boolean(raw?.isSponsored),
    owner: {
      username: author?.name ?? author?.username ?? undefined,
      fullName: author?.name ?? undefined,
      followersCount: Number(raw?.pageFollowers ?? author?.followers ?? 0) || undefined,
      profilePicUrl: author?.profilePic ?? author?.profilePicture ?? undefined,
      biography: raw?.pageAbout ?? undefined,
      externalUrl: author?.profileUrl ?? raw?.facebookUrl ?? undefined,
    },
    mediaItems,
    primaryVideoUrl: mediaItems.find((m) => m.kind === "video")?.url,
    transcript,
    scrapeCoverage: {
      slidesExpected: Math.max(media.length, mediaItems.length, 1),
      slidesCaptured: mediaItems.length,
      videoCaptured: mediaItems.some((m) => m.kind === "video"),
      transcriptCaptured: Boolean(transcript),
      thumbnailOnly: false,
      notes,
    },
  };
  post.type = finalKindFromData(provisional, post);
  return post;
}

/** Strip SRT cue numbers/timestamps down to plain spoken text. */
export function srtToText(srt: string): string {
  return srt
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^\d+$/.test(l) && !/^\d{2}:\d{2}:\d{2}[,.]\d+\s*-->/.test(l))
    .map((l) => l.replace(/<[^>]+>/g, ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 10000);
}

// ── Wrong-post rejection ─────────────────────────────────────────────

/** Extract the platform-specific post id / shortcode from a URL. */
export function extractPostId(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    const path = u.pathname;
    let m = path.match(/\/(?:p|reel|reels|tv)\/([\w-]+)/i);
    if (m) return m[1];
    m = path.match(/\/videos\/(?:[^/]+\/)?(\d+)/i);
    if (m) return m[1];
    // /posts/ ids are either their own segment or glued to the slug end.
    m = path.match(/\/posts\/[^/]*?(\d{6,})\/?$/i) ?? path.match(/\/posts\/(\d+)/i);
    if (m) return m[1];
    if (path.includes("permalink.php") || path.includes("story.php")) {
      return u.searchParams.get("story_fbid") ?? u.searchParams.get("id");
    }
    if (path.includes("/watch")) return u.searchParams.get("v");
    if (path.includes("/photo")) {
      return u.searchParams.get("fbid") ?? (path.match(/(\d{6,})/)?.[1] ?? null);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Verify the scraper returned the post we asked for, not a related/wrong
 * one. Compares the requested id/shortcode against the scraped item's ids
 * and URLs. When the requested URL carries no extractable id, we cannot
 * prove a mismatch, so we accept.
 */
export function verifyPostMatch(raw: any, requestedUrl: string): boolean {
  const wanted = extractPostId(requestedUrl);
  if (!wanted) return true;
  const haystack: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === "string" && v) haystack.push(v);
    else if (typeof v === "number") haystack.push(String(v));
  };
  push(raw?.shortCode);
  push(raw?.id);
  push(raw?.url);
  push(raw?.facebookUrl);
  push(raw?.topLevelUrl);
  push(raw?.topLevelReelUrl);
  push(raw?.inputUrl);
  push(raw?.video?.id);
  push(raw?.playback_video?.id);
  push(raw?.tracking?.video_id);
  push(raw?.tracking?.top_level_post_id);
  return haystack.some((h) => h.includes(wanted));
}

// ── Specific, human scrape errors ────────────────────────────────────

export class ScrapeError extends Error {
  constructor(
    message: string,
    readonly code: "private" | "deleted" | "region_blocked" | "unsupported" | "timeout" | "wrong_post" | "empty" | "upstream",
  ) {
    super(message);
    this.name = "ScrapeError";
  }
}

/** Map a raw scraper result/HTTP failure to a specific human error. */
export function scrapeFailure(reason: {
  status?: number;
  itemError?: string;
  itemErrorDescription?: string;
  platform: SourcePlatform;
}): ScrapeError {
  const err = `${reason.itemError ?? ""} ${reason.itemErrorDescription ?? ""}`.toLowerCase();
  const name = reason.platform === "instagram" ? "Instagram" : "Facebook";
  if (reason.status === 408 || reason.status === 504) {
    return new ScrapeError(`The ${name} scraper timed out. Try again in a moment.`, "timeout");
  }
  // The actors conflate "private" and "not found" ("no_items: Empty or
  // private data"), so check that first with a message covering both.
  if (/no_items|not found|deleted|removed|empty/.test(err)) {
    return new ScrapeError(`This ${name} post couldn't be captured — it may be private, deleted, or the link is wrong.`, "deleted");
  }
  if (/private|not authorized|login|permission/.test(err)) {
    return new ScrapeError(`This ${name} content is private or requires login, so it can't be captured.`, "private");
  }
  if (/region|geo|blocked|country/.test(err)) {
    return new ScrapeError(`This ${name} content is region-blocked and can't be reached.`, "region_blocked");
  }
  if (reason.status && reason.status >= 400) {
    return new ScrapeError(`The ${name} scraper failed (HTTP ${reason.status}). Try again shortly.`, "upstream");
  }
  return new ScrapeError(`No data came back for this ${name} link. It may be private, deleted, or an unsupported link type.`, "empty");
}
