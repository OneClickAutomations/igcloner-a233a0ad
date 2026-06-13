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
    const model = gateway("google/gemini-3-flash-preview");

    const system = `You are IGCloner's viral content strategist. Analyze a high-performing Instagram post and generate 5 viral content angles tailored to the user's niche. Return ONLY a JSON object — no prose, no fences.`;

    const topEmotion = Object.entries((dna.emotionalArchitecture ?? {}) as Record<string, number>)
      .sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0] ?? "curiosity";

    const prompt = `Generate 5 viral angles for new content in the niche: "${niche}", inspired by this source post's DNA.

SOURCE POST:
- Account: @${scraped.ownerUsername ?? "unknown"}
- Category: ${dna.contentCategory ?? "unknown"}
- Performance score: ${dna.performanceScore ?? "?"} / 100
- Hook type: ${dna.hookBreakdown?.type ?? "?"}
- Top emotion: ${topEmotion}
- Why it works: ${(dna.whyItWorks ?? []).slice(0, 4).join(" | ")}
- Target audience: ${dna.targetAudience?.who ?? ""} — wants ${dna.targetAudience?.desire ?? ""}

USER NICHE: ${niche}

Generate exactly 5 angles. Each angle MUST:
1. Use a different psychological mechanism (direct, contrarian, story, authority/data, curiosity gap)
2. Be immediately usable — provide a ready-to-post hook line
3. Be adapted to ${niche} (NOT the source niche)
4. Explain (2 sentences) why it will perform, citing the source's mechanics
5. Recommend best format: reel | carousel | image

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
      const { text } = await generateText({ model, system, prompt, abortSignal: controller.signal });
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