import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const AngleSchema = z.object({
  angleNumber: z.number(),
  angleName: z.string(),
  angleType: z.string(),
  hookLine: z.string(),
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
    const model = gateway("google/gemini-2.5-pro");

    const system = `You are IGCloner's source-grounded viral strategist. Generate niche-adapted ideas by translating the source post's exact message, visible text, visual metaphor, and emotional mechanism — never by making generic ideas for the user's niche. If the source content and chosen niche are far apart, bridge them explicitly. Return ONLY a JSON object — no prose, no fences.`;

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

    const prompt = `Generate 5 viral angles for new content in the niche: "${niche}", adapted from this source post's actual image/text context.

SOURCE POST:
- Account: @${scraped.ownerUsername ?? "unknown"}
- Caption: ${scraped.caption ?? "none"}
- Category: ${dna.contentCategory ?? "unknown"}
- Source summary: ${dna.contentSummary ?? "unknown"}
- Visible image text / OCR: ${sourceText || "none extracted"}
- Visual forensics: ${JSON.stringify(sourceForensics).slice(0, 2500)}
- Performance score: ${dna.performanceScore ?? "?"} / 100
- Hook type: ${dna.hookBreakdown?.type ?? "?"}
- Hook evidence: ${dna.hookBreakdown?.whatWorks ?? ""}
- Top emotion: ${topEmotion}
- Why it works: ${(dna.whyItWorks ?? []).slice(0, 4).join(" | ")}
- Target audience: ${dna.targetAudience?.who ?? ""} — wants ${dna.targetAudience?.desire ?? ""}

USER NICHE: ${niche}

Generate exactly 5 angles. Each angle MUST:
1. Use a different psychological mechanism (direct, contrarian, story, authority/data, curiosity gap)
2. Be immediately usable — provide a ready-to-post hook line
3. Be adapted to ${niche}, BUT preserve the source post's core message / tension / emotional promise. Do not ignore religious or visual context if present.
4. Explain (2 sentences) why it will perform, citing specific source evidence (visible text, visual subject, caption, layout, emotion)
5. Recommend best format: reel | carousel | image
6. Fail closed: if the source evidence is sparse, say so in the concept and use only the evidence available; never hallucinate unrelated angles.

Example standard: If the source image is about God and the user chooses Finance, generate finance angles that translate the faith/trust/provision message into money behavior — not random investing tips.

Return ONLY this exact JSON shape:
{
  "angles": [
    {
      "angleNumber": 1,
      "angleName": "Direct Improvement",
      "angleType": "direct",
      "hookLine": "ready-to-post opening line",
      "concept": "one sentence describing the content",
      "whyItWillPerform": "two sentences citing source DNA mechanics",
      "recommendedFormat": "reel",
      "viralPotential": 82,
      "hookType": "Bold Claim"
    },
    { "angleNumber": 2, "angleName": "Contrarian Take", "angleType": "contrarian", ... },
    { "angleNumber": 3, "angleName": "Personal Story", "angleType": "story", ... },
    { "angleNumber": 4, "angleName": "Authority / Data-Driven", "angleType": "authority", ... },
    { "angleNumber": 5, "angleName": "Curiosity Gap", "angleType": "curiosity", ... }
  ]
}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const { text } = await generateText({
        model,
        system,
        prompt,
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