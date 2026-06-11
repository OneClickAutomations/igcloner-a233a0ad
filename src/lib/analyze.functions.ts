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

  const endpoint = `https://api.apify.com/v2/acts/apify~instagram-post-scraper/run-sync-get-dataset-items?token=${token}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: [url],
      resultsLimit: 1,
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

const ANALYSIS_SYSTEM_PROMPT = `You are an elite Instagram content strategist. Given the raw scraped data of a viral Instagram post, deconstruct exactly WHY it works and generate 5 original cloned versions a creator can publish as their own.

Return ONLY valid JSON matching this exact schema (no markdown, no commentary):
{
  "dna": {
    "contentSummary": "string - 1-2 sentence summary of what this post is",
    "contentCategory": "Educational | Entertainment | Inspirational | Promotional | Story",
    "performanceScore": number 0-100,
    "whyItWorks": ["5 specific bullet points"],
    "targetAudience": { "who": "string", "desire": "string", "trigger": "string" },
    "hookBreakdown": { "type": "string", "score": number 1-10, "whatWorks": "string", "improvement": "string" },
    "emotionalArchitecture": { "curiosity": 0-100, "fomo": 0-100, "trust": 0-100, "relatability": 0-100, "urgency": 0-100, "inspiration": 0-100 },
    "storyStructure": [{ "section": "string", "timing": "string", "purpose": "string" }],
    "captionDNA": { "structure": "string", "tone": "string", "persuasionStyle": "string", "ctaType": "string", "score": 1-10 },
    "visualStyle": { "colorMood": "string", "composition": "string", "textOverlay": "string", "editStyle": "string", "score": 1-10 },
    "engagementDrivers": ["3 bullet points"],
    "monetizationPotential": "string"
  },
  "clones": [
    {
      "versionNumber": 1,
      "angleType": "direct",
      "angleLabel": "Direct Improvement",
      "hook": "string",
      "angle": "string explaining the strategic angle",
      "storyStructure": "string",
      "caption": "full publishable caption with line breaks and hashtags",
      "visualDirection": "string",
      "cta": "string"
    }
    // ... 5 total: direct, contrarian, story, authority, curiosity
  ]
}

Principle: Steal the strategy. Never the content. Each clone must be ORIGINAL — different hook, different framing, different examples — while keeping the underlying structural pattern that made the original work.`;

async function analyzeWithAI(scraped: ScrapedPost, postType: string) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const userPrompt = `Analyze this Instagram ${postType} and generate 5 original clones.

SOURCE DATA:
- Account: @${scraped.ownerUsername}
- Type: ${scraped.type} (${postType})
- Likes: ${scraped.likesCount?.toLocaleString() ?? "?"}
- Comments: ${scraped.commentsCount?.toLocaleString() ?? "?"}
- Views: ${(scraped.videoViewCount ?? scraped.videoPlayCount)?.toLocaleString() ?? "n/a"}
- Hashtags: ${(scraped.hashtags ?? []).join(", ") || "none"}

CAPTION:
"""
${scraped.caption ?? "(no caption)"}
"""

Return the JSON exactly as specified.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (res.status === 429) throw new Error("Rate limit exceeded. Please try again shortly.");
  if (res.status === 402) throw new Error("AI credits depleted. Please add credits to continue.");
  if (!res.ok) {
    const text = await res.text();
    console.error("[AI] error:", res.status, text);
    throw new Error("AI analysis failed");
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty AI response");

  try {
    return JSON.parse(content);
  } catch (e) {
    console.error("[AI] parse error:", content);
    throw new Error("AI returned malformed JSON");
  }
}

export const analyzeInstagramPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const postType = detectPostType(data.url);

    // Scrape
    const scraped = await scrapeInstagram(data.url);

    // Analyze with AI
    const ai = await analyzeWithAI(scraped, postType);
    const dna = ai.dna;
    const clones = ai.clones ?? [];

    // Persist
    const { data: analysis, error: aErr } = await supabase
      .from("analyses")
      .insert({
        user_id: userId,
        instagram_url: data.url,
        post_type: postType,
        source_account: scraped.ownerUsername,
        source_caption: scraped.caption,
        performance_score: dna?.performanceScore ?? null,
        scraped_data: scraped as any,
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

    return {
      analysisId: analysis.id,
      dna: { ...dna, sourceAccount: scraped.ownerUsername, postType },
      clones,
    };
  });