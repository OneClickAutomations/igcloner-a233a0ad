import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { copyJson, buildCopyContext, contextPrompt } from "./copy-engine.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mediumLabel, MEDIUM_OPENINGS, type ContentMedium } from "@/lib/medium";

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
    medium: z.string().optional().default(""),
    mediumLabel: z.string().optional().default(""),
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
    const cloneMode: "formula" | "inspired" = prefs.cloneMode === "inspired" ? "inspired" : "formula";
    const cloneMethod: string | undefined = prefs.cloneMethod ?? prefs.intent;
    const forensics = (dna.forensics?.carouselForensics ?? dna.forensics ?? null) as any;
    const sourceAccount = project.source_account ?? "unknown";
    const sourceMedium: ContentMedium | null = (dna as any).contentMedium ?? null;
    const enforceMedium = cloneMethod === "A1" || (cloneMode === "formula" && !!sourceMedium);
    const mediumPrimary = String(sourceMedium?.primary ?? "");
    const mediumOpening = mediumPrimary ? MEDIUM_OPENINGS[mediumPrimary] || "" : "";
    const mediumBlock = enforceMedium && sourceMedium
      ? `\nMEDIUM CONSTRAINT — NON-NEGOTIABLE:
The source post's medium is "${mediumPrimary}" (${sourceMedium.description ?? ""}).
EVERY slide of this carousel MUST be produced in this exact medium. ${mediumOpening}
- Do NOT switch to a digital quote card / Canva-style graphic if the source is handwriting, screenshot, UGC, meme, or printed text.
- The "visualNote" on EVERY slide must describe how to create that slide IN THIS MEDIUM (e.g. "Photograph real handwriting on white paper, flat-lay, natural light").
- The designBrief.medium field MUST equal "${mediumPrimary}".
- The designBrief.typography MUST reflect the medium (e.g. for handwriting: "Real human handwriting in dark ink — NOT a digital handwriting font"; for screenshot: "Native iOS/Android system fonts"). Do NOT default to bold sans-serif if the medium is not a digital graphic.\n`
      : sourceMedium
      ? `\nSOURCE MEDIUM (advisory only — user may use a different format): "${mediumPrimary}".\n`
      : "";


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
      cloneMode === "formula"
        ? `\nMODE: SAME FORMULA, NEW SUBJECT (${cloneMethod === "A1" ? "A1 same look, new words" : "A2/A3 new media, new words"}).
Apply the formula above to a new carousel in the user's niche. Keep: layout system, hook mechanism, slide-by-slide structure, design system, CTA type. Change topic, subject matter, and all text — new words written for the new niche.`
        : `\nMODE: INSPIRED VERSION.
Preserve the source's psychological mechanics (hook power, save-worthiness driver, narrative arc, value-delivery timing). Take a completely different creative direction visually and topically. The result should NOT look like the source.`;

    const prompt = `Generate a ${data.slideCount}-slide Instagram carousel.
${modeBlock}
${forensicsBlock}
${mediumBlock}

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
    "overlays": string (icons, shapes, photo treatments),
    "medium": string (one of the medium category slugs — e.g. "handwriting-on-paper"),
    "mediumLabel": string (human label e.g. "✍️ Handwriting on paper")
  }
}

Slide count: exactly ${data.slideCount}.
Slide 1 = Hook. Final slide = CTA. Vary roles in between.

Source DNA snapshot (structure reference; write new words):
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

    const ctx=project.analysis_id ? await buildCopyContext(project.analysis_id,userId,"instagram",prefs) : {source:{captionDNA:{},blueprint:null},voice:prefs,research:null};
    const sourceSlides=ctx.source.blueprint?.slides ?? [];
    const roleBrief=sourceSlides.map((s:any)=>({role:s.role,words:String(s.exactText??"").split(/\s+/).filter(Boolean).length}));
    const {value:parsed}=await copyJson(CarouselSchema,`${prompt}\n${contextPrompt(ctx)}\nSOURCE SLIDE ROLES/TEXT LENGTHS: ${JSON.stringify(roleBrief)}. Map source roles in order; preserve relative text length when source contains text, but write new words. Do not invent on-slide copy when source slides are intentionally text-free unless the user's new brief calls for it.`,system,10000);
    if(sourceMedium && (!parsed.designBrief.medium || enforceMedium)) {
      parsed.designBrief.medium=enforceMedium ? mediumPrimary : parsed.designBrief.medium || mediumPrimary;
      parsed.designBrief.mediumLabel=parsed.designBrief.mediumLabel || mediumLabel(parsed.designBrief.medium);
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

    const ctx=project.analysis_id ? await buildCopyContext(project.analysis_id,userId,"instagram",project.user_preferences) : {};
    const {value:next}=await copyJson(SlideSchema,`${prompt}\n${contextPrompt(ctx)}`,undefined,3000);

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