// Server-only Upload-Post API client. The `.server.ts` suffix keeps this and
// the API key out of the client bundle. Every outbound call to Upload-Post
// goes through here so auth, base URL, timeouts, and error normalization live
// in exactly one place.
//
// Field names below follow the documented Upload-Post API surface. If the live
// API differs, this file is the single point of reconciliation — handlers and
// UI never hardcode Upload-Post field names.

const BASE_URL = "https://api.upload-post.com/api";
const DEFAULT_TIMEOUT_MS = 30_000;

export class UploadPostError extends Error {
  status: number;
  /** Normalized code consumed by the user-facing error map. */
  code: string;
  body: string;
  constructor(message: string, status: number, code: string, body = "") {
    super(message);
    this.name = "UploadPostError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export function getUploadPostApiKey(): string {
  const key = process.env.UPLOAD_POST_API_KEY;
  if (!key) throw new UploadPostError("Upload-Post not configured", 503, "PROVIDER_NOT_CONFIGURED");
  return key;
}

export function isUploadPostConfigured(): boolean {
  return !!process.env.UPLOAD_POST_API_KEY;
}

function normalizeStatusToCode(status: number): string {
  if (status === 401 || status === 403) return "TOKEN_EXPIRED";
  if (status === 404) return "PROFILE_NOT_FOUND";
  if (status === 413) return "MEDIA_TOO_LARGE";
  if (status === 429) return "RATE_LIMIT";
  return "UNKNOWN";
}

interface RequestOpts {
  method?: "GET" | "POST" | "DELETE";
  /** JSON body — sent as application/json. Mutually exclusive with `form`. */
  json?: Record<string, unknown>;
  /** multipart/form-data body — used by upload endpoints. */
  form?: FormData;
  query?: Record<string, string | undefined>;
  /** Override the Apikey auth scheme (validate-jwt uses Bearer). */
  authorization?: string;
  timeoutMs?: number;
}

async function request(path: string, opts: RequestOpts = {}): Promise<any> {
  const apiKey = getUploadPostApiKey();
  const url = new URL(`${BASE_URL}${path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {
    Authorization: opts.authorization ?? `Apikey ${apiKey}`,
  };
  let body: BodyInit | undefined;
  if (opts.json) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  } else if (opts.form) {
    body = opts.form; // browser/undici sets the multipart boundary header
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: opts.method ?? "GET",
      headers,
      body,
      signal: controller.signal,
    });
  } catch (e: any) {
    clearTimeout(timeout);
    if (e?.name === "AbortError") {
      throw new UploadPostError("Upload-Post request timed out", 504, "NETWORK_ERROR");
    }
    throw new UploadPostError(`Upload-Post network error: ${e?.message ?? e}`, 0, "NETWORK_ERROR");
  }
  clearTimeout(timeout);

  const text = await res.text();
  if (!res.ok) {
    console.error(
      `[upload-post] ${opts.method ?? "GET"} ${path} -> ${res.status}: ${text.slice(0, 500)}`,
    );
    // Profile-limit responses come back as 403 on the create-profile path.
    let code = normalizeStatusToCode(res.status);
    if (
      res.status === 403 &&
      path.includes("/users") &&
      opts.method === "POST" &&
      !path.includes("jwt")
    ) {
      code = "PROFILE_LIMIT_REACHED";
    }
    throw new UploadPostError(`Upload-Post ${path} failed: ${res.status}`, res.status, code, text);
  }

  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

// ── Profile management ──────────────────────────────────────────────────

export function createProfile(username: string) {
  return request("/uploadposts/users", { method: "POST", json: { username } });
}

export function deleteProfile(username: string) {
  return request("/uploadposts/users", { method: "DELETE", json: { username } });
}

export function getProfile(username: string) {
  return request("/uploadposts/users", { query: { username } });
}

export interface GenerateJwtOptions {
  username: string;
  redirect_url?: string;
  logo_image?: string;
  redirect_button_text?: string;
  connect_title?: string;
  connect_description?: string;
  platforms?: string[];
  show_calendar?: boolean;
}

export function generateConnectJwt(opts: GenerateJwtOptions) {
  return request("/uploadposts/users/generate-jwt", { method: "POST", json: { ...opts } });
}

// ── Platform selectors ──────────────────────────────────────────────────

const SELECTOR_ENDPOINTS: Record<string, string> = {
  facebook: "/uploadposts/facebook/pages",
  linkedin: "/uploadposts/linkedin/pages",
  pinterest: "/uploadposts/pinterest/boards",
};

export function fetchSelectors(platform: string, username: string) {
  const endpoint = SELECTOR_ENDPOINTS[platform];
  if (!endpoint) throw new UploadPostError(`No selector endpoint for ${platform}`, 400, "UNKNOWN");
  return request(endpoint, { query: { username } });
}

// ── Upload / publish ────────────────────────────────────────────────────

export type UploadKind = "video" | "photo" | "text";

const UPLOAD_ENDPOINTS: Record<UploadKind, string> = {
  video: "/upload",
  photo: "/upload_photos",
  text: "/upload_text",
};

export interface SubmitUploadArgs {
  kind: UploadKind;
  user: string;
  platforms: string[];
  title: string;
  /** Per-platform caption overrides, keyed by platform name. */
  captionPerPlatform?: Record<string, string>;
  mediaUrls?: string[];
  scheduledAt?: string | null;
  asyncUpload?: boolean;
  facebookPageId?: string;
  pinterestBoardId?: string;
  linkedinOrgUrn?: string;
}

export function submitUpload(args: SubmitUploadArgs) {
  const endpoint = UPLOAD_ENDPOINTS[args.kind];

  // Upload-Post accepts repeated `platform[]` form fields plus a unified
  // `title` and optional per-platform caption fields (`caption[<platform>]`).
  // We use multipart/form-data which all three upload endpoints accept.
  const form = new FormData();
  form.set("user", args.user);
  for (const p of args.platforms) form.append("platform[]", p);
  form.set("title", args.title);
  form.set("async_upload", String(args.asyncUpload ?? true));

  if (args.captionPerPlatform) {
    for (const [platform, caption] of Object.entries(args.captionPerPlatform)) {
      if (caption) form.set(`caption[${platform}]`, caption);
    }
  }
  if (args.kind !== "text" && args.mediaUrls) {
    for (const u of args.mediaUrls) form.append("media_urls[]", u);
  }
  if (args.scheduledAt) form.set("scheduled_date", args.scheduledAt);
  if (args.facebookPageId) form.set("facebook_page_id", args.facebookPageId);
  if (args.pinterestBoardId) form.set("pinterest_board_id", args.pinterestBoardId);
  if (args.linkedinOrgUrn) form.set("linkedin_page_id", args.linkedinOrgUrn);

  return request(endpoint, { method: "POST", form });
}

// ── Status / analytics ──────────────────────────────────────────────────

export function getUploadStatus(params: { requestId?: string; jobId?: string }) {
  return request("/uploadposts/status", {
    query: { request_id: params.requestId, job_id: params.jobId },
  });
}

export function getAccountAnalytics(username: string) {
  return request(`/analytics/${encodeURIComponent(username)}`);
}

export function getPostAnalytics(requestId: string) {
  return request(`/uploadposts/post-analytics/${encodeURIComponent(requestId)}`);
}

/** Validate the API key / fetch plan info. */
export function getMe() {
  return request("/uploadposts/me");
}
