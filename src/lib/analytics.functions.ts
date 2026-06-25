import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as uploadPost from "@/lib/upload-post/api.server";
import { UploadPostError } from "@/lib/upload-post/api.server";

// ════════════════════════════════════════════════════════════════════════
// Analytics — cache-first. We read today's snapshot before hitting the API
// so a second visit the same day never re-fetches (unless forceRefresh).
// Snapshot writes are service-role only.
// ════════════════════════════════════════════════════════════════════════

function rethrow(e: unknown): never {
  if (e instanceof UploadPostError) throw new Error(e.code);
  throw e instanceof Error ? e : new Error(String(e));
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const FetchAnalyticsInput = z.object({ forceRefresh: z.boolean().optional() }).optional();

function num(v: unknown): number | null {
  const n = typeof v === "string" ? parseInt(v, 10) : (v as number);
  return Number.isFinite(n) ? n : null;
}

export const fetchAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FetchAnalyticsInput.parse(d) ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const today = new Date().toISOString().slice(0, 10);

    // ── Cache-first ──
    if (!data.forceRefresh) {
      const { data: cached } = await supabase
        .from("analytics_snapshots")
        .select("*")
        .eq("user_id", userId)
        .eq("snapshot_date", today);
      if (cached && cached.length > 0) {
        return { snapshots: cached, cached: true };
      }
    }

    const { getUserUploadPostApiKey } = await import("@/lib/upload-post/user-key.server");
    const apiKey = await getUserUploadPostApiKey(userId);
    if (!uploadPost.isUploadPostConfigured(apiKey)) throw new Error("PROVIDER_NOT_CONFIGURED");

    const { data: profile } = await supabase
      .from("upload_post_profiles")
      .select("upload_post_username")
      .eq("user_id", userId)
      .single();
    if (!profile) throw new Error("PROFILE_NOT_FOUND");

    let raw: any;
    try {
      raw = await uploadPost.getAccountAnalytics(profile.upload_post_username, apiKey);
    } catch (e) {
      rethrow(e);
    }

    const metrics: any[] = raw?.platforms ?? raw?.metrics ?? raw?.analytics ?? raw?.data ?? [];
    const db = await admin();

    const written: any[] = [];
    for (const m of Array.isArray(metrics) ? metrics : []) {
      const platform = m.platform ?? m.provider;
      if (!platform) continue;
      const { data: row } = await db
        .from("analytics_snapshots")
        .upsert(
          {
            user_id: userId,
            platform,
            snapshot_date: today,
            followers_count: num(m.followers ?? m.followers_count),
            impressions: num(m.impressions),
            reach: num(m.reach),
            profile_views: num(m.profile_views ?? m.profileViews),
            raw_response: m,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: "user_id,platform,snapshot_date" },
        )
        .select("*")
        .single();
      if (row) written.push(row);
    }

    return { snapshots: written, cached: false };
  });

const HistoryInput = z.object({ days: z.number().int().min(1).max(365).optional() }).optional();

/** Returns recent snapshots for trend charts (read-only, no API call). */
export const getAnalyticsHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => HistoryInput.parse(d) ?? {})
  .handler(async ({ data, context }) => {
    const days = data.days ?? 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data: rows, error } = await context.supabase
      .from("analytics_snapshots")
      .select("*")
      .gte("snapshot_date", since)
      .order("snapshot_date", { ascending: true });
    if (error) throw new Error(error.message);
    return { snapshots: rows ?? [] };
  });
