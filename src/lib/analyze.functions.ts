import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText, type ModelMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { computeViralScore } from "@/lib/scoring";
import {
  classifySourceUrl,
  isSupportedSocialUrl,
  resolveCanonicalUrl,
  normalizeInstagramPost,
  normalizeFacebookReel,
  normalizeFacebookPost,
  verifyPostMatch,
  scrapeFailure,
  srtToText,
  ScrapeError,
  type ClassifiedUrl,
  type ScrapedPost,
} from "@/lib/source-ingest";
import { resolveApifyToken, apifyRun } from "@/lib/apify.server";
import { persistSourceMedia } from "@/lib/source-media.server";
import { ACTION_COSTS, InsufficientCreditsError } from "@/lib/credits";
import { debitCredits, refundCredits } from "@/lib/credits.server";
import { isWithinReuseWindow } from "@/lib/intel-analytics";
import { runAnalysisPipeline, type AnalysisStage } from "@/lib/analysis-pipeline.server";

const InputSchema = z.object({
  url: z
    .string()
    .url()
    .refine(isSupportedSocialUrl, {
      message: "Must be an Instagram or Facebook URL",
    }),
  forceRefresh: z.boolean().optional(),
  analysisId: z.string().uuid().optional(),
});


async function scrapeInstagramSource(url: string, token: string, provisional: ClassifiedUrl): Promise<ScrapedPost> {
  let items: any[];
  try {
    items = await apifyRun("apify~instagram-scraper", { directUrls: [url], resultsLimit: 1, resultsType: "posts" }, token);
  } catch (e) {
    throw scrapeFailure({ status: (e as any).status, platform: "instagram" });
  }
  const raw = items?.[0];
  if (!raw) throw scrapeFailure({ platform: "instagram" });
  if (raw.error || raw.errorDescription) {
    throw scrapeFailure({ itemError: raw.error, itemErrorDescription: raw.errorDescription, platform: "instagram" });
  }
  if (!verifyPostMatch(raw, url)) {
    throw new ScrapeError("The scraper returned a different post than the one you linked. Try the URL again.", "wrong_post");
  }
  const post = normalizeInstagramPost(raw, url, provisional);

  // Two-step: if owner.followersCount is missing, scrape the profile separately
  // so the Post Intelligence card can show real follower / media counts.
  const username = post.ownerUsername || post.owner?.username;
  if (username && username !== "unknown" && !(post.owner?.followersCount && post.owner.followersCount > 0)) {
    try {
      const profItems = await apifyRun("apify~instagram-profile-scraper", { usernames: [username] }, token);
      const p = profItems?.[0] ?? null;
      if (p) {
        post.owner = {
          ...(post.owner ?? {}),
          username: p.username ?? username,
          fullName: p.fullName ?? post.owner?.fullName,
          biography: p.biography ?? post.owner?.biography,
          followersCount: p.followersCount ?? post.owner?.followersCount,
          followingCount: p.followsCount ?? p.followingCount ?? post.owner?.followingCount,
          mediaCount: p.postsCount ?? p.mediaCount ?? post.owner?.mediaCount,
          verified: p.verified ?? post.owner?.verified,
          isBusinessAccount: p.isBusinessAccount ?? post.owner?.isBusinessAccount,
          externalUrl: p.externalUrl ?? post.owner?.externalUrl,
          profilePicUrl: p.profilePicUrl ?? p.profilePicUrlHD ?? post.owner?.profilePicUrl,
          businessCategoryName: p.businessCategoryName ?? post.owner?.businessCategoryName,
          isPrivate: p.private ?? p.isPrivate ?? post.owner?.isPrivate,
        } as any;
      }
    } catch (e) {
      console.warn("[Apify] profile scrape error:", (e as Error).message);
    }
  }

  return post;
}

async function scrapeFacebookReelSource(url: string, token: string): Promise<ScrapedPost> {
  let items: any[];
  try {
    items = await apifyRun("apify~facebook-reels-scraper", { startUrls: [{ url }], resultsLimit: 1 }, token);
  } catch (e) {
    throw scrapeFailure({ status: (e as any).status, platform: "facebook" });
  }
  const raw = items?.[0];
  if (!raw) throw scrapeFailure({ platform: "facebook" });
  if (raw.error || raw.errorDescription) {
    throw scrapeFailure({ itemError: raw.error, itemErrorDescription: raw.errorDescription, platform: "facebook" });
  }
  if (!verifyPostMatch(raw, url)) {
    throw new ScrapeError("The scraper returned a different reel than the one you linked. Try the URL again.", "wrong_post");
  }
  const post = normalizeFacebookReel(raw, url);

  // The reels scraper returns an SRT caption file URL — fetch and inline it
  // as the transcript so downstream passes have the spoken words.
  const captionsUrl = (post as any).captionsUrl as string | undefined;
  if (captionsUrl) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(captionsUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const text = srtToText(await res.text());
        if (text) {
          post.transcript = text;
          post.scrapeCoverage.transcriptCaptured = true;
        }
      }
    } catch (e) {
      post.scrapeCoverage.notes.push("Transcript file couldn't be downloaded.");
      post.scrapeCoverage.transcriptCaptured = false;
      console.warn("[ingest] captions fetch failed:", (e as Error).message);
    }
    delete (post as any).captionsUrl;
  }
  return post;
}

async function scrapeFacebookPostSource(url: string, token: string, provisional: ClassifiedUrl): Promise<ScrapedPost> {
  let items: any[];
  try {
    // Per the actor docs, resultsLimit is ignored for direct post URLs;
    // captionText asks for video transcripts when available.
    items = await apifyRun("apify~facebook-posts-scraper", { startUrls: [{ url }], resultsLimit: 1, captionText: true }, token);
  } catch (e) {
    throw scrapeFailure({ status: (e as any).status, platform: "facebook" });
  }
  const raw = items?.[0];
  if (!raw) throw scrapeFailure({ platform: "facebook" });
  if (raw.error || raw.errorDescription) {
    throw scrapeFailure({ itemError: raw.error, itemErrorDescription: raw.errorDescription, platform: "facebook" });
  }
  if (!verifyPostMatch(raw, url)) {
    throw new ScrapeError("The scraper returned a different post than the one you linked. Try the URL again.", "wrong_post");
  }
  return normalizeFacebookPost(raw, url, provisional);
}

/** Route to the right scraper for the classified URL. */
async function scrapeSource(url: string, token: string, classified: ClassifiedUrl): Promise<ScrapedPost> {
  if (classified.platform === "instagram") return scrapeInstagramSource(url, token, classified);
  if (classified.kind === "Reel" || classified.kind === "Video") return scrapeFacebookReelSource(url, token);
  return scrapeFacebookPostSource(url, token, classified);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

const CLAUDE_MODEL = "claude-sonnet-4-5";

async function callClaude(opts: {
  system?: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: opts.maxTokens ?? 4000,
      ...(opts.system ? { system: opts.system } : {}),
      messages: [{ role: "user", content: opts.user }],
    }),
  });

  if (res.status === 429) throw new Error("Rate limit exceeded. Please try again shortly.");
  if (res.status === 401) throw new Error("Claude API key invalid.");
  if (!res.ok) {
    const text = await res.text();
    console.error("[Claude] error:", res.status, text);
    throw new Error("AI request failed");
  }
  const data = await res.json();
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error("Empty AI response");
  return text;
}

function parseJsonish<T = any>(text: string): T {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const startIdx = cleaned.search(/[\{\[]/);
  if (startIdx === -1) {
    console.error("[AI] No JSON found. First 400 chars:", cleaned.slice(0, 400));
    throw new Error("AI returned malformed JSON");
  }
  const openChar = cleaned[startIdx];
  const closeChar = openChar === "[" ? "]" : "}";
  const lastIdx = cleaned.lastIndexOf(closeChar);
  let candidate =
    lastIdx > startIdx ? cleaned.slice(startIdx, lastIdx + 1) : cleaned.slice(startIdx);

  const attempts: Array<(s: string) => string> = [
    (s) => s,
    (s) =>
      s
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]")
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ""),
    (s) => {
      // Try to repair truncated JSON by balancing braces/brackets
      let opens = 0,
        closes = 0,
        sqOpens = 0,
        sqCloses = 0,
        inStr = false,
        esc = false;
      for (const ch of s) {
        if (esc) {
          esc = false;
          continue;
        }
        if (ch === "\\") {
          esc = true;
          continue;
        }
        if (ch === '"') inStr = !inStr;
        if (inStr) continue;
        if (ch === "{") opens++;
        else if (ch === "}") closes++;
        else if (ch === "[") sqOpens++;
        else if (ch === "]") sqCloses++;
      }
      let repaired = s.replace(/,\s*$/, "");
      if (inStr) repaired += '"';
      repaired += "]".repeat(Math.max(0, sqOpens - sqCloses));
      repaired += "}".repeat(Math.max(0, opens - closes));
      return repaired;
    },
  ];

  let lastErr: unknown;
  for (const fix of attempts) {
    try {
      return JSON.parse(fix(candidate));
    } catch (e) {
      lastErr = e;
    }
  }
  console.error("[AI] JSON parse failed. First 400 chars:", candidate.slice(0, 400));
  console.error("[AI] Last 400 chars:", candidate.slice(-400));
  console.error("[AI] Parse error:", lastErr);
  throw new Error("AI returned malformed JSON");
}

const STAGE_LABELS: Record<AnalysisStage, string> = {
  fetching_post: "Fetching the post",
  saving_media: "Saving the media",
  reading_slides: "Reading slides",
  watching_video: "Watching the video",
  transcribing: "Transcribing",
  building_blueprint: "Building the blueprint",
};

export const analyzeInstagramPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Lazy self-heal: refund and fail this user's stalled analysis jobs.
    await supabaseAdmin.rpc("sweep_stale_analyses" as any, { p_user_id: userId } as any).then(() => {}, () => {});

    const resolved = await resolveCanonicalUrl(data.url);
    const canonicalUrl = resolved.canonicalUrl;
    const classified = classifySourceUrl(canonicalUrl);
    if (!classified) {
      return { ok: false as const, limitReached: false as const, error: "This link type isn't supported. Paste a link to a specific post, reel, or video.", data: null };
    }

    // Cache: same canonical URL by this user within 12h, completed → free.
    if (!data.forceRefresh) {
      const { data: recent } = await supabase
        .from("analyses")
        .select("id, created_at")
        .eq("user_id", userId)
        .eq("instagram_url", canonicalUrl)
        .eq("analysis_status", "ready")
        .order("created_at", { ascending: false })
        .limit(5);
      const hit = (recent ?? []).find((a: any) => isWithinReuseWindow(a.created_at));
      if (hit) {
        const cached = await loadAnalysisPayload(supabase, userId, hit.id);
        return { ok: true as const, limitReached: false as const, error: null, data: { ...cached, cacheHit: true as const } };
      }
    }

    // Insert the job row up front so the UI can poll its stage.
    const analysisId = data.analysisId ?? crypto.randomUUID();
    const { error: insErr } = await supabase.from("analyses").insert({
      id: analysisId, user_id: userId, instagram_url: canonicalUrl, post_type: classified.kind,
      analysis_status: "processing", analysis_stage: "fetching_post", last_progress_at: new Date().toISOString(),
    } as any);
    if (insErr) return { ok: false as const, limitReached: false as const, error: "Couldn't start the analysis. Please try again.", data: null };

    const setStage = async (stage: AnalysisStage) => {
      await supabase.from("analyses").update({ analysis_stage: stage, last_progress_at: new Date().toISOString() } as any)
        .eq("id", analysisId).eq("analysis_status", "processing");
    };

    // Debit first, then record the pending attempt (a marker without a
    // matching debit could let the sweep mint credits).
    const attemptId = crypto.randomUUID();
    let debited = 0;
    try {
      await debitCredits(userId, ACTION_COSTS.analysis, "debit_analysis", "analysis", attemptId, attemptId);
      debited = ACTION_COSTS.analysis;
      await supabase.from("analyses").update({ pending_attempt_id: attemptId, pending_charge_amount: debited } as any).eq("id", analysisId);

      const token = await resolveApifyToken(supabase, userId);
      if (!token) throw new Error("Connect your Apify API key in Settings before analyzing posts.");
      const scraped = await scrapeSource(canonicalUrl, token, classified);
      const postType = scraped.type;

      await setStage("saving_media");
      let scrapedData: any = { ...scraped, attemptId, originalUrl: resolved.originalUrl };
      if (scraped.mediaItems.length > 0) {
        const { storedMedia, notes } = await persistSourceMedia(userId, analysisId, scraped.mediaItems);
        scrapedData = { ...scrapedData, storedMedia, scrapeCoverage: { ...scraped.scrapeCoverage, notes: [...scraped.scrapeCoverage.notes, ...notes] } };
      }
      const viral = computeViralScore(scraped);
      await supabase.from("analyses").update({
        post_type: postType, source_account: scraped.ownerUsername ?? null, source_caption: scraped.caption ?? null,
        scraped_data: scrapedData, viral_score: viral.score, viral_band: viral.band, viral_factors: viral.factors as any,
        last_progress_at: new Date().toISOString(),
      } as any).eq("id", analysisId);

      const result = await runAnalysisPipeline({ db: supabase, analysisId, url: canonicalUrl, postType, scraped: scrapedData, setStage });

      const finalFields = {
        dna_analysis: result.dna, performance_score: result.dna.performanceScore, blueprint: result.blueprint as any,
        evidence: result.evidence as any, transcript: result.transcript, transcript_segments: result.segments as any,
        analysis_confidence: result.analysisConfidence, model_used: result.modelUsed,
      };
      // Conditional finish: only flip to ready if the sweep hasn't failed+refunded this run.
      const { data: finished } = await supabase.from("analyses")
        .update({ ...finalFields, analysis_status: "ready", analysis_stage: null, pending_attempt_id: null, pending_charge_amount: null, last_progress_at: new Date().toISOString() } as any)
        .eq("id", analysisId).eq("analysis_status", "processing").select("id");
      if (!finished || finished.length === 0) {
        console.warn("[analyze] run finished after being swept; keeping data, status stays failed", { analysisId });
        await supabase.from("analyses").update(finalFields as any).eq("id", analysisId);
      }

      if (result.clones.length > 0) {
        const { error: cErr } = await supabase.from("clones").insert(result.clones.map((c: any) => ({
          analysis_id: analysisId, user_id: userId, version_number: c.versionNumber, angle_type: c.angleType, angle: c.angle,
          hook: c.hook, story_structure: c.storyStructure, caption: c.caption, visual_direction: c.visualDirection, cta: c.cta,
        })));
        if (cErr) console.error("[analyze] clones insert error:", cErr);
      }
      const payload = await loadAnalysisPayload(supabase, userId, analysisId);
      return { ok: true as const, limitReached: false as const, error: null, data: { ...payload, cacheHit: false as const } };
    } catch (err: any) {
      console.error("[analyze] error:", err);
      if (debited > 0) await refundCredits(userId, debited, "analysis", attemptId, attemptId);
      const message = err instanceof InsufficientCreditsError ? err.message : err?.message || "Analysis failed";
      await supabase.from("analyses").update({
        analysis_status: "failed", analysis_stage: null, error_message: message, pending_attempt_id: null, pending_charge_amount: null,
      } as any).eq("id", analysisId).eq("analysis_status", "processing");
      if (err instanceof InsufficientCreditsError) {
        // Nothing was charged and no work happened — don't leave a failed row behind.
        await supabase.from("analyses").delete().eq("id", analysisId);
      }
      return { ok: false as const, limitReached: false as const, error: message, data: null };
    }
  });

/** Poll target for the analysis job's stage. */
export const getAnalysisStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ analysisId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase.from("analyses")
      .select("analysis_status, analysis_stage, error_message").eq("id", data.analysisId).eq("user_id", context.userId).maybeSingle();
    if (!row) return { status: null, stage: null, label: null, error: null };
    const r = row as any;
    return { status: r.analysis_status as string, stage: r.analysis_stage as string | null, label: r.analysis_stage ? STAGE_LABELS[r.analysis_stage as AnalysisStage] ?? null : null, error: r.error_message as string | null };
  });

/** Load a full analysis payload (used by getAnalysisById and the cache hit path). */
async function loadAnalysisPayload(supabase: any, userId: string, id: string) {
  const { data: analysis, error } = await supabase
    .from("analyses")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (error || !analysis) throw new Error("Analysis not found");

  const { data: clones } = await supabase
    .from("clones")
    .select("*")
    .eq("analysis_id", analysis.id)
    .order("version_number", { ascending: true });

  const dna = analysis.dna_analysis as any;
  // Recompute viral score on read so older rows without persisted score still display one.
  const viral = computeViralScore((analysis as any).scraped_data ?? null);
  return {
    analysisId: analysis.id,
    createdAt: analysis.created_at,
    dna: { ...dna, sourceAccount: analysis.source_account, postType: analysis.post_type },
    scraped: (analysis as any).scraped_data ?? null,
    instagramUrl: analysis.instagram_url,
    status: (analysis as any).analysis_status ?? "ready",
    blueprint: (analysis as any).blueprint ?? null,
    evidence: (analysis as any).evidence ?? null,
    transcript: (analysis as any).transcript ?? null,
    transcriptSegments: (analysis as any).transcript_segments ?? null,
    analysisConfidence: (analysis as any).analysis_confidence ?? null,
    modelUsed: (analysis as any).model_used ?? null,
    viral,
    clones: (clones ?? []).map((c: any) => ({
      versionNumber: c.version_number,
      angleType: c.angle_type,
      angleLabel: angleLabelFor(c.angle_type),
      hook: c.hook,
      angle: c.angle,
      storyStructure: c.story_structure,
      caption: c.caption,
      visualDirection: c.visual_direction,
      cta: c.cta,
    })),
  };
}

/**
 * Signed read URLs for an analysis's persisted source media. Later passes
 * (studios, regeneration) use these instead of the expired CDN links.
 */
export const getSourceMediaSignedUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ analysisId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: analysis, error } = await supabase
      .from("analyses")
      .select("scraped_data")
      .eq("id", data.analysisId)
      .eq("user_id", userId)
      .single();
    if (error || !analysis) throw new Error("Analysis not found");

    const stored = ((analysis.scraped_data as any)?.storedMedia ?? []) as Array<{
      index: number; kind: "image" | "video"; path: string; bytes: number; mime: string;
    }>;
    if (stored.length === 0) return { media: [] };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const media = await Promise.all(
      stored.map(async (m) => {
        const { data: signed, error: sErr } = await supabaseAdmin.storage
          .from("source-media")
          .createSignedUrl(m.path, 3600);
        if (sErr || !signed?.signedUrl) return null;
        return { ...m, signedUrl: signed.signedUrl };
      }),
    );
    return { media: media.filter(Boolean) };
  });

export const getAnalysisById = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    return loadAnalysisPayload(context.supabase, context.userId, data.id);
  });

function angleLabelFor(t: string | null): string {
  switch (t) {
    case "direct": return "Direct Improvement";
    case "contrarian": return "Contrarian Angle";
    case "story": return "Storytelling Angle";
    case "authority": return "Authority Angle";
    case "curiosity": return "Curiosity Gap";
    default: return "Variation";
  }
}

export const getUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("plan, analyses_used, analyses_limit")
      .eq("id", userId)
      .single();
    if (error || !data) throw new Error("Profile not found");
    return {
      plan: data.plan as string,
      used: data.analyses_used ?? 0,
      limit: data.analyses_limit ?? 0,
      remaining: Math.max(0, (data.analyses_limit ?? 0) - (data.analyses_used ?? 0)),
    };
  });

export const makeItBetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        analysisId: z.string().uuid(),
        versionNumber: z.number().int().min(1).max(5),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: analysis } = await supabase
      .from("analyses")
      .select("dna_analysis")
      .eq("id", data.analysisId)
      .eq("user_id", userId)
      .single();
    if (!analysis) throw new Error("Analysis not found");

    const { data: clone } = await supabase
      .from("clones")
      .select("*")
      .eq("analysis_id", data.analysisId)
      .eq("version_number", data.versionNumber)
      .eq("user_id", userId)
      .single();
    if (!clone) throw new Error("Clone not found");

    const dna: any = analysis.dna_analysis;
    const prompt = `You are an elite Instagram copywriter. Take this content version and make it significantly better. Increase hook strength, shareability, and conversion potential. Return ONLY JSON.

Current version:
${JSON.stringify(
  {
    hook: clone.hook,
    angle: clone.angle,
    storyStructure: clone.story_structure,
    caption: clone.caption,
    cta: clone.cta,
  },
  null,
  2,
)}

Original DNA context:
Performance score: ${dna?.performanceScore}
Hook type: ${dna?.hookBreakdown?.type}
Top engagement drivers: ${(dna?.engagementDrivers ?? []).join(", ")}

Return:
{
  "improvedHook": "string",
  "improvedCaption": "string",
  "improvedCta": "string",
  "improvements": ["string","string","string"],
  "shareabilityScore": 0-100,
  "savePotentialScore": 0-100
}`;

    const text = await callClaude({ user: prompt, maxTokens: 2000 });
    const improved = parseJsonish<any>(text);

    // Persist into the clone row
    await supabase
      .from("clones")
      .update({
        hook: improved.improvedHook,
        caption: improved.improvedCaption,
        cta: improved.improvedCta,
      })
      .eq("id", clone.id);

    return { improved };
  });

// ============================================================
// Hook Lab — generate 10 hook variations for an analysis
// ============================================================

const HOOK_LAB_SYSTEM = `You are a viral hook writer. Generate 10 distinct opening hooks for short-form content. Each hook must use a different psychological pattern. Return ONLY a JSON array.`;

export const generateHooks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ analysisId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: analysis } = await supabase
      .from("analyses")
      .select("dna_analysis, source_caption")
      .eq("id", data.analysisId)
      .eq("user_id", userId)
      .single();
    if (!analysis) throw new Error("Analysis not found");
    const dna: any = analysis.dna_analysis;

    const user = `Generate 10 hook variations for this content topic.

Topic / category: ${dna?.contentCategory}
Original hook style: ${dna?.hookBreakdown?.type}
Target audience: ${dna?.targetAudience?.who} — wants ${dna?.targetAudience?.desire}
Source summary: ${dna?.contentSummary}

Return a JSON array of 10 objects with this shape:
[
  { "type": "Question | Shocking Stat | Bold Claim | Pattern Interrupt | Story Open | Curiosity Gap | FOMO | Contrarian | Listicle | Confession", "text": "the hook (1–2 sentences)", "why": "one line — why it works" }
]
Each hook must use a different type. Be punchy and specific. No emojis at the start.`;

    const text = await callClaude({ system: HOOK_LAB_SYSTEM, user, maxTokens: 2500 });
    const hooks = parseJsonish<any[]>(text);

    // Persist as multiplied_content rows for history
    if (Array.isArray(hooks) && hooks.length > 0) {
      const rows = hooks.map((h: any) => ({
        analysis_id: data.analysisId,
        user_id: userId,
        format: "hook",
        content: JSON.stringify(h),
      }));
      await supabase.from("multiplied_content").insert(rows);
    }

    return { hooks };
  });

// ============================================================
// Regenerate clones using the user's brand preferences
// ============================================================

const PreferencesSchema = z.object({
  niche: z.string().min(1).max(120),
  contentGoal: z.string().min(1).max(120),
  selectedAngles: z.array(z.string()).min(1).max(7),
  targetAudience: z.string().max(500).optional().default(""),
  keywords: z.array(z.string()).max(20).optional().default([]),
  toneOfVoice: z.string().min(1).max(120),
  contentFormat: z.string().min(1).max(120),
});

export const regenerateClonesWithPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      analysisId: z.string().uuid(),
      preferences: PreferencesSchema,
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: analysis } = await supabase
      .from("analyses")
      .select("dna_analysis, source_account, post_type")
      .eq("id", data.analysisId)
      .eq("user_id", userId)
      .single();
    if (!analysis) throw new Error("Analysis not found");
    const dna: any = analysis.dna_analysis;
    const prefs = data.preferences;

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    const system = `You are an expert Instagram content creator. Generate content variations SPECIFICALLY tailored to the user's niche, goals, and audience — not just inspired by the source post. The user's preferences OVERRIDE the source post's niche. If the source post is about K-Pop and the user's niche is fitness, generate fitness content using the SAME psychological hooks and content structure. Return ONLY a JSON array — no prose, no markdown fences.`;

    const angleCount = Math.min(5, Math.max(prefs.selectedAngles.length, 3));
    const prompt = `SOURCE POST DNA:
${JSON.stringify({
  category: dna?.contentCategory,
  hookType: dna?.hookBreakdown?.type,
  emotionalArchitecture: dna?.emotionalArchitecture,
  storyStructure: dna?.storyStructure,
  engagementDrivers: dna?.engagementDrivers,
  whyItWorks: dna?.whyItWorks,
})}

USER'S CONTENT PREFERENCES (generate for THESE, not the source niche):
- Niche: ${prefs.niche}
- Goal: ${prefs.contentGoal}
- Angles requested: ${prefs.selectedAngles.join(", ")}
- Target audience: ${prefs.targetAudience || "Not specified"}
- Keywords to weave in naturally: ${(prefs.keywords ?? []).join(", ") || "None"}
- Tone of voice: ${prefs.toneOfVoice}
- Format: ${prefs.contentFormat}

Generate EXACTLY ${angleCount} content versions tailored to the user's niche & goal. Use the psychological hooks from the source DNA but rewrite for the user's audience.

Return ONLY a JSON array with this shape (no wrapping object):
[
  {
    "versionNumber": 1,
    "angleType": "direct"|"contrarian"|"story"|"authority"|"curiosity",
    "angleLabel": "Short label naming the angle (e.g. 'Direct improvement', 'Personal story for fitness')",
    "hook": "compelling 1-2 sentence hook",
    "angle": "what makes this version different",
    "storyStructure": "beat-by-beat structure",
    "caption": "ready-to-post caption with line breaks and emojis, ends with CTA",
    "visualDirection": "visual / format guidance",
    "cta": "explicit call to action"
  }
]`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    let parsed: any[];
    try {
      const { text } = await generateText({ model, system, prompt, abortSignal: controller.signal });
      parsed = parseJsonish<any[]>(text);
    } finally {
      clearTimeout(timer);
    }
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("AI returned no clones");

    // Wipe + replace clones for this analysis
    await supabase.from("clones").delete().eq("analysis_id", data.analysisId).eq("user_id", userId);

    const rows = parsed.slice(0, 5).map((c: any, i: number) => ({
      analysis_id: data.analysisId,
      user_id: userId,
      version_number: c.versionNumber ?? i + 1,
      angle_type: c.angleType ?? "direct",
      angle: c.angle ?? "",
      hook: c.hook ?? "",
      story_structure: c.storyStructure ?? "",
      caption: c.caption ?? "",
      visual_direction: c.visualDirection ?? "",
      cta: c.cta ?? "",
    }));
    const { error: cErr } = await supabase.from("clones").insert(rows);
    if (cErr) throw new Error("Couldn't save clones");

    return {
      clones: rows.map((r) => ({
        versionNumber: r.version_number,
        angleType: r.angle_type,
        angleLabel: parsed.find((p) => p.versionNumber === r.version_number)?.angleLabel ?? angleLabelFor(r.angle_type),
        hook: r.hook,
        angle: r.angle,
        storyStructure: r.story_structure,
        caption: r.caption,
        visualDirection: r.visual_direction,
        cta: r.cta,
      })),
    };
  });

// ============================================================
// Content Multiplier — repurpose into Tweet / LinkedIn / YouTube / Blog
// ============================================================

const MULTIPLY_FORMATS = ["tweet", "twitter_thread", "linkedin", "youtube", "blog"] as const;
type MultiplyFormat = (typeof MULTIPLY_FORMATS)[number];

const MULTIPLY_SYSTEM = `You are a multi-platform content strategist. Repurpose Instagram content into other formats while preserving the core insight. Match the native voice and best practices of each platform. Return ONLY valid JSON.`;

function multiplyPrompt(format: MultiplyFormat, dna: any, clone: any | null): string {
  const base = `Source insight:
Hook: ${clone?.hook ?? dna?.hookBreakdown?.whatWorks}
Caption: ${clone?.caption ?? dna?.contentSummary}
Category: ${dna?.contentCategory}
Audience: ${dna?.targetAudience?.who}
`;
  switch (format) {
    case "tweet":
      return `${base}
Write a single high-performance tweet under 280 characters. Punchy, no hashtags, no emojis at the start.
Return: { "format": "tweet", "content": "..." }`;
    case "twitter_thread":
      return `${base}
Write a 7–9 tweet thread. Tweet 1 hooks hard. Each tweet under 280 chars, numbered "1/", "2/", etc. Last tweet has a soft CTA.
Return: { "format": "twitter_thread", "content": "full thread as one string, tweets separated by \\n\\n" }`;
    case "linkedin":
      return `${base}
Write a LinkedIn post (180–250 words). Professional, story-driven, line breaks every 1–2 sentences, no hashtags inline, ends with a question.
Return: { "format": "linkedin", "content": "..." }`;
    case "youtube":
      return `${base}
Write a YouTube video script outline for a 5–7 minute video. Include: title (curiosity-driven, <60 chars), thumbnail concept, hook (first 15s), 4–6 section beats, CTA.
Return: { "format": "youtube", "content": "the full outline as markdown" }`;
    case "blog":
      return `${base}
Write an SEO-friendly blog outline. Include: title (<60 chars), meta description (<160 chars), 5–7 H2 sections with one-line summaries, target keyword.
Return: { "format": "blog", "content": "the full outline as markdown" }`;
  }
}

export const multiplyContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        analysisId: z.string().uuid(),
        format: z.enum(MULTIPLY_FORMATS),
        versionNumber: z.number().int().min(1).max(5).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: analysis } = await supabase
      .from("analyses")
      .select("dna_analysis")
      .eq("id", data.analysisId)
      .eq("user_id", userId)
      .single();
    if (!analysis) throw new Error("Analysis not found");

    let clone: any = null;
    if (data.versionNumber) {
      const { data: c } = await supabase
        .from("clones")
        .select("hook, caption, cta")
        .eq("analysis_id", data.analysisId)
        .eq("version_number", data.versionNumber)
        .eq("user_id", userId)
        .single();
      clone = c;
    }

    const prompt = multiplyPrompt(data.format, analysis.dna_analysis, clone);
    const text = await callClaude({ system: MULTIPLY_SYSTEM, user: prompt, maxTokens: 2500 });
    const parsed = parseJsonish<{ format: string; content: string }>(text);

    const { data: row, error } = await supabase
      .from("multiplied_content")
      .insert({
        analysis_id: data.analysisId,
        user_id: userId,
        format: data.format,
        content: parsed.content,
      })
      .select()
      .single();
    if (error) throw new Error("Failed to save multiplied content");

    return { id: row.id, format: data.format, content: parsed.content };
  });

// ============================================================
// Content Calendar — 30-day plan
// ============================================================

const CALENDAR_SYSTEM = `You are an Instagram content planner. Build a 30-day posting calendar tailored to the user's niche. Vary post types and hook patterns. Return ONLY a JSON array.`;

export const generateCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        niche: z.string().min(2).max(120),
        days: z.number().int().min(7).max(60).default(30),
        startDate: z.string().optional(), // ISO YYYY-MM-DD
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const prompt = `Build a ${data.days}-day Instagram content calendar for someone in the niche: "${data.niche}".

Return a JSON array of exactly ${data.days} items. Each item:
{
  "dayOffset": 0-based integer (0 = day 1),
  "postType": "Reel | Carousel | Post | Story",
  "hook": "one-line hook",
  "caption": "2–4 sentence caption preview",
  "visualIdea": "one-line visual / format direction"
}

Rules:
- Mix post types: ~50% Reels, ~30% Carousels, ~20% Posts.
- Vary hook patterns (question, contrarian, story, listicle, stat).
- Cluster similar themes loosely, but no two identical hooks.
- No emojis at the start of hooks.`;

    const text = await callClaude({ system: CALENDAR_SYSTEM, user: prompt, maxTokens: 8000 });
    const items = parseJsonish<any[]>(text);
    if (!Array.isArray(items) || items.length === 0) throw new Error("Empty calendar response");

    const start = data.startDate ? new Date(data.startDate) : new Date();
    start.setHours(0, 0, 0, 0);

    // Replace any existing future calendar for this user
    const startIso = start.toISOString().slice(0, 10);
    await supabase
      .from("calendar_items")
      .delete()
      .eq("user_id", userId)
      .gte("scheduled_for", startIso);

    const rows = items.map((it: any) => {
      const offset = Number.isFinite(it.dayOffset) ? Number(it.dayOffset) : 0;
      const d = new Date(start);
      d.setDate(d.getDate() + offset);
      return {
        user_id: userId,
        niche: data.niche,
        scheduled_for: d.toISOString().slice(0, 10),
        post_type: it.postType ?? null,
        hook: it.hook ?? null,
        caption: it.caption ?? null,
        visual_idea: it.visualIdea ?? null,
        status: "planned",
      };
    });

    const { error } = await supabase.from("calendar_items").insert(rows);
    if (error) throw new Error("Failed to save calendar");

    return { count: rows.length, startDate: startIso };
  });

export const listCalendarItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("calendar_items")
      .select("*")
      .eq("user_id", userId)
      .order("scheduled_for", { ascending: true });
    if (error) throw new Error("Failed to load calendar");
    return { items: data ?? [] };
  });

export const updateCalendarItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["planned", "drafted", "scheduled", "posted"]).optional(),
        hook: z.string().max(500).optional(),
        caption: z.string().max(4000).optional(),
        visual_idea: z.string().max(1000).optional(),
        scheduled_for: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...patch } = data;
    const { error } = await supabase
      .from("calendar_items")
      .update(patch)
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw new Error("Failed to update");
    return { ok: true };
  });

export const deleteCalendarItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("calendar_items")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error("Failed to delete");
    return { ok: true };
  });

// ============================================================
// Visual generation — create image / carousel / reel cover
// via Lovable AI Gateway's image-capable model.
// ============================================================

async function generateImageViaGateway(prompt: string): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image-preview",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });

  if (res.status === 429) throw new Error("Rate limit — try again shortly.");
  if (res.status === 402) throw new Error("Out of AI credits. Add credits in Settings.");
  if (!res.ok) {
    const t = await res.text();
    console.error("[visuals] gateway error", res.status, t);
    throw new Error("Image generation failed");
  }
  const json = await res.json();
  const msg = json?.choices?.[0]?.message;
  const imageUrl: string | undefined =
    msg?.images?.[0]?.image_url?.url ??
    msg?.images?.[0]?.url ??
    (Array.isArray(msg?.content)
      ? msg.content.find((c: any) => c?.image_url?.url)?.image_url?.url
      : undefined);
  if (!imageUrl) {
    console.error("[visuals] no image in response", JSON.stringify(json).slice(0, 400));
    throw new Error("Model returned no image");
  }
  return imageUrl;
}

export const generateVisuals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        analysisId: z.string().uuid(),
        versionNumber: z.number().int().min(1).max(5),
        format: z.enum(["image", "carousel", "reel"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: analysis } = await supabase
      .from("analyses")
      .select("dna_analysis")
      .eq("id", data.analysisId)
      .eq("user_id", userId)
      .single();
    if (!analysis) throw new Error("Analysis not found");

    const { data: clone } = await supabase
      .from("clones")
      .select("hook, caption, visual_direction, story_structure, cta")
      .eq("analysis_id", data.analysisId)
      .eq("version_number", data.versionNumber)
      .eq("user_id", userId)
      .single();
    if (!clone) throw new Error("Clone not found");

    const dna: any = analysis.dna_analysis;
    const mood = dna?.visualStyle?.colorMood ?? "vibrant, on-brand";
    const composition = dna?.visualStyle?.composition ?? "centered, balanced";
    const baseStyle = `Visual style: ${mood}. Composition: ${composition}. Polished, professional, Instagram-ready. NO text or watermark on the image.`;

    if (data.format === "image") {
      const prompt = `Create a single 1:1 square Instagram post image (1080x1080).
Hook concept: ${clone.hook}
Visual direction: ${clone.visual_direction}
${baseStyle}`;
      const img = await generateImageViaGateway(prompt);
      return { format: "image" as const, images: [img], script: null as string | null };
    }

    if (data.format === "carousel") {
      const slides = 4;
      const beats = [
        `Slide 1 — Hook frame: "${clone.hook}". Bold, attention-grabbing.`,
        `Slide 2 — Setup / problem: visual that reinforces the hook.`,
        `Slide 3 — Key insight or step from: ${clone.story_structure}`,
        `Slide 4 — Payoff / CTA frame: "${clone.cta}". Inviting, clean.`,
      ];
      const images: string[] = [];
      for (let i = 0; i < slides; i++) {
        const prompt = `Create a 4:5 portrait Instagram carousel slide ${i + 1} of ${slides}.
${beats[i]}
Visual direction: ${clone.visual_direction}
${baseStyle}
Keep consistent color palette across all slides.`;
        images.push(await generateImageViaGateway(prompt));
      }
      return { format: "carousel" as const, images, script: null as string | null };
    }

    // reel — single 9:16 cover + structured shot list
    const prompt = `Create a single 9:16 vertical Instagram Reel COVER frame (1080x1920).
Hook concept: "${clone.hook}"
Visual direction: ${clone.visual_direction}
${baseStyle}`;
    const cover = await generateImageViaGateway(prompt);
    const script = `🎬 REEL SCRIPT — ${clone.hook}

HOOK (0–3s): ${clone.hook}

BEATS:
${clone.story_structure}

CAPTION:
${clone.caption}

CTA:
${clone.cta}`;
    return { format: "reel" as const, images: [cover], script };
  });