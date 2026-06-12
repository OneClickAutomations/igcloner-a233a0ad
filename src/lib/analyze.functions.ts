import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText, Output } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const InputSchema = z.object({
  url: z.string().url().refine((u) => u.includes("instagram.com"), {
    message: "Must be an Instagram URL",
  }),
});

type ScrapedPost = {
  caption: string;
  ownerUsername: string;
  likesCount: number;
  commentsCount: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  hashtags?: string[];
  type: string;
  url: string;
  displayUrl?: string;
  videoUrl?: string;
  productType?: string;
};

function detectPostType(url: string): string {
  if (url.includes("/reel/")) return "Reel";
  if (url.includes("/carousel/")) return "Carousel";
  return "Post";
}

async function scrapeInstagram(url: string): Promise<ScrapedPost> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN not configured");

  const endpoint = `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      directUrls: [url],
      resultsLimit: 1,
      resultsType: "posts",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[Apify] error:", res.status, text);
    throw new Error(`Failed to scrape Instagram post (${res.status})`);
  }

  const items = (await res.json()) as ScrapedPost[];
  if (!items || items.length === 0) {
    throw new Error("No data returned for this Instagram URL. It may be private or invalid.");
  }
  return items[0];
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
  const cleaned = text.replace(/```json|```/g, "").trim();
  const firstBrace = Math.min(
    ...["{", "["]
      .map((c) => cleaned.indexOf(c))
      .filter((i) => i >= 0),
  );
  const candidate = isFinite(firstBrace) && firstBrace > 0 ? cleaned.slice(firstBrace) : cleaned;
  try {
    return JSON.parse(candidate);
  } catch (e) {
    console.error("[AI] JSON parse failed. First 400 chars:", candidate.slice(0, 400));
    console.error("[AI] Last 200 chars:", candidate.slice(-200));
    throw new Error("AI returned malformed JSON");
  }
}

// ============= Combined analyze schema (single Lovable AI call) =============
const CloneSchema = z.object({
  versionNumber: z.number(),
  angleType: z.enum(["direct", "contrarian", "story", "authority", "curiosity"]),
  angleLabel: z.string(),
  hook: z.string(),
  angle: z.string(),
  storyStructure: z.string(),
  caption: z.string(),
  visualDirection: z.string(),
  cta: z.string(),
});

const AnalyzeSchema = z.object({
  dna: z.object({
    contentSummary: z.string(),
    contentCategory: z.string(),
    performanceScore: z.number(),
    whyItWorks: z.array(z.string()),
    targetAudience: z.object({ who: z.string(), desire: z.string(), trigger: z.string() }),
    hookBreakdown: z.object({
      type: z.string(),
      score: z.number(),
      whatWorks: z.string(),
      improvement: z.string(),
    }),
    emotionalArchitecture: z.object({
      curiosity: z.number(),
      fomo: z.number(),
      trust: z.number(),
      relatability: z.number(),
      urgency: z.number(),
      inspiration: z.number(),
    }),
    storyStructure: z.array(
      z.object({ section: z.string(), timing: z.string(), purpose: z.string() }),
    ),
    captionDNA: z.object({
      structure: z.string(),
      tone: z.string(),
      persuasionStyle: z.string(),
      ctaType: z.string(),
      score: z.number(),
    }),
    visualStyle: z.object({
      colorMood: z.string(),
      composition: z.string(),
      textOverlay: z.string(),
      editStyle: z.string(),
      score: z.number(),
    }),
    engagementDrivers: z.array(z.string()),
    monetizationPotential: z.string(),
  }),
  clones: z.array(CloneSchema).length(5),
});

async function analyzePostCombined(
  scraped: ScrapedPost | null,
  url: string,
  postType: string,
) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
  const gateway = createLovableAiGatewayProvider(apiKey);
  const model = gateway("google/gemini-3-flash-preview");

  const system = `You are a world-class Instagram content strategist and conversion copywriter. Reverse-engineer WHY content performs, then generate 5 distinct original variations. Be specific, tactical, actionable.`;

  const prompt = `Analyze this Instagram ${postType} and produce a DNA report plus 5 clone versions.

URL: ${url}
Account: @${scraped?.ownerUsername ?? "unknown"}
Caption: "${scraped?.caption ?? "Not available"}"
Likes: ${scraped?.likesCount ?? "Unknown"}
Comments: ${scraped?.commentsCount ?? "Unknown"}
${scraped?.videoViewCount || scraped?.videoPlayCount ? `Views: ${scraped.videoViewCount ?? scraped.videoPlayCount}` : ""}
Hashtags: ${(scraped?.hashtags ?? []).join(", ") || "none"}

Rules for the 5 clones (in this exact order):
1. angleType "direct" / angleLabel "Direct Improvement"
2. angleType "contrarian" / angleLabel "Contrarian Angle"
3. angleType "story" / angleLabel "Storytelling Angle"
4. angleType "authority" / angleLabel "Authority Angle"
5. angleType "curiosity" / angleLabel "Curiosity Gap"
Each clone needs a compelling hook, a unique angle, a beat-by-beat story structure, a ready-to-post caption with natural line breaks/emojis and CTA, a visual direction, and a CTA. Never copy source content — use inspiration only.

For DNA: hookBreakdown.type should be one of "Question","Shocking Stat","Bold Claim","Pattern Interrupt","Story Open","Curiosity Gap","FOMO". contentCategory should be one of "Educational","Storytelling","Motivational","Entertainment","Business","Lifestyle". captionDNA.structure one of "Micro","Standard","Long-form". captionDNA.persuasionStyle one of "Problem-Agitate-Solve","Story","List","Direct","Curiosity". captionDNA.ctaType one of "Soft","Hard","Engagement","None". visualStyle.textOverlay one of "None","Subtle","Heavy". Scores 0-10 or 0-100 as named.`;

  // Hard timeout so we never silently exceed the dev/edge HTTP window.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const { experimental_output } = await generateText({
      model,
      system,
      prompt,
      experimental_output: Output.object({ schema: AnalyzeSchema }),
      abortSignal: controller.signal,
    });
    return experimental_output;
  } finally {
    clearTimeout(timer);
  }
}

export const analyzeInstagramPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    console.log("[analyze] start", { url: data.url });
    try {
      const { supabase, userId } = context;
      const postType = detectPostType(data.url);

      // Usage gate
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("analyses_used, analyses_limit")
        .eq("id", userId)
        .single();
      if (profErr) console.error("[analyze] profile fetch error:", profErr);
      if (prof && (prof.analyses_limit ?? 0) - (prof.analyses_used ?? 0) <= 0) {
        console.log("[analyze] limit reached", prof);
        return { ok: false as const, limitReached: true as const, error: null, data: null };
      }

      // Scrape (graceful fallback if APIFY missing/private)
      let scraped: ScrapedPost | null = null;
      let fallback = false;
      try {
        console.log("[analyze] scraping…");
        scraped = await scrapeInstagram(data.url);
        console.log("[analyze] scrape ok", { owner: scraped?.ownerUsername });
      } catch (e) {
        console.warn("[analyze] scrape fallback:", (e as Error).message);
        fallback = true;
      }

      console.log("[analyze] combined AI call…");
      const aiStarted = Date.now();
      const combined = await analyzePostCombined(scraped, data.url, postType);
      const dna = combined.dna as any;
      const clones = combined.clones as any[];
      console.log("[analyze] AI complete", {
        clones: clones?.length ?? 0,
        ms: Date.now() - aiStarted,
      });

      // Persist
      const { data: analysis, error: aErr } = await supabase
        .from("analyses")
        .insert({
          user_id: userId,
          instagram_url: data.url,
          post_type: postType,
          source_account: scraped?.ownerUsername ?? null,
          source_caption: scraped?.caption ?? null,
          performance_score: dna?.performanceScore ?? null,
          scraped_data: (scraped ?? null) as any,
          dna_analysis: dna as any,
        })
        .select()
        .single();

      if (aErr) {
        console.error("[analyze] DB insert error:", aErr);
        return { ok: false as const, limitReached: false as const, error: "Failed to save analysis", data: null };
      }

      if (clones.length > 0) {
        const cloneRows = clones.map((c: any) => ({
          analysis_id: analysis.id,
          user_id: userId,
          version_number: c.versionNumber,
          angle_type: c.angleType,
          angle: c.angle,
          hook: c.hook,
          story_structure: c.storyStructure,
          caption: c.caption,
          visual_direction: c.visualDirection,
          cta: c.cta,
        }));
        const { error: cErr } = await supabase.from("clones").insert(cloneRows);
        if (cErr) console.error("[analyze] clones insert error:", cErr);
      }

      // Increment usage
      if (prof) {
        await supabase
          .from("profiles")
          .update({ analyses_used: (prof.analyses_used ?? 0) + 1 })
          .eq("id", userId);
      }

      console.log("[analyze] done", { analysisId: analysis.id });
      return {
        ok: true as const,
        limitReached: false as const,
        error: null,
        data: {
          analysisId: analysis.id,
          dna: { ...dna, sourceAccount: scraped?.ownerUsername ?? null, postType },
          clones,
          fallback,
        },
      };
    } catch (err: any) {
      console.error("[analyze] unhandled error:", err);
      const message =
        err?.name === "AbortError"
          ? "Analysis timed out. Please try again."
          : err?.message || "Analysis failed";
      return {
        ok: false as const,
        limitReached: false as const,
        error: message,
        data: null,
      };
    }
  });

export const getAnalysisById = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: analysis, error } = await supabase
      .from("analyses")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (error || !analysis) throw new Error("Analysis not found");

    const { data: clones } = await supabase
      .from("clones")
      .select("*")
      .eq("analysis_id", analysis.id)
      .order("version_number", { ascending: true });

    const dna = analysis.dna_analysis as any;
    return {
      analysisId: analysis.id,
      createdAt: analysis.created_at,
      dna: { ...dna, sourceAccount: analysis.source_account, postType: analysis.post_type },
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