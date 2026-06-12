import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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
  // Try to locate a JSON object/array if Claude prepended any prose.
  const firstBrace = Math.min(
    ...["{", "["]
      .map((c) => cleaned.indexOf(c))
      .filter((i) => i >= 0),
  );
  const candidate = isFinite(firstBrace) && firstBrace > 0 ? cleaned.slice(firstBrace) : cleaned;
  try {
    return JSON.parse(candidate);
  } catch {
    throw new Error("AI returned malformed JSON");
  }
}

const DNA_SYSTEM = `You are a world-class Instagram content strategist and conversion copywriter. Reverse-engineer WHY content performs. Be specific, tactical, actionable. Return ONLY valid JSON — no markdown, no preamble, no trailing text.`;

async function analyzeDNA(scraped: ScrapedPost | null, url: string, postType: string) {
  const user = `Analyze this Instagram ${postType}:

URL: ${url}
Account: @${scraped?.ownerUsername ?? "unknown"}
Caption: "${scraped?.caption ?? "Not available"}"
Likes: ${scraped?.likesCount ?? "Unknown"}
Comments: ${scraped?.commentsCount ?? "Unknown"}
${scraped?.videoViewCount || scraped?.videoPlayCount ? `Views: ${scraped.videoViewCount ?? scraped.videoPlayCount}` : ""}
Hashtags: ${(scraped?.hashtags ?? []).join(", ") || "none"}

Return this exact JSON structure:
{
  "contentSummary": "string",
  "contentCategory": "Educational|Storytelling|Motivational|Entertainment|Business|Lifestyle",
  "performanceScore": 0-100,
  "whyItWorks": ["string","string","string","string","string"],
  "targetAudience": { "who":"string","desire":"string","trigger":"string" },
  "hookBreakdown": { "type":"Question|Shocking Stat|Bold Claim|Pattern Interrupt|Story Open|Curiosity Gap|FOMO","score":0-10,"whatWorks":"string","improvement":"string" },
  "emotionalArchitecture": { "curiosity":0-100,"fomo":0-100,"trust":0-100,"relatability":0-100,"urgency":0-100,"inspiration":0-100 },
  "storyStructure": [ { "section":"string","timing":"string","purpose":"string" } ],
  "captionDNA": { "structure":"Micro|Standard|Long-form","tone":"string","persuasionStyle":"Problem-Agitate-Solve|Story|List|Direct|Curiosity","ctaType":"Soft|Hard|Engagement|None","score":0-10 },
  "visualStyle": { "colorMood":"string","composition":"string","textOverlay":"None|Subtle|Heavy","editStyle":"string","score":0-10 },
  "engagementDrivers": ["string","string","string"],
  "monetizationPotential": "string"
}`;

  const text = await callClaude({ system: DNA_SYSTEM, user, maxTokens: 4000 });
  return parseJsonish(text);
}

const CLONES_SYSTEM = `You are an expert Instagram content creator and conversion copywriter. Generate 5 completely original content variations inspired by the analyzed post. Each must be distinctly different in angle, hook, and strategy. Never copy the source content — use inspiration only. Return ONLY a valid JSON array.`;

async function generateCloneSet(dna: any) {
  const user = `Based on this content DNA analysis:
${JSON.stringify(dna, null, 2)}

Generate exactly 5 clone versions. Return a JSON array with this structure for each:
[
  {
    "versionNumber": 1,
    "angleType": "direct",
    "angleLabel": "Direct Improvement",
    "hook": "Opening hook (1-2 sentences, extremely compelling)",
    "angle": "Unique positioning in one sentence",
    "storyStructure": "Setup → tension → payoff → CTA — describe each beat in 1 line",
    "caption": "Full ready-to-post caption with line breaks, natural emojis, and CTA at end",
    "visualDirection": "What to film, design, or show visually (2-3 sentences)",
    "cta": "Specific call to action text only"
  }
]

Angles in order: direct improvement, contrarian, storytelling, authority, curiosity gap. Use angleType values: "direct","contrarian","story","authority","curiosity" and matching angleLabel values.`;

  const text = await callClaude({ system: CLONES_SYSTEM, user, maxTokens: 6000 });
  return parseJsonish<any[]>(text);
}

export const analyzeInstagramPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const postType = detectPostType(data.url);

    // Usage gate
    const { data: prof } = await supabase
      .from("profiles")
      .select("analyses_used, analyses_limit")
      .eq("id", userId)
      .single();
    if (prof && (prof.analyses_limit ?? 0) - (prof.analyses_used ?? 0) <= 0) {
      return { limitReached: true as const };
    }

    // Scrape (graceful fallback if APIFY missing/private)
    let scraped: ScrapedPost | null = null;
    let fallback = false;
    try {
      scraped = await scrapeInstagram(data.url);
    } catch (e) {
      console.warn("[Apify] fallback:", (e as Error).message);
      fallback = true;
    }

    const dna = await analyzeDNA(scraped, data.url, postType);
    const clones = await generateCloneSet(dna);

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
      console.error("[DB] analysis insert error:", aErr);
      throw new Error("Failed to save analysis");
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
      if (cErr) console.error("[DB] clones insert error:", cErr);
    }

    // Increment usage
    if (prof) {
      await supabase
        .from("profiles")
        .update({ analyses_used: (prof.analyses_used ?? 0) + 1 })
        .eq("id", userId);
    }

    return {
      analysisId: analysis.id,
      dna: { ...dna, sourceAccount: scraped?.ownerUsername ?? null, postType },
      clones,
      fallback,
    };
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