import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

// ─────────────────────────────────────────────────────────────────────
// Content Intelligence Engine — Research module (Phase 1)
// One shared research/DNA pipeline reused by Campaign Planner, Studio,
// Publishing, and Analyze. Never re-analyze what a report already answers.
// ─────────────────────────────────────────────────────────────────────

function parseJsonish<T = any>(text: string): T {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.search(/[\{\[]/);
  if (start === -1) throw new Error("AI returned no JSON");
  const openChar = cleaned[start];
  const closeChar = openChar === "[" ? "]" : "}";
  const end = cleaned.lastIndexOf(closeChar);
  const candidate = end > start ? cleaned.slice(start, end + 1) : cleaned.slice(start);
  try {
    return JSON.parse(candidate);
  } catch {
    return JSON.parse(candidate.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]"));
  }
}

async function apifyRun(actor: string, input: unknown): Promise<any[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN not configured");
  const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${token}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("[Apify]", actor, res.status, text.slice(0, 300));
    throw new Error(`Apify ${actor} failed (${res.status})`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/** Trim a scraped post payload down to what the AI actually needs. */
function slimPost(p: any) {
  return {
    type: p?.type,
    caption: (p?.caption ?? "").slice(0, 1200),
    likesCount: p?.likesCount,
    commentsCount: p?.commentsCount,
    videoViewCount: p?.videoViewCount ?? p?.videoPlayCount,
    videoPlayCount: p?.videoPlayCount ?? null,
    hashtags: (p?.hashtags ?? []).slice(0, 20),
    mentions: (p?.mentions ?? []).slice(0, 10),
    timestamp: p?.timestamp,
    productType: p?.productType,
    ownerUsername: p?.ownerUsername ?? p?.owner?.username,
    url: p?.url,
    shortCode: p?.shortCode ?? null,
    isSponsored: p?.isSponsored ?? false,
    locationName: p?.locationName ?? null,
    carouselSlides: p?.type === "Sidecar" ? (p?.images?.length ?? null) : null,
    firstComment: (p?.firstComment ?? "").slice(0, 300),
    musicInfo: p?.musicInfo?.song_name ?? p?.musicInfo?.artist_name ?? null,
  };
}

async function collectSignals(mode: "niche" | "competitor" | "topic", subject: string) {
  if (mode === "competitor") {
    // Handle the handle: strip @ / URL fragments.
    const handle = subject.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").split(/[/?]/)[0].trim();
    const profiles = await apifyRun("apify~instagram-profile-scraper", { usernames: [handle] });
    const profile = profiles?.[0] ?? null;
    const posts = (profile?.latestPosts ?? []).slice(0, 30).map(slimPost);
    return {
      subject: handle,
      profile: profile
        ? {
            username: profile.username,
            fullName: profile.fullName,
            biography: profile.biography,
            followersCount: profile.followersCount,
            followsCount: profile.followsCount,
            postsCount: profile.postsCount,
            verified: profile.verified,
            isBusinessAccount: profile.isBusinessAccount ?? false,
            businessCategoryName: profile.businessCategoryName,
            externalUrl: profile.externalUrl,
            language: profile.language ?? null,
          }
        : null,
      posts,
    };
  }

  // Niche / topic — hashtag scrape to surface real, currently-performing posts.
  const term = subject
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 40);
  const items = await apifyRun("apify~instagram-hashtag-scraper", {
    hashtags: [term],
    resultsLimit: 40,
  }).catch(() => [] as any[]);
  return { subject, profile: null, posts: items.slice(0, 30).map(slimPost) };
}

async function generateDnaReport(mode: string, subject: string, signals: any) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
  const gateway = createLovableAiGatewayProvider(apiKey);
  const model = gateway("google/gemini-2.5-flash");

  const posts: any[] = Array.isArray(signals?.posts) ? signals.posts : [];
  const profile = signals?.profile ?? null;
  const postsAnalyzed = posts.length;

  const system = `You are IGCloner's senior content intelligence analyst.
You receive raw Instagram scrape data and produce a complete, precise intelligence report.
You NEVER fabricate data. If a field is genuinely unavailable, say "Not available" — but NEVER
return 0% for calculated fields when post data exists to calculate from.

CRITICAL DATA RULES:
1. Content pillar percentages MUST be calculated from the actual posts array below
2. Engagement rate MUST be calculated: ((totalLikes + totalComments) / postsAnalyzed) / followerCount * 100
3. Best posting times MUST be derived from timestamps of highest-performing posts (UTC)
4. Every hook pattern MUST be extracted from ACTUAL caption opening lines, quoted verbatim — never invented
5. Content format distribution MUST be counted from actual post types in the data
6. Return ONLY valid JSON. No markdown fences, no explanation.`;

  const user = `SUBJECT: ${subject} (mode: ${mode})
PROFILE: ${JSON.stringify(profile).slice(0, 4000)}
POSTS ANALYZED: ${postsAnalyzed}
POSTS DATA:
${JSON.stringify(posts).slice(0, 45000)}

Return a single JSON object with BOTH the detailed schema AND the compact legacy keys used by the UI.
Schema:
{
  "profileSummary": { "username": string, "displayName": string, "bio": string, "followerCount": number, "followingCount": number, "totalPosts": number, "postsAnalyzed": number, "isVerified": boolean, "isBusinessAccount": boolean, "businessCategory": string, "externalUrl": string },
  "performanceMetrics": {
    "engagementRate": "X.XX%",
    "engagementRateFormula": "((totalLikes + totalComments) / postsAnalyzed) / followerCount * 100",
    "avgLikesPerPost": number,
    "avgCommentsPerPost": number,
    "avgViewsPerReel": number,
    "totalLikesAnalyzed": number,
    "totalCommentsAnalyzed": number,
    "highestLikedPost": { "likes": number, "captionExcerpt": string, "postType": string, "url": string },
    "highestCommentedPost": { "comments": number, "captionExcerpt": string, "postType": string, "url": string },
    "engagementBenchmark": "above average" | "average" | "below average",
    "viralPostCount": number,
    "viralThreshold": "posts with 3x or more avg engagement"
  },
  "contentFormatDistribution": { "imagePercent": number, "reelPercent": number, "carouselPercent": number, "dominantFormat": string, "formatInsight": string },
  "postingStrategy": { "frequency": string, "consistencyScore": number, "bestPerformingDays": [string], "bestPerformingTimes": [string], "postingPatternInsight": string },
  "hookAnalysis": {
    "dominantHookTypes": [string],
    "provenHooks": [{ "hookType": string, "actualOpeningLine": string, "engagementOnThisPost": number, "whyItWorked": string }],
    "captionLengthPattern": string,
    "captionStructure": string,
    "ctaPatterns": [string],
    "emojiUsagePattern": string,
    "hashtagStrategy": string
  },
  "audienceIntelligence": { "primaryAudience": string, "audienceLanguage": string, "communitySignals": [string], "painPointsAddressed": [string], "desiresAddressed": [string], "psychographics": string },
  "competitivePosition": { "nicheStrengths": [string], "contentGaps": [string], "opportunityScore": number, "opportunityReasoning": string, "competitionLevel": "low"|"medium"|"high"|"very high", "differentiationPotential": string },
  "visualStyleAnalysis": { "colorPaletteObserved": string, "editingStyle": string, "textOverlayUsage": string, "thumbnailPattern": string, "brandingConsistency": string },

  "executiveSummary": string,
  "opportunityScore": number,
  "audienceProfile": { "who": string, "desires": [string], "painPoints": [string], "psychographics": string },
  "contentPillars": [{ "name": string, "share": number, "description": string, "avgEngagement": string, "topPerformingExample": string }],
  "topTopics": [{ "topic": string, "why": string }],
  "commonHooks": [{ "pattern": string, "example": string }],
  "captionStructure": { "typicalLength": string, "tone": string, "openingStyle": string, "ctaStyle": string },
  "thumbnailPatterns": string,
  "visualStyle": { "palette": string, "composition": string, "textOverlay": string, "editStyle": string },
  "postingFrequency": string,
  "postingTimes": string,
  "engagementTrends": string,
  "mostShared": string,
  "mostSaved": string,
  "ctaPatterns": [string],
  "brandVoice": string,
  "storytellingStyle": string,
  "growthOpportunities": [string],
  "weaknesses": [string],
  "missedOpportunities": [string],
  "competitiveAdvantages": [string]
}

IMPORTANT:
- "contentPillars" MUST sum to ~100 and MUST be derived from the actual captions. Do NOT return 0% for real pillars.
- If posts array is empty, still return the JSON but set pillars to [] and mark performanceMetrics numeric fields to 0.
- Legacy compact keys (executiveSummary, audienceProfile, contentPillars, commonHooks, captionStructure, etc.) MUST be filled and stay consistent with the detailed ones.`;

  const { text } = await generateText({ model, system, prompt: user });
  const dna = parseJsonish<any>(text);
  const score =
    Number(dna?.opportunityScore ?? dna?.competitivePosition?.opportunityScore ?? 0) || 0;
  return { dna, score, postsAnalyzed };
}

// ══════════════════════════════════════════════════════════════════════
// Public server functions
// ══════════════════════════════════════════════════════════════════════

const CreateInput = z.object({
  mode: z.enum(["niche", "competitor", "topic"]),
  subject: z.string().min(1).max(200),
});

export const createResearchReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("research_reports")
      .insert({ user_id: userId, mode: data.mode, subject: data.subject, status: "scraping" })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Failed to create report");

    try {
      const signals = await collectSignals(data.mode, data.subject);
      await supabase
        .from("research_reports")
        .update({ status: "analyzing", raw_data: signals })
        .eq("id", row.id);

      const { dna, score } = await generateDnaReport(data.mode, data.subject, signals);
      await supabase
        .from("research_reports")
        .update({ status: "ready", dna_report: dna, opportunity_score: score })
        .eq("id", row.id);

      // Auto-register competitor into watchlist for the Dashboard widget.
      if (data.mode === "competitor") {
        await supabase
          .from("competitor_watchlist")
          .upsert(
            { user_id: userId, handle: signals.subject, platform: "instagram", last_report_id: row.id },
            { onConflict: "user_id,platform,handle" },
          );
      }
      return { id: row.id };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase
        .from("research_reports")
        .update({ status: "failed", error_message: msg })
        .eq("id", row.id);
      throw new Error(msg);
    }
  });

export const listResearchReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("research_reports")
      .select("id, mode, subject, status, opportunity_score, is_saved, error_message, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { reports: data ?? [] };
  });

const IdInput = z.object({ id: z.string().uuid() });

export const getResearchReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: report, error } = await context.supabase
      .from("research_reports")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const { data: ideas } = await context.supabase
      .from("content_ideas")
      .select("*")
      .eq("research_report_id", data.id)
      .order("confidence_score", { ascending: false });
    return { report, ideas: ideas ?? [] };
  });

export const toggleSaveResearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: cur } = await context.supabase
      .from("research_reports")
      .select("is_saved")
      .eq("id", data.id)
      .single();
    const next = !cur?.is_saved;
    await context.supabase.from("research_reports").update({ is_saved: next }).eq("id", data.id);
    return { is_saved: next };
  });

export const deleteResearchReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("research_reports").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Content Opportunity Engine — 50 ranked ideas per report ──────────

export const generateContentIdeas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: report, error } = await supabase
      .from("research_reports")
      .select("id, mode, subject, dna_report, status")
      .eq("id", data.id)
      .single();
    if (error || !report) throw new Error("Report not found");
    if (report.status !== "ready") throw new Error("Report is not ready yet");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-2.5-flash");

    const system = `You generate high-signal Instagram content ideas grounded in a Content DNA report. Return ONLY a JSON array of 50 items. No prose.`;
    const shape = `[{
  "title": string,
  "hook": string,
  "description": string,
  "format": "Reel"|"Carousel"|"Post"|"Story",
  "platform": string,
  "cta": string,
  "hashtags": [string],
  "virality_score": 0-100,
  "difficulty_score": 0-100,
  "competition_score": 0-100,
  "business_value_score": 0-100,
  "audience_interest_score": 0-100,
  "production_time_score": 0-100,
  "confidence_score": 0-100
}]`;
    const prompt = `Subject: ${report.subject} (${report.mode})\nContent DNA:\n${JSON.stringify(report.dna_report).slice(0, 20000)}\n\nGenerate exactly 50 distinct ideas following:\n${shape}`;

    const { text } = await generateText({ model, system, prompt });
    const ideas = parseJsonish<any[]>(text);
    if (!Array.isArray(ideas) || ideas.length === 0) throw new Error("AI returned no ideas");

    // Wipe prior ideas so re-runs don't duplicate.
    await supabase.from("content_ideas").delete().eq("research_report_id", data.id);

    const rows = ideas.slice(0, 50).map((i: any) => ({
      user_id: userId,
      research_report_id: data.id,
      title: String(i.title ?? "Untitled").slice(0, 200),
      hook: String(i.hook ?? "").slice(0, 400),
      description: String(i.description ?? "").slice(0, 1000),
      format: String(i.format ?? "Post"),
      platform: String(i.platform ?? "Instagram"),
      cta: String(i.cta ?? ""),
      hashtags: Array.isArray(i.hashtags) ? i.hashtags.slice(0, 20) : [],
      virality_score: Number(i.virality_score) || 0,
      difficulty_score: Number(i.difficulty_score) || 0,
      competition_score: Number(i.competition_score) || 0,
      business_value_score: Number(i.business_value_score) || 0,
      audience_interest_score: Number(i.audience_interest_score) || 0,
      production_time_score: Number(i.production_time_score) || 0,
      confidence_score: Number(i.confidence_score) || 0,
    }));
    const { data: inserted, error: insErr } = await supabase
      .from("content_ideas")
      .insert(rows)
      .select("*");
    if (insErr) throw new Error(insErr.message);
    return { ideas: inserted ?? [] };
  });

// ── Dashboard widgets ────────────────────────────────────────────────

export const getResearchDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [recent, saved, watch, ideas] = await Promise.all([
      context.supabase
        .from("research_reports")
        .select("id, mode, subject, opportunity_score, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      context.supabase
        .from("research_reports")
        .select("id, mode, subject, opportunity_score, created_at")
        .eq("is_saved", true)
        .order("created_at", { ascending: false })
        .limit(5),
      context.supabase
        .from("competitor_watchlist")
        .select("id, handle, display_name, platform, last_report_id")
        .order("created_at", { ascending: false })
        .limit(10),
      context.supabase
        .from("content_ideas")
        .select("id, title, format, platform, virality_score, confidence_score, research_report_id")
        .order("confidence_score", { ascending: false })
        .limit(8),
    ]);
    return {
      recent: recent.data ?? [],
      saved: saved.data ?? [],
      watchlist: watch.data ?? [],
      trending: ideas.data ?? [],
    };
  });

const WatchInput = z.object({ handle: z.string().min(1).max(80), display_name: z.string().optional() });

export const addCompetitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => WatchInput.parse(d))
  .handler(async ({ data, context }) => {
    const handle = data.handle.replace(/^@/, "").trim();
    const { data: row, error } = await context.supabase
      .from("competitor_watchlist")
      .upsert(
        { user_id: context.userId, handle, display_name: data.display_name, platform: "instagram" },
        { onConflict: "user_id,platform,handle" },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { competitor: row };
  });

export const removeCompetitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("competitor_watchlist").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Save a Content Idea into the Campaign Planner (calendar_items) ────

const SaveIdeaInput = z.object({
  idea_id: z.string().uuid(),
  scheduled_for: z.string().optional(), // ISO date (YYYY-MM-DD)
});

export const saveIdeaToPlanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveIdeaInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: idea, error } = await supabase
      .from("content_ideas")
      .select("*")
      .eq("id", data.idea_id)
      .single();
    if (error || !idea) throw new Error("Idea not found");

    // Default: schedule for tomorrow if no date supplied.
    let scheduled = data.scheduled_for;
    if (!scheduled) {
      const t = new Date();
      t.setDate(t.getDate() + 1);
      scheduled = t.toISOString().slice(0, 10);
    }

    const { data: inserted, error: insErr } = await supabase
      .from("calendar_items")
      .insert({
        user_id: userId,
        research_report_id: (idea as any).research_report_id ?? null,
        niche: null,
        scheduled_for: scheduled,
        post_type: (idea as any).format ?? "Post",
        title: (idea as any).title ?? null,
        hook: (idea as any).hook ?? null,
        caption: (idea as any).description ?? null,
        cta: (idea as any).cta ?? null,
        platforms: (idea as any).platform ? [(idea as any).platform] : ["Instagram"],
        hashtags: Array.isArray((idea as any).hashtags) ? (idea as any).hashtags : [],
        priority: "normal",
        confidence: Number((idea as any).confidence_score) || 0,
        status: "planned",
      })
      .select("id, scheduled_for")
      .single();
    if (insErr) throw new Error(insErr.message);
    return { item: inserted };
  });