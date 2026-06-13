import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, type ModelMessage } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const AngleSchema = z.object({
  angleNumber: z.number(),
  angleName: z.string(),
  angleType: z.string(),
  hookLine: z.string(),
  sourceConnection: z.string(),
  concept: z.string(),
  whyItWillPerform: z.string(),
  recommendedFormat: z.enum(["reel", "carousel", "image"]),
  viralPotential: z.number().min(0).max(100),
  hookType: z.string(),
});
export type Angle = z.infer<typeof AngleSchema>;

const AnglesSchema = z.object({ angles: z.array(AngleSchema).length(5) });

function parseJsonish(text: string): any {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  return JSON.parse(start > 0 ? cleaned.slice(start) : cleaned);
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
  scraped: unknown,
): Promise<{ image: Uint8Array; mediaType: string } | null> {
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
      return { image: new Uint8Array(buffer), mediaType };
    } catch {
      // Try the next scraped image URL.
    }
  }
  return null;
}

const Input = z.object({
  analysisId: z.string().uuid(),
  niche: z.string().min(1).max(120).optional(),
});

export const generateAngles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const { data: analysis, error } = await supabase
      .from("analyses")
      .select("*")
      .eq("id", data.analysisId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!analysis) throw new Error("Analysis not found");

    const dna = (analysis.dna_analysis as any) ?? {};
    const scraped = (analysis.scraped_data as any) ?? {};
    const visionImage = await fetchVisionImage(scraped);

    // Pull niche: arg > profile default > fallback
    let niche = data.niche;
    if (!niche) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      niche = (prof as any)?.default_niche ?? "general";
    }

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-2.5-flash");

    const system = `You are IGCloner's viral content strategist.
Your job is to reverse-engineer exactly what made a specific post go viral,
then show the user how to recreate that EXACT concept in their own niche.

THE GOLDEN RULE:
Every angle must be a direct translation of the source post's specific concept.
The user must be able to look at the source post and immediately understand
how each angle connects to it.

WRONG approach: User's niche is Fitness + source post is a love note →
Generate generic fitness motivation content.

RIGHT approach: User's niche is Fitness + source post is a love note →
Generate "I love my amazing [fitness thing]" content that uses the exact
same format, aesthetic, emotional tone, and concept as the love note.

The TOPIC changes. The CONCEPT, FORMAT, and EMOTIONAL MECHANIC stay identical.

Return ONLY a JSON object — no prose, no code fences.`;

    const topEmotion =
      Object.entries((dna.emotionalArchitecture ?? {}) as Record<string, number>).sort(
        ([, a], [, b]) => (b as number) - (a as number),
      )[0]?.[0] ?? "curiosity";

    const sourceForensics =
      dna.forensics?.imageForensics ??
      dna.forensics?.carouselForensics ??
      dna.forensics?.videoForensics ??
      dna.forensics ??
      {};
    const sourceText =
      sourceForensics?.text?.exactVisibleText ??
      sourceForensics?.text?.visibleText ??
      sourceForensics?.textOverlay ??
      "";

    const prompt = `Analyze this Instagram post and generate 5 viral angles for the user's niche.

SOURCE POST DETAILS:
Account: @${scraped.ownerUsername ?? "unknown"}
Caption: "${scraped.caption ?? "not available"}"
Post type: ${scraped.type ?? scraped.__typename ?? "post"}
Likes: ${scraped.likesCount ?? scraped.likes ?? "unknown"}
Comments: ${scraped.commentsCount ?? scraped.comments ?? "unknown"}
Visible image text / OCR: ${sourceText || "none extracted"}
Attached image: ${visionImage ? "YES — inspect it directly; it overrides weak or missing OCR above" : "NO"}

CONTENT DNA:
What the post shows/is: ${dna.contentSummary ?? "unknown"}
Why it performed: ${(dna.whyItWorks ?? []).join(" | ")}
Hook type: ${dna.hookBreakdown?.type ?? "?"}
Core emotional mechanic: ${dna.hookBreakdown?.whatWorks ?? ""}
Visual style: ${dna.visualStyle?.colorMood ?? "?"}, ${dna.visualStyle?.composition ?? "?"}
Content format: ${dna.captionDNA?.structure ?? "?"}
Top emotion: ${topEmotion}

USER'S NICHE: ${niche}

STEP 1 — Identify the SPECIFIC CONCEPT of the source post:
Ask yourself: What is this post SPECIFICALLY about?
Not the general topic — the specific idea, format, aesthetic, and emotional beat.
Example: "I love my amazing WIFE ♥" is specifically:
- A raw, handwritten personal declaration
- Directed at a specific person/thing the creator loves
- Simple, unproduced, authentic
- Emotionally vulnerable and direct
- The power is in the specificity of who/what is loved

STEP 2 — Translate that SPECIFIC CONCEPT into the user's niche:
Do not make generic niche content.
Make the EXACT SAME concept but swap the subject for something in the user's niche.
Example translation to Fitness:
- "I love my amazing GAINS ♥" — same handwritten format, same declaration structure
- "I love my amazing 5AM ♥" — same raw love note, different subject
- "I love my amazing REST DAY ♥" — contrarian twist on same concept

STEP 3 — For each angle, explain the direct connection to the source post.
The user should be able to see EXACTLY how angle 1 came from the source post.

Generate exactly 5 angles. Each must:
1. Be a DIRECT translation of the source post's specific concept to the user's niche
2. Have an immediately obvious connection to the source post
3. Preserve the source post's FORMAT and EMOTIONAL MECHANIC
4. Include a ready-to-use hook/caption line that mirrors the source post's structure
5. Explain the direct connection in one sentence

Return ONLY this JSON object (no prose, no fences):
{
  "angles": [
    {
      "angleNumber": 1,
      "angleName": "2-4 words describing the angle",
      "angleType": "direct|contrarian|story|authority|curiosity",
      "hookLine": "The exact opening line or caption — directly mirrors source post structure adapted to user niche",
      "sourceConnection": "One sentence: 'This takes the [specific element] from the source post and applies it to [niche element]'",
      "concept": "One sentence describing what this content piece is",
      "whyItWillPerform": "One sentence: why this works based on the source post's proven emotional mechanic",
      "recommendedFormat": "reel|carousel|image",
      "viralPotential": 85,
      "hookType": "Bold Claim|Curiosity Gap|Question|Story|Contrarian|FOMO|Authority|Personal Declaration|Pattern Interrupt"
    }
  ]
}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
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
      const parsed = AnglesSchema.parse(parseJsonish(text));
      return { angles: parsed.angles, niche };
    } finally {
      clearTimeout(timer);
    }
  });

const SetNicheInput = z.object({ niche: z.string().min(1).max(120) });

export const setDefaultNiche = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SetNicheInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ default_niche: data.niche } as any)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });