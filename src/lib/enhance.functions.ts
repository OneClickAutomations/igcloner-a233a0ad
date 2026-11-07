import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { copyText } from "./copy-engine.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  prompt: z.string().max(2000).optional().default(""),
  kind: z.enum(["image", "carousel-slide", "reel", "generic"]).default("generic"),
  context: z.string().max(2000).optional(),
});

export const enhancePrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");


    const kindHint: Record<string, string> = {
      image: "an AI image-generation instruction (visual details, composition, lighting, mood, style, subject specificity)",
      "carousel-slide": "an instruction to rewrite a single Instagram carousel slide (sharper hook, vivid specificity, tighter copy, clearer payoff)",
      reel: "an instruction for a short-form Instagram Reel (hook strength, pacing, visual beats, on-screen text, payoff)",
      generic: "a creative content instruction (sharper, more specific, more vivid, more actionable)",
    };

    const system = `You are a world-class prompt engineer. The user will give you a short, vague, or rough instruction. Rewrite it as ${kindHint[data.kind]}.

Rules:
- 10x the specificity, vividness, and clarity — but stay faithful to the user's intent.
- One paragraph, max 80 words. No bullet points. No preamble. No quotes.
- Do NOT add new subject matter the user didn't imply.
- Output ONLY the enhanced instruction, nothing else.`;

    const userPrompt = `Original instruction:
"""${data.prompt || "(empty — infer a strong improvement from context)"}"""

${data.context ? `Context (use to ground the rewrite, do not repeat verbatim):\n${data.context}\n` : ""}
Rewrite it now.`;

    const { text } = await copyText({ system, prompt: userPrompt });
    const enhanced = text.replace(/^["'`\s]+|["'`\s]+$/g, "").trim();
    return { enhanced };
  });