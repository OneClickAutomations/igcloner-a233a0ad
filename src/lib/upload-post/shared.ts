// Client-safe constants for the publishing engine. NO secrets, NO server imports.
// Both the UI (validation, greying-out, hints) and the server functions
// (pre-flight validation) import from here so the rules never drift apart.

export const PUBLISHING_PLATFORMS = [
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "linkedin",
  "x",
  "threads",
  "pinterest",
  "bluesky",
  "reddit",
  "discord",
  "telegram",
] as const;

export type PublishingPlatform = (typeof PUBLISHING_PLATFORMS)[number];

export type ContentType = "text" | "image" | "carousel" | "video" | "reel";

/** Which Upload-Post endpoint a content type maps to. */
export type MediaKind = "text" | "photo" | "video";

export function mediaKindForContentType(ct: ContentType): MediaKind {
  if (ct === "video" || ct === "reel") return "video";
  if (ct === "text") return "text";
  return "photo";
}

export interface PlatformCapability {
  video: boolean;
  photo: boolean;
  text: boolean;
  /** social_accounts column that must be set before publishing, or null. */
  requiresSelector: "facebook_page_id" | "pinterest_default_board_id" | null;
  /** Hard caption character ceiling for the platform, if any. */
  maxCaptionChars?: number;
  /** True if Upload-Post exposes no analytics for this platform. */
  noAnalytics?: boolean;
}

// Verified against the Upload-Post platform/endpoint support matrix.
export const PLATFORM_CAPABILITY_MATRIX: Record<PublishingPlatform, PlatformCapability> = {
  instagram: { video: true, photo: true, text: false, requiresSelector: null },
  tiktok: { video: true, photo: true, text: false, requiresSelector: null },
  youtube: { video: true, photo: false, text: false, requiresSelector: null },
  facebook: { video: true, photo: true, text: true, requiresSelector: "facebook_page_id" },
  // Org URN is optional — personal profile is the default destination.
  linkedin: { video: true, photo: true, text: true, requiresSelector: null },
  x: { video: true, photo: true, text: true, requiresSelector: null },
  threads: { video: true, photo: true, text: true, requiresSelector: null },
  pinterest: {
    video: true,
    photo: true,
    text: false,
    requiresSelector: "pinterest_default_board_id",
  },
  bluesky: { video: true, photo: true, text: true, requiresSelector: null },
  reddit: { video: false, photo: false, text: true, requiresSelector: null },
  discord: {
    video: true,
    photo: true,
    text: true,
    requiresSelector: null,
    maxCaptionChars: 2000,
    noAnalytics: true,
  },
  telegram: {
    video: true,
    photo: true,
    text: true,
    requiresSelector: null,
    maxCaptionChars: 4096,
    noAnalytics: true,
  },
};

export interface PlatformMeta {
  label: string;
  emoji: string;
}

export const PLATFORM_META: Record<PublishingPlatform, PlatformMeta> = {
  instagram: { label: "Instagram", emoji: "📷" },
  tiktok: { label: "TikTok", emoji: "🎵" },
  youtube: { label: "YouTube", emoji: "▶️" },
  facebook: { label: "Facebook", emoji: "📘" },
  linkedin: { label: "LinkedIn", emoji: "💼" },
  x: { label: "X", emoji: "✕" },
  threads: { label: "Threads", emoji: "🧵" },
  pinterest: { label: "Pinterest", emoji: "📌" },
  bluesky: { label: "Bluesky", emoji: "🦋" },
  reddit: { label: "Reddit", emoji: "🤖" },
  discord: { label: "Discord", emoji: "🎮" },
  telegram: { label: "Telegram", emoji: "✈️" },
};

/**
 * Returns a human-readable reason a platform cannot accept this content type,
 * or null if the combination is valid. Drives UI greying + tooltips and the
 * server-side validation pass identically.
 */
export function platformIncompatibilityReason(
  platform: PublishingPlatform,
  contentType: ContentType,
): string | null {
  const caps = PLATFORM_CAPABILITY_MATRIX[platform];
  if (!caps) return `Unknown platform: ${platform}`;
  const kind = mediaKindForContentType(contentType);
  const label = PLATFORM_META[platform]?.label ?? platform;
  if (kind === "video" && !caps.video) return `${label} does not support video posts`;
  if (kind === "photo" && !caps.photo) return `${label} does not support photo posts`;
  if (kind === "text" && !caps.text) return `${label} does not support text-only posts`;
  return null;
}

/** Platforms that can accept the given content type. */
export function compatiblePlatforms(contentType: ContentType): PublishingPlatform[] {
  return PUBLISHING_PLATFORMS.filter((p) => platformIncompatibilityReason(p, contentType) === null);
}

// ── User-facing error map. Every error shown to the user resolves through
//    this — never a raw API string or stack trace. ──
export interface PublishingErrorCopy {
  title: string;
  message: string;
  action: string;
}

export const PUBLISHING_ERROR_MESSAGES: Record<string, PublishingErrorCopy> = {
  PROVIDER_NOT_CONFIGURED: {
    title: "Publishing Unavailable",
    message: "Social publishing is being set up. Please try again soon.",
    action: "Contact support",
  },
  PROFILE_LIMIT_REACHED: {
    title: "Account Limit Reached",
    message: "We've hit our publishing platform's account limit. Our team has been notified.",
    action: "Contact support",
  },
  PROFILE_NOT_FOUND: {
    title: "Profile Not Ready",
    message: "Your publishing profile hasn't been set up yet. Reload the page to finish setup.",
    action: "Reload",
  },
  PROFILE_SYNC_ERROR: {
    title: "Profile Out of Sync",
    message: "Your publishing profile is out of sync. Please try again.",
    action: "Retry",
  },
  ACCOUNTS_NOT_CONNECTED: {
    title: "Account Not Connected",
    message: "Connect this platform before publishing to it.",
    action: "Go to Connected Accounts",
  },
  SELECTOR_REQUIRED: {
    title: "Selection Required",
    message: "Choose a destination (Page/Board) for this platform.",
    action: "Select now",
  },
  INVALID_PLATFORM_COMBO: {
    title: "Unsupported Content Type",
    message: "This content type cannot be posted to one of the selected platforms.",
    action: "Adjust platform selection",
  },
  TOKEN_EXPIRED: {
    title: "Reconnect Needed",
    message: "Your connection to this platform has expired.",
    action: "Reconnect account",
  },
  RATE_LIMIT: {
    title: "Rate Limited",
    message: "Too many requests right now. Please wait a moment.",
    action: "Retry in 60s",
  },
  MEDIA_TOO_LARGE: {
    title: "File Too Large",
    message: "This video or image exceeds the platform's size limit.",
    action: "Compress and retry",
  },
  NETWORK_ERROR: {
    title: "Connection Issue",
    message: "Could not reach the publishing service.",
    action: "Retry",
  },
  UNKNOWN: {
    title: "Something Went Wrong",
    message: "An unexpected error occurred while publishing.",
    action: "Retry or contact support",
  },
};

/** Maps any thrown error / error code to user-facing copy. */
export function resolvePublishingError(err: unknown): PublishingErrorCopy & { code: string } {
  let code = "UNKNOWN";
  const raw = typeof err === "string" ? err : ((err as any)?.message ?? "");
  // Server functions throw `Error(code)` where code is a known key, or a raw
  // message that may embed one. Try to recover the code.
  const known = Object.keys(PUBLISHING_ERROR_MESSAGES);
  const found = known.find((k) => raw === k || raw.includes(k));
  if (found) code = found;
  else if (/network|fetch failed|timeout/i.test(raw)) code = "NETWORK_ERROR";
  else if (/rate.?limit|429/i.test(raw)) code = "RATE_LIMIT";
  return { code, ...PUBLISHING_ERROR_MESSAGES[code] };
}

export type JobStatus =
  | "draft"
  | "queued"
  | "uploading"
  | "processing"
  | "published"
  | "partially_published"
  | "failed"
  | "scheduled"
  | "cancelled";

export const IN_FLIGHT_JOB_STATUSES: JobStatus[] = ["queued", "uploading", "processing"];

export const TERMINAL_JOB_STATUSES: JobStatus[] = [
  "published",
  "partially_published",
  "failed",
  "cancelled",
];
