import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText, type ModelMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { computeViralScore } from "@/lib/scoring";

const InputSchema = z.object({
  url: z
    .string()
    .url()
    .refine((u) => u.includes("instagram.com"), {
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
  thumbnailUrl?: string;
  videoUrl?: string;
  productType?: string;
  timestamp?: string;
  locationName?: string;
  isSponsored?: boolean;
  firstComment?: string;
  musicInfo?: any;
  owner?: {
    username?: string;
    fullName?: string;
    followersCount?: number;
    followingCount?: number;
    mediaCount?: number;
    verified?: boolean;
    isBusinessAccount?: boolean;
    biography?: string;
    externalUrl?: string;
    profilePicUrl?: string;
    businessCategoryName?: string;
    isPrivate?: boolean;
  };
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
  const post = items[0];

  // Two-step: if owner.followersCount is missing, scrape the profile separately
  // so the Post Intelligence card can show real follower / media counts.
  const username = post.ownerUsername || post.owner?.username;
  if (username && !(post.owner?.followersCount && post.owner.followersCount > 0)) {
    try {
      const profEndpoint = `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${token}`;
      const profRes = await fetch(profEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: [username] }),
      });
      if (profRes.ok) {
        const profItems = (await profRes.json()) as any[];
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
      } else {
        console.warn("[Apify] profile scrape failed:", profRes.status);
      }
    } catch (e) {
      console.warn("[Apify] profile scrape error:", (e as Error).message);
    }
  }

  return post;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function collectImageUrls(scraped: unknown): string[] {
  const urls = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === "string" && /^https?:\/\//i.test(value)) urls.add(value);
  };
  const post = asRecord(scraped);
  add(post.displayUrl);
  add(post.thumbnailUrl);
  add(post.imageUrl);
  for (const r of Array.isArray(post.displayResources) ? post.displayResources : []) {
    add(asRecord(r).src);
  }
  const children = Array.isArray(post.childPosts)
    ? post.childPosts
    : Array.isArray(post.children)
      ? post.children
      : [];
  for (const childValue of children) {
    const child = asRecord(childValue);
    add(child.displayUrl);
    add(child.thumbnailUrl);
    add(child.imageUrl);
    for (const r of Array.isArray(child.displayResources) ? child.displayResources : []) {
      add(asRecord(r).src);
    }
  }
  return Array.from(urls).slice(0, 4);
}

async function fetchVisionImage(
  scraped: ScrapedPost | null,
): Promise<{ image: Uint8Array; mediaType: string; sourceUrl: string } | null> {
  for (const sourceUrl of collectImageUrls(scraped)) {
    try {
      const res = await fetch(sourceUrl, {
        headers: {
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          Referer: "https://www.instagram.com/",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        },
      });
      const mediaType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
      if (!res.ok || !mediaType.startsWith("image/")) continue;
      const buffer = await res.arrayBuffer();
      if (buffer.byteLength === 0 || buffer.byteLength > 8 * 1024 * 1024) continue;
      return { image: new Uint8Array(buffer), mediaType, sourceUrl };
    } catch (e) {
      console.warn("[analyze] source image fetch failed:", (e as Error).message);
    }
  }
  return null;
}

function sourceEvidence(scraped: unknown, visionImageUrl?: string | null): string {
  const post = asRecord(scraped);
  const owner = asRecord(post.owner);
  return JSON.stringify(
    {
      imageAttachedForVision: Boolean(visionImageUrl),
      visionImageUrl: visionImageUrl ?? null,
      caption: post.caption ?? null,
      altText: post.alt ?? post.accessibilityCaption ?? null,
      firstComment: post.firstComment ?? null,
      hashtags: post.hashtags ?? [],
      location: post.locationName ?? null,
      accountBio: owner.biography ?? null,
    },
    null,
    2,
  );
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
    contentMedium: z
      .object({
        primary: z.string(),
        secondary: z.string().nullable().optional(),
        description: z.string().optional(),
        mediumIsTheMessage: z.boolean().optional(),
        replicationInstructions: z.string().optional(),
        mediumSignals: z.array(z.string()).optional(),
      })
      .optional(),
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
    channelIntelligence: z
      .object({
        primaryNiche: z.string().optional(),
        audienceLanguage: z.string().optional(),
        isLikelyMonetized: z.boolean().optional(),
        estimatedMonthlyViews: z.string().optional(),
        estimatedMonthlyRevenue: z.string().optional(),
        postingFrequency: z.string().optional(),
        engagementRate: z.number().optional(),
        contentStrengths: z.array(z.string()).optional(),
      })
      .optional(),
    videoVisualDNA: z
      .object({
        subjectType: z.string().optional(),
        subjectDescription: z.string().optional(),
        backgroundType: z.string().optional(),
        backgroundDescription: z.string().optional(),
        colorPalette: z
          .object({
            dominant: z.string().optional(),
            secondary: z.string().optional(),
            accent: z.string().optional(),
            mood: z.string().optional(),
            approximateHex: z.array(z.string()).optional(),
          })
          .optional(),
        textStyle: z
          .object({
            present: z.boolean().optional(),
            placement: z.string().optional(),
            fontStyle: z.string().optional(),
            fontSize: z.string().optional(),
            color: z.string().optional(),
            animation: z.string().optional(),
          })
          .optional(),
        lightingStyle: z.string().optional(),
        editingStyle: z.string().optional(),
        paceAndEnergy: z.string().optional(),
        contentFormat: z.string().optional(),
        audioStyle: z.string().optional(),
        productionLevel: z.string().optional(),
        platformAesthetic: z.string().optional(),
        recreationInstructions: z
          .union([z.string(), z.array(z.string())])
          .transform((v) =>
            Array.isArray(v)
              ? v
                  .map((s, i) => {
                    const t = String(s).trim();
                    return /^\d+[.)]/.test(t) ? t : `${i + 1}. ${t}`;
                  })
                  .join("\n")
              : v,
          )
          .optional(),
      })
      .nullable()
      .optional(),
  }),
  forensics: z.any().optional(),
  clones: z.array(CloneSchema).length(5),
});

async function analyzePostCombined(scraped: ScrapedPost | null, url: string, postType: string) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
  const gateway = createLovableAiGatewayProvider(apiKey);
  // Flash is multimodal + fast enough to fit the worker's HTTP window. Pro
  // routinely exceeds 45s on this combined (DNA + forensics + 5 clones) prompt.
  const model = gateway("google/gemini-2.5-flash");
  const visionImage = await fetchVisionImage(scraped);

  const system = `You are IG-Cloner's forensic Instagram analyst. First extract the literal evidence from the post image/video thumbnail: visible text/OCR, subject, symbols, setting, objects, emotions, and visual hierarchy. Then infer why it works and create variations. Never invent a topic from the URL alone. If the user later chooses a different niche, downstream ideas must preserve the source post's core message, emotional mechanism, and visual metaphor while translating it into that niche. Return ONLY a single JSON object with no prose, no markdown fences.`;

  const forensicsBlock =
    postType === "Reel"
      ? `"videoForensics": {
      "hook": { "type": string, "element": string, "exactVisibleText": string, "openingAction": string, "curiosityGap": string, "audioHook": string, "strength": number },
      "pacing": { "overall": "very-fast"|"fast"|"medium"|"slow", "averageCutDuration": number, "transitionTypes": string, "rhythmSynced": boolean, "bRollUsage": "heavy"|"moderate"|"minimal"|"none" },
      "visual": { "shootingStyle": string, "cameraMovements": string, "shotTypes": string, "colorGrade": string, "productionQuality": string },
      "audio": { "musicType": string, "musicEnergy": string, "voiceover": string, "audioVisualSync": string },
      "structure": { "type": string, "act1": string, "act2": string, "act3": string, "cta": string },
      "performance": { "replayValue": number, "saveValue": number, "shareTrigger": string, "commentTrigger": string, "loopQuality": number }
    }`
      : postType === "Carousel"
      ? `"carouselForensics": {
      "overall": { "totalSlides": number, "carouselType": string, "narrativeArc": string, "contentDensity": string, "visualConsistency": string },
      "slide1": { "hookMechanism": string, "exactVisibleText": string, "layout": string, "colorScheme": string, "typography": string, "firstImpressionScore": number },
      "middleSlides": [{ "purpose": string, "informationDensity": string, "visualType": string, "layoutTemplate": string, "microHook": string }],
      "finalSlide": { "ctaType": string, "urgencyElement": string, "brandElement": string },
      "designSystem": { "colorPalette": string, "fontSystem": string, "gridSystem": string, "iconStyle": string, "whiteSpaceUsage": string },
      "contentStrategy": { "saveWorthiness": number, "valueDelivery": string, "educationalDepth": string }
    }`
      : `"imageForensics": {
      "subject": { "primary": string, "position": string, "actionPose": string, "expression": string },
      "composition": { "technique": string, "foreground": string, "background": string, "depthOfField": string, "visualWeight": string },
      "color": { "dominant": string, "paletteType": string, "temperature": string, "saturation": string, "contrast": string, "mood": string, "hex": string[] },
      "lighting": { "source": string, "direction": string, "shadowQuality": string, "overallExposure": string },
      "text": { "present": boolean, "exactVisibleText": string, "position": string, "style": string, "hierarchy": string },
      "editing": { "filterStyle": string, "sharpness": string, "grain": string },
      "categorySignals": { "aspirationalLevel": string, "authenticityLevel": string },
      "psychology": { "primaryVisualHook": string, "emotionalResponse": string, "saveWorthinessElements": string, "shareWorthiness": string }
    }`;

  const prompt = `Analyze this Instagram ${postType} and produce a DNA report, a forensic extraction, and 5 clone versions. Return ONLY valid JSON matching this exact shape (no markdown, no commentary):

{
  "dna": {
    "contentSummary": string,
    "contentCategory": "Educational"|"Storytelling"|"Motivational"|"Entertainment"|"Business"|"Lifestyle",
    "performanceScore": number (0-100),
    "whyItWorks": string[],
    "targetAudience": { "who": string, "desire": string, "trigger": string },
    "contentMedium": {
      "primary": "handwriting-on-paper"|"handwriting-on-surface"|"printed-text-photo"|"talking-head-video"|"broll-video"|"lifestyle-photo"|"studio-photo"|"product-photo"|"screenshot"|"digital-graphic"|"illustrated"|"meme-format"|"text-on-video"|"animation"|"ugc-authentic"|"mixed",
      "secondary": (one of the same options, or null),
      "description": string (1-2 sentences describing the literal physical/digital format — e.g. "Handwritten black ink on white paper, photographed flat-lay. The handwriting itself IS the content."),
      "mediumIsTheMessage": boolean (true if the medium itself is what makes the post work — handwriting, screenshot, meme, UGC, etc.),
      "replicationInstructions": string (concrete how-to recreate this exact medium — e.g. "Photograph real handwriting on paper, do not use digital fonts that simulate handwriting"),
      "mediumSignals": string[] (2-4 reasons this medium works in feed)
    },
    "hookBreakdown": { "type": "Question"|"Shocking Stat"|"Bold Claim"|"Pattern Interrupt"|"Story Open"|"Curiosity Gap"|"FOMO", "score": number, "whatWorks": string, "improvement": string },
    "emotionalArchitecture": { "curiosity": number, "fomo": number, "trust": number, "relatability": number, "urgency": number, "inspiration": number },
    "storyStructure": [{ "section": string, "timing": string, "purpose": string }],
    "captionDNA": { "structure": "Micro"|"Standard"|"Long-form", "tone": string, "persuasionStyle": "Problem-Agitate-Solve"|"Story"|"List"|"Direct"|"Curiosity", "ctaType": "Soft"|"Hard"|"Engagement"|"None", "score": number },
    "visualStyle": { "colorMood": string, "composition": string, "textOverlay": "None"|"Subtle"|"Heavy", "editStyle": string, "score": number },
    "engagementDrivers": string[],
    "monetizationPotential": string,
    "channelIntelligence": {
      "primaryNiche": string,
      "audienceLanguage": string (e.g. "English", "English / Japanese"),
      "isLikelyMonetized": boolean,
      "estimatedMonthlyViews": string (range like "2M-4M"),
      "estimatedMonthlyRevenue": string (range like "$1,200-$3,800" if monetized, else ""),
      "postingFrequency": string (e.g. "4-5x/week"),
      "engagementRate": number,
      "contentStrengths": string[]
    },
    "videoVisualDNA": {
      "subjectType": "person-lifestyle"|"person-athlete"|"person-celebrity"|"person-business"|"text-graphic"|"product"|"animal"|"landscape"|"abstract"|"mixed",
      "subjectDescription": string,
      "backgroundType": "solid-color"|"gradient"|"blurred-bokeh"|"urban-city"|"nature-outdoor"|"gym-fitness"|"office-professional"|"home-lifestyle"|"studio-clean"|"abstract-dark"|"text-overlay-only"|"mixed",
      "backgroundDescription": string,
      "colorPalette": { "dominant": string, "secondary": string, "accent": string, "mood": "warm"|"cool"|"neutral"|"high-contrast"|"monochromatic"|"vibrant"|"muted", "approximateHex": string[] },
      "textStyle": { "present": boolean, "placement": "center"|"top"|"bottom"|"overlay"|"none", "fontStyle": "bold-sans-serif"|"thin-minimal"|"script"|"handwritten"|"display"|"mixed", "fontSize": "large-dominant"|"medium-balanced"|"small-subtle", "color": "white"|"black"|"colored"|"gradient", "animation": "static"|"fade-in"|"typewriter"|"none"|"unknown" },
      "lightingStyle": "bright-high-key"|"dark-moody"|"golden-hour"|"blue-hour"|"neon"|"natural-daylight"|"studio-clean"|"low-key-dramatic"|"backlit-silhouette"|"no-lighting-text-only",
      "editingStyle": "raw-unedited"|"minimal-clean"|"cinematic-graded"|"high-contrast"|"vintage-film"|"bright-airy"|"dark-moody"|"text-motion-graphics"|"none",
      "paceAndEnergy": "slow-emotional"|"medium-storytelling"|"fast-energetic"|"very-fast-hype"|"static-no-movement"|"text-scroll-only",
      "contentFormat": "talking-head"|"b-roll-voiceover"|"text-on-screen-only"|"text-with-background"|"person-with-text-overlay"|"product-showcase"|"cinematic-no-person"|"mixed",
      "audioStyle": "energetic-music"|"emotional-music"|"lo-fi-ambient"|"voice-only"|"voice-plus-music"|"silence"|"trending-sound",
      "productionLevel": "iphone-casual-ugc"|"produced-ugc"|"semi-professional"|"professional-studio"|"motion-graphics-only"|"ai-generated",
      "platformAesthetic": string (one-sentence director brief),
      "recreationInstructions": string (3-5 numbered concrete instructions)
    }
  },
  "clones": [
    { "versionNumber": 1, "angleType": "direct", "angleLabel": "Direct Improvement", "hook": string, "angle": string, "storyStructure": string, "caption": string, "visualDirection": string, "cta": string },
    { "versionNumber": 2, "angleType": "contrarian", "angleLabel": "Contrarian Angle", ... },
    { "versionNumber": 3, "angleType": "story", "angleLabel": "Storytelling Angle", ... },
    { "versionNumber": 4, "angleType": "authority", "angleLabel": "Authority Angle", ... },
    { "versionNumber": 5, "angleType": "curiosity", "angleLabel": "Curiosity Gap", ... }
  ],
  "forensics": { ${forensicsBlock} }
}

SOURCE EVIDENCE — ground every field in this before strategy:
${sourceEvidence(scraped, visionImage?.sourceUrl)}

URL: ${url}
Account: @${scraped?.ownerUsername ?? "unknown"}
Followers: ${scraped?.owner?.followersCount ?? "unknown"}
Total posts: ${scraped?.owner?.mediaCount ?? "unknown"}
Category: ${scraped?.owner?.businessCategoryName ?? "unknown"}
Verified: ${scraped?.owner?.verified ?? false}
Caption: "${scraped?.caption ?? "Not available"}"
Likes: ${scraped?.likesCount ?? "Unknown"}
Comments: ${scraped?.commentsCount ?? "Unknown"}
${scraped?.videoViewCount || scraped?.videoPlayCount ? `Views: ${scraped.videoViewCount ?? scraped.videoPlayCount}` : ""}
Hashtags: ${(scraped?.hashtags ?? []).join(", ") || "none"}

Critical grounding rules:
- If an image is attached, read it directly and include the actual visible words in contentSummary / hookBreakdown / forensics. Do not summarize around them.
- If the image contains religious, spiritual, financial, health, or other domain-specific text, preserve that source message as the anchor even when cloning into another niche later.
- contentSummary must name the exact visible text/message and the main visual subject/context, not a generic category.
- whyItWorks must cite concrete source evidence: visible words, visual subject, contrast, emotion, layout, caption, or account context.
- Clones must transform the source's MECHANISM and MESSAGE; they must not become generic content for a niche.
- contentMedium MUST describe the LITERAL physical/digital format the post exists in (handwriting on paper, screenshot, talking-head video, digital graphic, etc.) — not the topic, not the niche, not the colors. If you see real human handwriting on real paper, the primary MUST be "handwriting-on-paper" and mediumIsTheMessage MUST be true. If you see a designed digital quote card, it is "digital-graphic". Be honest and literal — this field decides whether downstream studios preserve the format or abandon it.

Each clone needs a compelling hook, unique angle, beat-by-beat story structure, ready-to-post caption with line breaks/emojis and CTA, visual direction, and CTA. Never copy source content — use as inspiration only. Output the full JSON for all 5 clones; do not abbreviate with "...".

The "forensics" object is REQUIRED. Be specific and surgical — these data points will be used to recreate the exact formula or generate inspired versions in downstream studios.`;

  // Hard timeout so we never silently exceed the dev/edge HTTP window.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const messages: ModelMessage[] | undefined = visionImage
      ? [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image", image: visionImage.image, mediaType: visionImage.mediaType },
            ],
          },
        ]
      : undefined;
    const { text } = await generateText({
      model,
      system,
      ...(messages ? { messages } : { prompt }),
      abortSignal: controller.signal,
    });
    const parsed = parseJsonish<z.infer<typeof AnalyzeSchema>>(text);
    return AnalyzeSchema.parse(parsed);
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
      const forensics = (combined as any).forensics ?? null;
      if (forensics) {
        // Co-locate forensics inside the dna_analysis JSON so studios get it for free.
        dna.forensics = forensics;
      }
      console.log("[analyze] AI complete", {
        clones: clones?.length ?? 0,
        ms: Date.now() - aiStarted,
      });

      // Viral score (deterministic, derived from scraped metrics)
      const viral = computeViralScore(scraped);

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
          viral_score: viral.score,
          viral_band: viral.band,
          viral_factors: viral.factors as any,
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
          scraped: scraped ?? null,
          instagramUrl: data.url,
          fallback,
          viral,
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
    // Recompute viral score on read so older rows without persisted score still display one.
    const viral = computeViralScore((analysis as any).scraped_data ?? null);
    return {
      analysisId: analysis.id,
      createdAt: analysis.created_at,
      dna: { ...dna, sourceAccount: analysis.source_account, postType: analysis.post_type },
      scraped: (analysis as any).scraped_data ?? null,
      instagramUrl: analysis.instagram_url,
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