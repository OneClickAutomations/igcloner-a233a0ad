import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, type ModelMessage } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { fetchVisionImage } from "@/lib/source-context";
import { buildAnglesMediumConstraint, mediumLabel, type ContentMedium } from "@/lib/medium";
import { GOAL_COPY_INSTRUCTIONS, GOAL_LABEL, type PostGoal } from "@/lib/post-goals";

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
  medium: z.string().optional().default(""),
  mediumLabel: z.string().optional().default(""),
  mediumIsSameAsSource: z.boolean().optional().default(true),
});
export type Angle = z.infer<typeof AngleSchema>;

const AnglesSchema = z.object({ angles: z.array(AngleSchema).length(5) });

import { extractJson } from "./json-extract";
function parseJsonish(text: string): any {
  return extractJson(text);
}

const PrefsSchema = z
  .object({
    contentGoal: z.string().max(200).optional(),
    goal: z.string().max(60).optional(),
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
  outputFormat: z.enum(["image", "reel", "carousel"]).optional(),
  preferences: PrefsSchema,
});

const INTENT_DESCRIPTIONS: Record<string, string> = {
  A1: "CLONE CONTENT — Clone the image EXACTLY with different words. Visual style, composition, colors and aesthetic must be reproduced. Only text/message/caption changes.",
  A2: "REMIX THE MESSAGE — Clone the TEXT and caption structure, but use a completely different image. Hook, caption format and message structure stay identical; visual concept is new.",
  A3: "REIMAGINE THE SCENE — Use the THEME, concept and emotional genre of the source post to generate fully original content in the user's niche. Execution is original; emotional mechanic is preserved.",
  B1: "Use this post as INSPIRATION to generate an original IMAGE post. Not a clone — something new sparked by it.",
  B2: "Use this post as INSPIRATION to generate an original REEL. Not a clone — something new sparked by it.",
  B3: "Use this post as INSPIRATION to generate an original CAROUSEL. Not a clone — something new sparked by it.",
};
// Per-intent sampling temperature (determinism control). Exact-clone work (A1)
// runs cooler for consistency; theme/inspiration work runs hotter for range.
const INTENT_TEMPERATURE: Record<string, number> = {
  A1: 0.6, A2: 0.85, A3: 0.9, B1: 0.9, B2: 0.9, B3: 0.9,
};
// Isolated per-intent structural rule: must every angle's medium equal the
// source medium? True only for A1 (Clone Content). Centralized here so the
// rule lives in ONE place instead of scattered `intent === "A1"` conditionals.
const INTENT_MEDIUM_LOCK: Record<string, boolean> = {
  A1: true, A2: false, A3: false, B1: false, B2: false, B3: false,
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

    // Niche is OPTIONAL. If the user did not explicitly provide one for this
    // generation, do NOT fall back to a profile default and do NOT pass
    // "general" — instead let the AI infer subject matter directly from the
    // source post (image, OCR text, caption, hashtags). User-provided niche
    // overrides AI inference.
    const niche = data.niche?.trim() || null;
    const nicheLine = niche
      ? `- Niche (USER-SPECIFIED — overrides source inference): ${niche}`
      : `- Niche: NOT SPECIFIED BY USER. Use the SOURCE POST'S OWN niche, as already established by the Content DNA analysis above (account context, image, visible text/OCR, caption, hashtags). Every one of the 5 angles MUST stay inside that single niche — do NOT span multiple industries, do NOT switch themes between angles, do NOT introduce an unrelated vertical.`;
    const ruleNiche = niche
      ? `Stay on-niche (${niche})`
      : `Stay strictly inside the SOURCE POST'S single niche (same industry, same subject domain, same audience) for ALL 5 angles — never mix niches across angles, never invent a different industry`;

    const prefs = data.preferences ?? {};
    const intent = data.intent ?? "A3";
    const lockedFormat = data.outputFormat ?? INTENT_LOCKED_FORMAT[intent];

    const goalKey = (prefs.goal as PostGoal | undefined) ?? null;
    const goalBlock =
      goalKey && GOAL_COPY_INSTRUCTIONS[goalKey]
        ? `\nPOST GOAL (PRIMARY OPTIMIZATION TARGET): ${GOAL_LABEL[goalKey]}\n${GOAL_COPY_INSTRUCTIONS[goalKey]}\nEvery angle MUST be measurably optimized for this goal. Include a "goalAlignment" sentence per angle.`
        : "";

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
    const sourceMedium: ContentMedium | null = (dna as any).contentMedium ?? null;
    const mediumBlock = buildAnglesMediumConstraint(intent, sourceMedium);
    const sourceMediumPrimary = sourceMedium?.primary ?? "unknown";
    const mediumMustMatch = INTENT_MEDIUM_LOCK[intent] ?? false;

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
${nicheLine}
- Goal: ${prefs.contentGoal ?? "not specified"}
- Tone: ${prefs.toneOfVoice ?? "not specified"}
- Target audience: ${prefs.targetAudience ?? "not specified"}
- Keywords to weave in where natural: ${kw.join(", ") || "none"}
- Intent-specific preference: ${prefs.intentSpecificOption ?? "not specified"}
${lockedFormat ? `- LOCKED FORMAT for every angle: "${lockedFormat}"` : ""}
${mediumBlock}
${goalBlock}

USER'S FREE-FORM INSTRUCTIONS:
${prefs.userDescription || "(none provided)"}
${prefs.uploadedDocumentText ? `\nUPLOADED DOCUMENT CONTEXT:\n${prefs.uploadedDocumentText}` : ""}
${(prefs.uploadedImageUrls ?? []).length > 0 ? `\nUSER REFERENCE IMAGES are attached — use them as visual brand/style references.` : ""}

RULES:
1. Identify a SPECIFIC element from the source post (not vague — e.g. "the handwritten note format", "the over-the-shoulder phone shot").
2. Show exactly HOW that element translates under the user's intent (${intent}).
3. ${ruleNiche}, on-tone (${prefs.toneOfVoice ?? "—"}), aimed at goal (${prefs.contentGoal ?? "—"}).
4. Hook line must be specific and ready-to-post — never a template.
5. Where natural, weave in a user keyword${kw.length ? ` (${kw.join(", ")})` : ""}.
6. 10X THE TEXT. Every new hook/caption must be measurably BETTER than the source's text overlay — more profound, deeper, sharper, more clever (if the original was clever), more quote-worthy and share-worthy. Treat the source text as the floor, not the ceiling. If the source is a one-liner, your version is a one-liner that hits harder. No watered-down rewordings, no generic motivational filler, no platitudes. Each hook should feel screenshot-worthy on its own.
7. ALL 5 ANGLES STAY IN ONE NICHE — the source post's niche. Different ANGLE (contrarian, story, authority, etc.), same SUBJECT DOMAIN. Do not produce a fitness angle and a finance angle in the same set.

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
      "keywordUsed": "Which user keyword is incorporated, or 'none'",
      "medium": "${sourceMediumPrimary}" ${mediumMustMatch ? "(MUST equal the source medium for every angle)" : "(may be the source medium or a different one)"},
      "mediumLabel": "Short human label for the medium, e.g. '✍️ Handwriting on paper'",
      "mediumIsSameAsSource": ${mediumMustMatch ? "true" : "true|false"}
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
      const callModel = async (): Promise<string> => {
        const { text } = await generateText({
          model,
          system,
          temperature: INTENT_TEMPERATURE[intent] ?? 0.8,
          ...(messages ? { messages } : { prompt }),
          abortSignal: controller.signal,
        });
        return text;
      };

      // Bounded retry: regenerate on malformed JSON, wrong angle count, or (A1)
      // medium drift, instead of throwing/showing bad output on the first miss.
      // The single 45s AbortController caps total time across all attempts.
      const maxRetries = 2;
      let lastError: unknown = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const text = await callModel();
          const result = AnglesSchema.safeParse(parseJsonish(text));
          if (!result.success) {
            lastError = result.error;
            continue;
          }

          // Backfill medium label client-side so the UI always has a friendly tag.
          let angles = result.data.angles.map((a) => ({
            ...a,
            mediumLabel: a.mediumLabel || mediumLabel(a.medium || sourceMediumPrimary),
            medium: a.medium || String(sourceMediumPrimary),
          }));

          // A1 (Clone Content) structural rule: every angle's medium must equal
          // the source medium. Retry on drift; on the final attempt, coerce to
          // source rather than ship an inconsistent set.
          if (mediumMustMatch && sourceMediumPrimary !== "unknown") {
            const drifted = angles.some(
              (a) => a.mediumIsSameAsSource === false ||
                String(a.medium) !== String(sourceMediumPrimary),
            );
            if (drifted && attempt < maxRetries) {
              lastError = new Error("A1 medium drift — every angle must match source medium");
              continue;
            }
            if (drifted) {
              angles = angles.map((a) => ({
                ...a,
                medium: String(sourceMediumPrimary),
                mediumLabel: mediumLabel(String(sourceMediumPrimary)),
                mediumIsSameAsSource: true,
              }));
            }
          }

          return { angles, niche, intent, sourceMedium };
        } catch (err) {
          lastError = err;
          // Never retry a genuine timeout/abort — surface it immediately.
          if (controller.signal.aborted) throw err;
        }
      }

      throw new Error(
        `Angle generation failed validation after ${maxRetries + 1} attempts: ${String(
          lastError instanceof Error ? lastError.message : lastError,
        )}`,
      );
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