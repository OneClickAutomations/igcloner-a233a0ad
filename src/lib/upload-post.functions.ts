import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as uploadPost from "@/lib/upload-post/api.server";
import { UploadPostError } from "@/lib/upload-post/api.server";
import { getUserUploadPostApiKey } from "@/lib/upload-post/user-key.server";

// ════════════════════════════════════════════════════════════════════════
// Upload-Post profile, account-connection, and selector management.
//
// Every IGCloner user maps 1:1 to an Upload-Post profile whose `username`
// IS their Supabase auth user id. That mapping key is ALWAYS derived
// server-side from the authenticated session — never accepted from the client.
// ════════════════════════════════════════════════════════════════════════

/** Re-throw as a stable error code so the UI can map it to friendly copy. */
function rethrow(e: unknown): never {
  if (e instanceof UploadPostError) throw new Error(e.code);
  throw e instanceof Error ? e : new Error(String(e));
}

/**
 * Resolves which Upload-Post API key to use for this user and which profile
 * username to operate on.
 *
 * When the user has saved their OWN Upload-Post API key in Settings → API
 * Keys, we use that key and try to REUSE an existing profile in their
 * account (so the platforms they already connected on app.upload-post.com
 * stay connected). Only when their account has no profiles do we create
 * one. When no user key is saved, we fall back to the platform-wide
 * `UPLOAD_POST_API_KEY` and mint a profile keyed by the Supabase user id.
 */
async function ensureProfile(
  supabase: any,
  userId: string,
): Promise<{ upload_post_username: string; alreadyExists: boolean; apiKey: string | null }> {
  const userKey = await getUserUploadPostApiKey(userId);
  if (!userKey && !process.env.UPLOAD_POST_API_KEY) throw new Error("PROVIDER_NOT_CONFIGURED");

  const { data: existing } = await supabase
    .from("upload_post_profiles")
    .select("upload_post_username")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    // If the user has their own API key, make sure the stored profile
    // actually exists under THEIR Upload-Post account. If we previously
    // created a profile keyed to the Supabase user id under the platform
    // key, it won't be visible with the user's key — and none of their
    // already-connected platforms (Instagram, etc.) will show up. In that
    // case, repoint to an existing profile in their account.
    if (userKey) {
      const myProfiles = await uploadPost.listProfiles(userKey);
      if (myProfiles.length > 0 && !myProfiles.includes(existing.upload_post_username)) {
        // Pick the profile that has the most connected accounts.
        let best = myProfiles[0];
        let bestCount = -1;
        for (const name of myProfiles) {
          try {
            const p = await uploadPost.getProfile(name, userKey);
            const count = extractConnectedPlatforms(p).length;
            if (count > bestCount) {
              bestCount = count;
              best = name;
            }
          } catch {
            /* ignore */
          }
        }
        await supabase
          .from("upload_post_profiles")
          .update({ upload_post_username: best })
          .eq("user_id", userId);
        return { upload_post_username: best, alreadyExists: true, apiKey: userKey };
      }
    }
    return {
      upload_post_username: existing.upload_post_username,
      alreadyExists: true,
      apiKey: userKey,
    };
  }

  // Prefer an existing profile under the user's own Upload-Post account so
  // their already-connected Instagram/etc. carry over.
  let username: string | null = null;
  if (userKey) {
    const existingProfiles = await uploadPost.listProfiles(userKey);
    if (existingProfiles.length > 0) {
      // Pick the one with the most connections so the user's existing
      // Instagram / TikTok / etc. show up immediately.
      let best = existingProfiles[0];
      let bestCount = -1;
      for (const name of existingProfiles) {
        try {
          const p = await uploadPost.getProfile(name, userKey);
          const count = extractConnectedPlatforms(p).length;
          if (count > bestCount) {
            bestCount = count;
            best = name;
          }
        } catch {
          /* ignore */
        }
      }
      username = best;
    }
  }

  if (!username) {
    username = userId; // stable mapping — the Supabase UUID itself
    try {
      await uploadPost.createProfile(username, userKey);
    } catch (e) {
      // Duplicate-create can 4xx; tolerate and persist locally anyway.
      if (!(e instanceof UploadPostError) || (e.status !== 409 && e.status !== 400)) rethrow(e);
    }
  }

  const { data: saved, error } = await supabase
    .from("upload_post_profiles")
    .insert({
      user_id: userId,
      upload_post_username: username,
      profile_created_at_provider: new Date().toISOString(),
    })
    .select("upload_post_username")
    .single();
  if (error) throw new Error(error.message);
  return { upload_post_username: saved.upload_post_username, alreadyExists: false, apiKey: userKey };
}

export const createUploadPostProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { alreadyExists } = await ensureProfile(supabase, userId);
    return { ok: true, alreadyExists };
  });

const GenerateConnectInput = z
  .object({
    platforms: z.array(z.string()).optional(),
  })
  .optional();

export const generateConnectUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GenerateConnectInput.parse(d) ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { upload_post_username, apiKey } = await ensureProfile(supabase, userId);
    const siteUrl = process.env.SITE_URL || process.env.VITE_SITE_URL || "";

    let jwtData: any;
    try {
      jwtData = await uploadPost.generateConnectJwt(
        {
          username: upload_post_username,
          redirect_url: siteUrl ? `${siteUrl}/publishing?tab=accounts&connected=true` : undefined,
          logo_image: siteUrl ? `${siteUrl}/favicon.ico` : undefined,
          redirect_button_text: "Return to IGCloner",
          connect_title: "Connect Your Social Accounts",
          connect_description:
            "Link your accounts to publish AI-generated content directly from IGCloner.",
          platforms: data.platforms,
          show_calendar: false,
        },
        apiKey,
      );
    } catch (e) {
      rethrow(e);
    }

    const accessUrl = jwtData.access_url || jwtData.accessUrl || jwtData.url;
    if (!accessUrl) throw new Error("PROFILE_SYNC_ERROR");

    await supabase
      .from("upload_post_profiles")
      .update({
        last_jwt_generated_at: new Date().toISOString(),
        last_jwt_expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        connect_page_visited: true,
      })
      .eq("user_id", userId);

    return { accessUrl: accessUrl as string };
  });

const MANUAL_PLATFORMS = new Set(["discord", "telegram"]);

/** Pulls a platform name out of an arbitrary Upload-Post account entry. */
function extractConnectedPlatforms(payload: any): Array<{ platform: string; info: any }> {
  // The provider has returned connected accounts under a few shapes across
  // versions; normalize them all into [{ platform, info }].
  const out: Array<{ platform: string; info: any }> = [];
  const candidates =
    payload?.social_accounts ??
    payload?.profile?.social_accounts ??
    payload?.profiles?.[0]?.social_accounts ??
    payload?.accounts ??
    null;

  if (candidates && !Array.isArray(candidates) && typeof candidates === "object") {
    for (const [platform, info] of Object.entries(candidates)) {
      // Treat falsy / explicitly-disconnected entries as not connected.
      if (info === false || info === null) continue;
      if (typeof info === "object" && (info as any).connected === false) continue;
      out.push({ platform, info });
    }
  } else if (Array.isArray(candidates)) {
    for (const entry of candidates) {
      const platform = entry?.platform ?? entry?.provider;
      if (platform) out.push({ platform, info: entry });
    }
  }
  return out;
}

export const syncAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { upload_post_username, apiKey } = await ensureProfile(supabase, userId);

    let payload: any;
    try {
      payload = await uploadPost.getProfile(upload_post_username, apiKey);
    } catch (e) {
      rethrow(e);
    }

    const connected = extractConnectedPlatforms(payload);
    const connectedNames = new Set(connected.map((c) => c.platform));
    const now = new Date().toISOString();

    for (const { platform, info } of connected) {
      await supabase.from("social_accounts").upsert(
        {
          user_id: userId,
          platform,
          upload_post_username,
          profile_display_name: info?.display_name ?? info?.username ?? info?.name ?? null,
          is_connected: true,
          connection_method: MANUAL_PLATFORMS.has(platform) ? "manual_credentials" : "oauth",
          last_validated_at: now,
          last_validation_status: "valid",
          connected_at: now,
          disconnected_at: null,
        },
        { onConflict: "user_id,platform" },
      );
    }

    // Anything previously connected but absent now is marked disconnected,
    // without clobbering rows we just upserted.
    const { data: locals } = await supabase
      .from("social_accounts")
      .select("platform, is_connected")
      .eq("user_id", userId);
    for (const row of locals ?? []) {
      if (!connectedNames.has(row.platform) && row.is_connected) {
        await supabase
          .from("social_accounts")
          .update({
            is_connected: false,
            disconnected_at: now,
            last_validation_status: "revoked",
          })
          .eq("user_id", userId)
          .eq("platform", row.platform);
      }
    }

    const { data: refreshed } = await supabase
      .from("social_accounts")
      .select("*")
      .eq("user_id", userId)
      .order("platform");

    return { accounts: refreshed ?? [] };
  });

export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("social_accounts")
      .select("*")
      .order("platform");
    if (error) throw new Error(error.message);
    return { accounts: data ?? [] };
  });

const FetchSelectorsInput = z.object({
  platform: z.enum(["facebook", "linkedin", "pinterest"]),
});

export const fetchPlatformSelectors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FetchSelectorsInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
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
      raw = await uploadPost.fetchSelectors(data.platform, profile.upload_post_username, apiKey);
    } catch (e) {
      rethrow(e);
    }

    // Normalize the three selector shapes into { id, name }[].
    const list: Array<{ id: string; name: string }> = [];
    const source =
      raw?.pages ?? raw?.boards ?? raw?.organizations ?? raw?.data ?? raw?.results ?? [];
    for (const entry of Array.isArray(source) ? source : []) {
      const id =
        entry?.id ?? entry?.page_id ?? entry?.board_id ?? entry?.urn ?? entry?.organization_urn;
      const name = entry?.name ?? entry?.title ?? entry?.page_name ?? entry?.board_name ?? id;
      if (id) list.push({ id: String(id), name: String(name) });
    }
    return { platform: data.platform, options: list };
  });

const SetSelectorInput = z.object({
  platform: z.enum(["facebook", "linkedin", "pinterest"]),
  id: z.string().min(1),
  name: z.string().min(1),
});

/**
 * Persists the user's chosen Page / Board / Org for a platform. The id MUST
 * be one the provider returned for THIS user (we re-fetch and cross-check),
 * so a client can never inject an arbitrary destination.
 */
export const setPlatformSelector = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SetSelectorInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = await getUserUploadPostApiKey(userId);
    if (!uploadPost.isUploadPostConfigured(apiKey)) throw new Error("PROVIDER_NOT_CONFIGURED");

    const { data: profile } = await supabase
      .from("upload_post_profiles")
      .select("upload_post_username")
      .eq("user_id", userId)
      .single();
    if (!profile) throw new Error("PROFILE_NOT_FOUND");

    // Cross-check: the chosen id must belong to this user's provider account.
    let raw: any;
    try {
      raw = await uploadPost.fetchSelectors(data.platform, profile.upload_post_username, apiKey);
    } catch (e) {
      rethrow(e);
    }
    const source =
      raw?.pages ?? raw?.boards ?? raw?.organizations ?? raw?.data ?? raw?.results ?? [];
    const match = (Array.isArray(source) ? source : []).find((entry: any) => {
      const id =
        entry?.id ?? entry?.page_id ?? entry?.board_id ?? entry?.urn ?? entry?.organization_urn;
      return String(id) === data.id;
    });
    if (!match) throw new Error("SELECTOR_REQUIRED");

    const patch =
      data.platform === "facebook"
        ? { facebook_page_id: data.id, facebook_page_name: data.name }
        : data.platform === "pinterest"
          ? { pinterest_default_board_id: data.id, pinterest_default_board_name: data.name }
          : { linkedin_org_urn: data.id, linkedin_org_name: data.name };

    const { data: updated, error } = await supabase
      .from("social_accounts")
      .update(patch)
      .eq("user_id", userId)
      .eq("platform", data.platform)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { account: updated };
  });
