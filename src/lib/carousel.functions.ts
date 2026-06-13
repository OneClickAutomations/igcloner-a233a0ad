import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const SlideSchema = z.object({
  index: z.number(),
  role: z.string(),
  headline: z.string(),
  body: z.string(),
  visualNote: z.string(),
  imageUrl: z.string().url().optional(),
});

const CarouselSchema = z.object({
  title: z.string(),
  hook: z.string(),
  slides: z.array(SlideSchema).min(3).max(12),
  caption: z.string(),
  hashtags: z.array(z.string()),
  designBrief: z.object({
    palette: z.string(),
    typography: z.string(),
    layout: z.string(),
    mood: z.string(),
    overlays: z.string(),
  }),
});

export type CarouselDoc = z.infer<typeof CarouselSchema>;

import { extractJson } from "./json-extract";
function parseJsonish(text: string): any {
  return extractJson(text);
}

const GenInput = z.object({
  projectId: z.string().uuid(),
  slideCount: z.number().int().min(3).max(12).default(7),
  angle: z.string().max(500).optional(),
});

export const generateCarousel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GenInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const { data: project, error: pErr } = await supabase
      .from("projects")
      .select("*")
      .eq("id", data.projectId)
      .eq("user_id", userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!project) throw new Error("Project not found");

    const dna = (project.dna_analysis as any) ?? {};
    const prefs = (project.user_preferences as any) ?? {};
    const cloneMode: "exact" | "inspired" = prefs.cloneMode === "inspired" ? "inspired" : "exact";
    const forensics = (dna.forensics?.carouselForensics ?? dna.forensics ?? null) as any;
    const sourceAccount = project.source_account ?? "unknown";

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    const system = `You are IG-Cloner's elite carousel engine. Operate as a forensic content analyst + creative director + conversion copywriter. Extract the source formula, then rebuild it for a new niche. Return ONLY a single JSON object — no prose, no markdown fences. Every slide must be 100% complete — no placeholders or "add your text here".`;

    const forensicsBlock = forensics
      ? `\nCAROUSEL FORENSICS (source formula extracted):
- Overall: ${JSON.stringify(forensics.overall ?? {})}
- Slide 1 hook: ${JSON.stringify(forensics.slide1 ?? {})}
- Middle slide pattern: ${JSON.stringify((forensics.middleSlides ?? [])[0] ?? {})}
- Final/CTA slide: ${JSON.stringify(forensics.finalSlide ?? {})}
- Design system: ${JSON.stringify(forensics.designSystem ?? {})}
- Content strategy: ${JSON.stringify(forensics.contentStrategy ?? {})}\n`
      : "";

    const modeBlock =
      cloneMode === "exact"
        ? `\nMODE: EXACT DUPLICATE.
Apply the EXACT formula above to a new carousel in the user's niche. Keep identical: layout system, hook mechanism, slide-by-slide structure, design system, CTA type. Change topic, subject matter, all text content — adapted to the new niche. "Exact duplicate" = identical formula, different subject. Never identical words.`
        : `\nMODE: INSPIRED VERSION.
Preserve the source's psychological mechanics (hook power, save-worthiness driver, narrative arc, value-delivery timing). Take a completely different creative direction visually and topically. The result should NOT look like the source.`;

    const prompt = `Generate a ${data.slideCount}-slide Instagram carousel.
${modeBlock}
${forensicsBlock}

Return JSON of exact shape:
{
  "title": string,
  "hook": string (the slide 1 hook — must be punchy, stop-the-scroll),
  "slides": [
    { "index": 1, "role": "Hook"|"Promise"|"Context"|"Point"|"Story"|"Proof"|"Tip"|"Recap"|"CTA", "headline": string (max ~9 words), "body": string (1-3 short lines, can use line breaks), "visualNote": string (concrete visual direction for this slide) }
  ],
  "caption": string (ready-to-post, line breaks + emojis, includes soft CTA),
  "hashtags": string[] (10-15, no #, lowercase, mix broad+niche),
  "designBrief": {
    "palette": string (3-5 hex colors w/ usage),
    "typography": string (headline + body font suggestions, weights),
    "layout": string (grid, alignment, padding rules),
    "mood": string (emotional register),
    "overlays": string (icons, shapes, photo treatments)
  }
}

Slide count: exactly ${data.slideCount}.
Slide 1 = Hook. Final slide = CTA. Vary roles in between.

Source DNA snapshot (use as inspiration; never copy):
- Account: @${sourceAccount}
- Category: ${dna.contentCategory ?? "unknown"}
- Why it works: ${(dna.whyItWorks ?? []).slice(0, 4).join(" | ")}
- Target: ${dna.targetAudience?.who ?? ""} — wants ${dna.targetAudience?.desire ?? ""}
- Hook type: ${dna.hookBreakdown?.type ?? ""}
- Caption tone: ${dna.captionDNA?.tone ?? ""}
- Visual style: color=${dna.visualStyle?.colorMood ?? ""}; composition=${dna.visualStyle?.composition ?? ""}; text=${dna.visualStyle?.textOverlay ?? ""}
- User niche: ${prefs.niche ?? "general"}
- User tone: ${prefs.toneOfVoice ?? ""}
- User audience: ${prefs.targetAudience ?? ""}
- Keywords: ${(prefs.keywords ?? []).join(", ")}
${data.angle ? `\nUser angle / topic to emphasize: ${data.angle}` : ""}

Output the full JSON object only.`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 40000);
    let parsed: CarouselDoc;
    try {
      const { text } = await generateText({ model, system, prompt, abortSignal: controller.signal });
      parsed = CarouselSchema.parse(parseJsonish(text));
    } finally {
      clearTimeout(timer);
    }

    const { data: updated, error: uErr } = await supabase
      .from("projects")
      .update({
        project_data: parsed as any,
        title: parsed.title.slice(0, 200),
        status: "in_progress",
      })
      .eq("id", data.projectId)
      .select("*")
      .single();
    if (uErr) throw new Error(uErr.message);

    return { project: updated, carousel: parsed };
  });

const RegenInput = z.object({
  projectId: z.string().uuid(),
  slideIndex: z.number().int().min(1),
  instruction: z.string().max(500).optional(),
});

export const regenerateSlide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RegenInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const { data: project, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", data.projectId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!project?.project_data) throw new Error("No carousel yet — generate first");

    const doc = project.project_data as CarouselDoc;
    const slide = doc.slides.find((s) => s.index === data.slideIndex);
    if (!slide) throw new Error("Slide not found");

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    const prompt = `Rewrite this single Instagram carousel slide. Keep its role and index, but improve copy & visual note.
Slide role: ${slide.role}. Index: ${slide.index} of ${doc.slides.length}.
Carousel title: ${doc.title}
Hook (slide 1): ${doc.hook}
Current slide:
  headline: ${slide.headline}
  body: ${slide.body}
  visualNote: ${slide.visualNote}
${data.instruction ? `User instruction: ${data.instruction}` : ""}

Return JSON ONLY: { "index": ${slide.index}, "role": string, "headline": string, "body": string, "visualNote": string }`;

    const { text } = await generateText({ model, prompt });
    const next = SlideSchema.parse(parseJsonish(text));

    const updatedDoc: CarouselDoc = {
      ...doc,
      slides: doc.slides.map((s) => (s.index === next.index ? next : s)),
    };

    const { data: saved, error: uErr } = await supabase
      .from("projects")
      .update({ project_data: updatedDoc as any })
      .eq("id", data.projectId)
      .select("*")
      .single();
    if (uErr) throw new Error(uErr.message);

    return { project: saved, slide: next };
  });

const SaveInput = z.object({
  projectId: z.string().uuid(),
  carousel: CarouselSchema,
});

export const saveCarousel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: saved, error } = await context.supabase
      .from("projects")
      .update({ project_data: data.carousel as any, title: data.carousel.title.slice(0, 200) })
      .eq("id", data.projectId)
      .eq("user_id", context.userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { project: saved };
  });