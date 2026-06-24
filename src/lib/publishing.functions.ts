import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as uploadPost from "@/lib/upload-post/api.server";
import { UploadPostError } from "@/lib/upload-post/api.server";
import {
  PLATFORM_CAPABILITY_MATRIX,
  PUBLISHING_PLATFORMS,
  mediaKindForContentType,
  platformIncompatibilityReason,
  type ContentType,
  type PublishingPlatform,
} from "@/lib/upload-post/shared";

// ════════════════════════════════════════════════════════════════════════
// The core publishing orchestrator + async status tracking.
//
// Job rows are written with the user's RLS client (ownership enforced by RLS).
// Per-platform `publishing_results` are service-role only (clients have SELECT
// but not INSERT/UPDATE), so we use the admin client for those writes.
// ════════════════════════════════════════════════════════════════════════

function rethrow(e: unknown): never {
  if (e instanceof UploadPostError) throw new Error(e.code);
  throw e instanceof Error ? e : new Error(String(e));
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const PlatformEnum = z.enum(PUBLISHING_PLATFORMS);

const PublishInput = z.object({
  contentType: z.enum(["text", "image", "carousel", "video", "reel"]),
  title: z.string().max(300).optional(),
  captionPerPlatform: z.record(z.string(), z.string()).default({}),
  hashtagsPerPlatform: z.record(z.string(), z.array(z.string())).default({}),
  mediaUrls: z.array(z.string().url()).default([]),
  platforms: z.array(PlatformEnum).min(1).max(12),
  scheduledAt: z.string().datetime().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  /** When true, persist as a draft and do not submit to the provider. */
  saveAsDraft: z.boolean().optional(),
});

/** Builds the final caption (caption + hashtags) per platform. */
function composeCaptions(
  platforms: string[],
  contentType: ContentType,
  captionPerPlatform: Record<string, string>,
  hashtagsPerPlatform: Record<string, string[]>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of platforms) {
    const caption = captionPerPlatform[p] ?? "";
    const tags = (hashtagsPerPlatform[p] ?? []).map((t) => `#${t.replace(/^#/, "")}`);
    let text = tags.length ? `${caption}\n\n${tags.join(" ")}`.trim() : caption.trim();
    const max = PLATFORM_CAPABILITY_MATRIX[p as PublishingPlatform]?.maxCaptionChars;
    if (max && text.length > max) text = text.slice(0, max);
    out[p] = text;
  }
  return out;
}

export const publishContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PublishInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // ── 1. Capability validation — reject before any external call ──
    const validationErrors: string[] = [];
    for (const p of data.platforms) {
      const reason = platformIncompatibilityReason(p, data.contentType as ContentType);
      if (reason) validationErrors.push(reason);
    }
    const mediaKind = mediaKindForContentType(data.contentType as ContentType);
    if (mediaKind !== "text" && data.mediaUrls.length === 0 && !data.saveAsDraft) {
      validationErrors.push("This content type requires at least one media file.");
    }
    if (validationErrors.length > 0) {
      throw new Error(`INVALID_PLATFORM_COMBO: ${validationErrors.join("; ")}`);
    }

    // ── 2. Connection + selector checks (skipped for drafts) ──
    const { data: socialAccounts } = await supabase
      .from("social_accounts")
      .select("*")
      .eq("user_id", userId)
      .in("platform", data.platforms);

    if (!data.saveAsDraft) {
      const missing = data.platforms.filter(
        (p) => !socialAccounts?.find((a: any) => a.platform === p && a.is_connected),
      );
      if (missing.length > 0) throw new Error(`ACCOUNTS_NOT_CONNECTED: ${missing.join(", ")}`);

      for (const p of data.platforms) {
        const selectorField = PLATFORM_CAPABILITY_MATRIX[p as PublishingPlatform]?.requiresSelector;
        if (!selectorField) continue;
        const account = socialAccounts?.find((a: any) => a.platform === p);
        if (!account?.[selectorField]) throw new Error(`SELECTOR_REQUIRED: ${p}`);
      }
    }

    const fbAccount = socialAccounts?.find((a: any) => a.platform === "facebook");
    const liAccount = socialAccounts?.find((a: any) => a.platform === "linkedin");
    const pinAccount = socialAccounts?.find((a: any) => a.platform === "pinterest");

    // ── 3. Create the job row (status reflects draft/scheduled/queued) ──
    const status = data.saveAsDraft ? "draft" : data.scheduledAt ? "scheduled" : "queued";
    const { data: job, error: jobError } = await supabase
      .from("publishing_jobs")
      .insert({
        user_id: userId,
        project_id: data.projectId ?? null,
        content_type: data.contentType,
        title: data.title ?? null,
        caption_per_platform: data.captionPerPlatform,
        hashtags_per_platform: data.hashtagsPerPlatform,
        media_urls: data.mediaUrls,
        platforms: data.platforms,
        status,
        scheduled_at: data.scheduledAt ?? null,
        facebook_page_id: fbAccount?.facebook_page_id ?? null,
        linkedin_org_urn: liAccount?.linkedin_org_urn ?? null,
        pinterest_board_id: pinAccount?.pinterest_default_board_id ?? null,
      })
      .select("*")
      .single();
    if (jobError) throw new Error(jobError.message);

    // Drafts stop here — nothing submitted to the provider.
    if (data.saveAsDraft) return { jobId: job.id, status: "draft" as const };

    // One pending result row per platform (service-role write).
    const db = await admin();
    await db.from("publishing_results").insert(
      data.platforms.map((p) => ({
        job_id: job.id,
        user_id: userId,
        platform: p,
        status: "pending" as const,
        attempted_at: new Date().toISOString(),
      })),
    );

    // ── 4. Submit to Upload-Post ──
    const { data: profile } = await supabase
      .from("upload_post_profiles")
      .select("upload_post_username")
      .eq("user_id", userId)
      .single();
    if (!profile) throw new Error("PROFILE_NOT_FOUND");

    const captions = composeCaptions(
      data.platforms,
      data.contentType as ContentType,
      data.captionPerPlatform,
      data.hashtagsPerPlatform,
    );

    try {
      const result = await uploadPost.submitUpload({
        kind: mediaKind,
        user: profile.upload_post_username,
        platforms: data.platforms,
        title: data.title || captions[data.platforms[0]] || "",
        captionPerPlatform: captions,
        mediaUrls: mediaKind === "text" ? undefined : data.mediaUrls,
        scheduledAt: data.scheduledAt ?? null,
        asyncUpload: true,
        facebookPageId: fbAccount?.facebook_page_id ?? undefined,
        pinterestBoardId: pinAccount?.pinterest_default_board_id ?? undefined,
        linkedinOrgUrn: liAccount?.linkedin_org_urn ?? undefined,
      });

      const requestId = result.request_id ?? result.requestId ?? null;
      const jobIdProvider = result.job_id ?? result.jobId ?? null;
      const newStatus = data.scheduledAt ? "scheduled" : "uploading";

      await supabase
        .from("publishing_jobs")
        .update({
          upload_post_request_id: requestId,
          upload_post_job_id: jobIdProvider,
          status: newStatus,
        })
        .eq("id", job.id);

      return { jobId: job.id, requestId, status: newStatus };
    } catch (e) {
      const message = e instanceof UploadPostError ? e.body || e.message : String(e);
      await supabase
        .from("publishing_jobs")
        .update({ status: "failed", last_error_message: message })
        .eq("id", job.id);
      await db
        .from("publishing_results")
        .update({
          status: "failed",
          error_message: message,
          completed_at: new Date().toISOString(),
        })
        .eq("job_id", job.id);
      rethrow(e);
    }
  });

function mapProviderStatus(s: string | undefined): string {
  const map: Record<string, string> = {
    pending: "pending",
    queued: "pending",
    uploading: "uploading",
    processing: "processing",
    success: "published",
    completed: "published",
    published: "published",
    failed: "failed",
    error: "failed",
  };
  return map[(s ?? "").toLowerCase()] || "processing";
}

const PollInput = z.object({ jobId: z.string().uuid() });

export const pollPublishingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PollInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: job } = await supabase
      .from("publishing_jobs")
      .select("*")
      .eq("id", data.jobId)
      .eq("user_id", userId)
      .single();
    if (!job) throw new Error("Job not found");

    // Nothing to poll for terminal or not-yet-submitted jobs.
    if (!job.upload_post_request_id && !job.upload_post_job_id) {
      return { status: job.status, results: [] };
    }

    let statusData: any;
    try {
      statusData = await uploadPost.getUploadStatus({
        requestId: job.upload_post_request_id ?? undefined,
        jobId: job.upload_post_job_id ?? undefined,
      });
    } catch (e) {
      // A transient status-check failure shouldn't flip the job to failed.
      return { status: job.status, results: [], transientError: true };
    }

    const platformResults: any[] =
      statusData.platforms ?? statusData.results ?? statusData.platform_results ?? [];

    const db = await admin();
    let publishedCount = 0;
    let failedCount = 0;
    const total = (job.platforms as string[]).length;

    for (const r of platformResults) {
      const platform = r.platform ?? r.provider;
      if (!platform) continue;
      const status = mapProviderStatus(r.status);
      if (status === "published") publishedCount++;
      if (status === "failed") failedCount++;
      await db
        .from("publishing_results")
        .update({
          status,
          post_url: r.post_url ?? r.url ?? null,
          platform_post_id: r.post_id ?? r.platform_post_id ?? null,
          error_code: r.error_code ?? null,
          error_message: r.error ?? r.error_message ?? null,
          completed_at:
            status === "published" || status === "failed" ? new Date().toISOString() : null,
        })
        .eq("job_id", data.jobId)
        .eq("platform", platform);
    }

    const settled = publishedCount + failedCount;
    let overall = job.status;
    if (settled >= total && total > 0) {
      overall =
        failedCount === 0 ? "published" : publishedCount === 0 ? "failed" : "partially_published";
    } else if (publishedCount > 0 || failedCount > 0) {
      overall = "processing";
    }

    if (overall !== job.status) {
      await supabase
        .from("publishing_jobs")
        .update({
          status: overall,
          published_at:
            overall === "published" || overall === "partially_published"
              ? new Date().toISOString()
              : null,
        })
        .eq("id", data.jobId);
    }

    const { data: results } = await supabase
      .from("publishing_results")
      .select("*")
      .eq("job_id", data.jobId);

    return { status: overall, results: results ?? [] };
  });

// ── Read queries (Queue / History / Drafts tabs) ────────────────────────

const ListJobsInput = z
  .object({
    statuses: z.array(z.string()).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
  })
  .optional();

export const listPublishingJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListJobsInput.parse(d) ?? {})
  .handler(async ({ data, context }) => {
    const limit = data.limit ?? 50;
    const offset = data.offset ?? 0;
    let q = context.supabase
      .from("publishing_jobs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (data.statuses && data.statuses.length) q = q.in("status", data.statuses);

    const { data: jobs, error, count } = await q;
    if (error) throw new Error(error.message);

    const ids = (jobs ?? []).map((j: any) => j.id);
    const resultsByJob: Record<string, any[]> = {};
    if (ids.length) {
      const { data: results } = await context.supabase
        .from("publishing_results")
        .select("*")
        .in("job_id", ids);
      for (const r of results ?? []) {
        (resultsByJob[r.job_id] ??= []).push(r);
      }
    }
    const enriched = (jobs ?? []).map((j: any) => ({ ...j, results: resultsByJob[j.id] ?? [] }));
    return { jobs: enriched, total: count ?? enriched.length };
  });

const JobIdInput = z.object({ jobId: z.string().uuid() });

export const getPublishingJob = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => JobIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: job, error } = await context.supabase
      .from("publishing_jobs")
      .select("*")
      .eq("id", data.jobId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!job) throw new Error("Job not found");
    const { data: results } = await context.supabase
      .from("publishing_results")
      .select("*")
      .eq("job_id", data.jobId);
    return { job: { ...job, results: results ?? [] } };
  });

export const deletePublishingJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => JobIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("publishing_jobs").delete().eq("id", data.jobId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const CancelInput = z.object({ jobId: z.string().uuid() });

export const cancelScheduledJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CancelInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: job } = await context.supabase
      .from("publishing_jobs")
      .select("status")
      .eq("id", data.jobId)
      .single();
    if (!job) throw new Error("Job not found");
    if (job.status !== "scheduled" && job.status !== "draft") {
      throw new Error("Only scheduled or draft jobs can be cancelled");
    }
    const { error } = await context.supabase
      .from("publishing_jobs")
      .update({ status: "cancelled" })
      .eq("id", data.jobId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
