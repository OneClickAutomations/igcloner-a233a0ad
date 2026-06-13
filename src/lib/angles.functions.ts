import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, type ModelMessage } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { fetchVisionImage } from "@/lib/source-context";

const AngleSchema = z.object({
  angleNumber: z.number(),
  angleName: z.string(),
  angleType: z.string(),
  hookLine: z.string(),
  sourceConnection: z.string(),
  specificSourceElement: z.string().optional().default(""),
  contentDirection: z.string().optional().default(""),
  keywordUsed: z.string().optional().default("none"),
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

const PrefsSchema = z
  .object({
    contentGoal: z.string().max(200).optional(),
    toneOfVoice: z.string().max(200).optional(),
    keywords: z.array(z.string().max(80)).max(20).optional(),
    targetAudience: z.string().max(1000).optional(),
    userDescription: z.string().max(3000).optional(),
    intentSpecificOption: z.string().max(200).optional(),
    uploadedImageUrls: z.array(z.string().url()).max(4).optional(),
    uploadedDocumentText: z.string().max(8000).optional(),
  })
  .optional();

const Input = z.object({
  analysisId: z.string().uuid(),
  niche: z.string().min(1).max(120).optional(),
  intent: z.enum(["A1", "A2", "A3", "B1", "B2", "B3"]).optional(),
  preferences: PrefsSchema,
});

const INTENT_DESCRIPTIONS: Record<string, string> = {
  A1: "Clone the image EXACTLY with different words. Visual style, composition, colors and aesthetic must be reproduced. Only text/message/caption changes.",
  A2: "Clone the TEXT and caption structure, but use a completely different image. Hook, caption format and message structure stay identical; visual concept is new.",
  A3: "Use the THEME, concept and emotional genre of the source post to generate fully original content in the user's niche. Execution is original; emotional mechanic is preserved.",
  B1: "Use this post as INSPIRATION to generate an original IMAGE post. Not a clone — something new sparked by it.",
  B2: "Use this post as INSPIRATION to generate an original REEL. Not a clone — something new sparked by it.",
  B3: "Use this post as INSPIRATION to generate an original CAROUSEL. Not a clone — something new sparked by it.",
};
const INTENT_LOCKED_FORMAT: Record<string, "image" | "reel" | "carousel" | null> = {
  A1: null, A2: null, A3: null, B1: "image", B2: "reel", B3: "carousel",
};

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

    let niche = data.niche;
    if (!niche) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      niche = (prof as any)?.default_niche ?? "general";
    }

    const prefs = data.preferences ?? {};
    const intent = data.intent ?? "A3";
    const lockedFormat = INTENT_LOCKED_FORMAT[intent];

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-2.5-flash");

    const system = `You are IGCloner's senior viral content strategist.
Reverse-engineer the SPECIFIC content of a proven Instagram post and generate
5 viral angles tailored to the user's intent, niche, and preferences.

GOLDEN RULE — SOURCE CONNECTION:
Every angle must have a clear, direct, traceable connection to the SPECIFIC
content of the source post — not the general topic, the specific concept.

WRONG: source = handwritten "I love my amazing WIFE ♥"; niche = Fitness
  -> "Research shows self-appreciation boosts gym performance" (generic).
RIGHT: same source + niche -> "I love my amazing GAINS ♥" (same handwritten
  declaration format, translated to the niche's subject matter).

The TOPIC changes. The SPECIFIC CONCEPT, FORMAT and EMOTIONAL MECHANIC stay.

USER INTENT (${intent}): ${INTENT_DESCRIPTIONS[intent]}

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

    const ownerHandle = scraped.ownerUsername ?? "the source";
    const kw = prefs.keywords ?? [];

    const prompt = `Analyze this Instagram post and generate 5 viral angles.

SOURCE POST:
Account: @${ownerHandle}
Caption: "${scraped.caption ?? "not available"}"
Post type: ${scraped.type ?? scraped.__typename ?? "post"}
Likes: ${scraped.likesCount ?? scraped.likes ?? "?"} · Comments: ${scraped.commentsCount ?? scraped.comments ?? "?"}
Visible image text / OCR: ${sourceText || "none extracted"}
Attached image: ${visionImage ? "YES — inspect it directly" : "NO"}

CONTENT DNA:
What it is: ${dna.contentSummary ?? "unknown"}
Why it performed: ${(dna.whyItWorks ?? []).join(" | ")}
Hook type: ${dna.hookBreakdown?.type ?? "?"}
Core mechanic: ${dna.hookBreakdown?.whatWorks ?? ""}
Visual style: ${dna.visualStyle?.colorMood ?? "?"}, ${dna.visualStyle?.composition ?? "?"}
Caption structure: ${dna.captionDNA?.structure ?? "?"}
Top emotion: ${topEmotion}

USER PREFERENCES:
- Intent: ${intent} — ${INTENT_DESCRIPTIONS[intent]}
- Niche: ${niche}
- Goal: ${prefs.contentGoal ?? "not specified"}
- Tone: ${prefs.toneOfVoice ?? "not specified"}
- Target audience: ${prefs.targetAudience ?? "not specified"}
- Keywords to weave in where natural: ${kw.join(", ") || "none"}
- Intent-specific preference: ${prefs.intentSpecificOption ?? "not specified"}
${lockedFormat ? `- LOCKED FORMAT for every angle: "${lockedFormat}"` : ""}

USER'S FREE-FORM INSTRUCTIONS:
${prefs.userDescription || "(none provided)"}
${prefs.uploadedDocumentText ? `\nUPLOADED DOCUMENT CONTEXT:\n${prefs.uploadedDocumentText}` : ""}
${(prefs.uploadedImageUrls ?? []).length > 0 ? `\nUSER REFERENCE IMAGES are attached — use them as visual brand/style references.` : ""}

RULES:
1. Identify a SPECIFIC element from the source post (not vague — e.g. "the handwritten note format", "the over-the-shoulder phone shot").
2. Show exactly HOW that element translates under the user's intent (${intent}).
3. Stay on-niche (${niche}), on-tone (${prefs.toneOfVoice ?? "—"}), aimed at goal (${prefs.contentGoal ?? "—"}).
4. Hook line must be specific and ready-to-post — never a template.
5. Where natural, weave in a user keyword${kw.length ? ` (${kw.join(", ")})` : ""}.

Return ONLY this JSON object:
{
  "angles": [
    {
      "angleNumber": 1,
      "angleName": "2-4 word label",
      "angleType": "direct|contrarian|story|authority|curiosity",
      "hookLine": "Exact ready-to-post hook line — specific, not a template",
      "specificSourceElement": "The precise element of the source post being reused",
      "sourceConnection": "One sentence starting with 'Takes the [specific thing] from @${ownerHandle}'s post and …'",
      "concept": "One sentence describing what this content piece is",
      "contentDirection": "2-3 sentences on what to create — visual details, message, format specifics",
      "whyItWillPerform": "One sentence: why this works based on the source post's specific emotional mechanic",
      "recommendedFormat": "${lockedFormat ?? "reel|carousel|image"}",
      "hookType": "Personal Declaration|Curiosity Gap|Bold Claim|Contrarian|Question|Story Open|FOMO|Authority|Pattern Interrupt",
      "viralPotential": 0-100,
      "keywordUsed": "Which user keyword is incorporated, or 'none'"
    }
  ]
}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const userImageUrls = (prefs.uploadedImageUrls ?? []).slice(0, 3);
      const hasAnyImage = !!visionImage || userImageUrls.length > 0;
      const messages: ModelMessage[] | undefined = hasAnyImage
        ? [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                ...(visionImage
                  ? [
                      {
                        type: "image" as const,
                        image: visionImage.image,
                        mediaType: visionImage.mediaType,
                      },
                    ]
                  : []),
                ...userImageUrls.map((u) => ({
                  type: "image" as const,
                  image: new URL(u),
                })),
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
      return { angles: parsed.angles, niche, intent };
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