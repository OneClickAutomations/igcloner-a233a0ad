import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { copyText } from "./copy-engine.server";
import { compareText, pickBestAttempt, type GateResult } from "./clone-rules";
import { ACTION_COSTS } from "./credits";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchVisionImage } from "@/lib/source-context";
import { CLONE_LABEL } from "@/lib/clone-modes";
import {
  buildImageMediumOpening,
  mediumLabel,
  type ContentMedium,
} from "@/lib/medium";

const Input = z.object({
  projectId: z.string().uuid(),
  slideIndex: z.number().int().min(1),
  extraDirection: z.string().max(800).optional(),
});

function extractImageDataUrl(payload: any): string | null {
  const msg = payload?.choices?.[0]?.message;
  if (!msg) return null;
  if (Array.isArray(msg.images) && msg.images[0]?.image_url?.url) return msg.images[0].image_url.url as string;
  if (Array.isArray(msg.content)) {
    for (const part of msg.content) {
      if (part?.type === "image_url" && part.image_url?.url) return part.image_url.url as string;
      if (part?.type === "output_image" && part.image_url?.url) return part.image_url.url as string;
    }
  }
  return null;
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error("Invalid image data URL from model");
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, mime: m[1] };
}

export const generateCarouselSlideImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
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
    if (!project?.project_data) throw new Error("Generate the carousel first");

    const doc: any = project.project_data;
    const slide = (doc.slides as any[]).find((s) => s.index === data.slideIndex);
    if (!slide) throw new Error("Slide not found");
    const brief = doc.designBrief ?? {};
    const prefs: any = (project as any).user_preferences ?? {};
    const cloneMethod: string | undefined = prefs.cloneMethod ?? prefs.intent;
    const dna: any = (project as any).dna_analysis ?? {};
    const sourceMedium: ContentMedium | null =
      (dna.contentMedium as ContentMedium) ??
      (brief.medium ? { primary: brief.medium, description: "" } : null);
    const mediumCtx = buildImageMediumOpening(cloneMethod, sourceMedium);

    // Pull source reference image so the slide echoes the viral post's vibe.
    let scraped: any = null;
    if (project.analysis_id) {
      const { data: a } = await supabase
        .from("analyses")
        .select("scraped_data")
        .eq("id", project.analysis_id)
        .eq("user_id", userId)
        .maybeSingle();
      scraped = (a as any)?.scraped_data ?? null;
    }
    const refImage = scraped ? await fetchVisionImage(scraped) : null;

    // === Step 1: enhance the visual prompt 10x ===

    const legibilityBlock = mediumCtx.allowDesignType
      ? `TEXT LEGIBILITY RULES (NON-NEGOTIABLE — the slide must be readable on a phone):
- Headline type must occupy AT LEAST 8% of the canvas height (≈ 86px+ on 1080). Body type at least 4% (≈ 44px+). NEVER tiny text.
- Use a bold, geometric or modern sans-serif (e.g. Inter, Söhne, GT America, Neue Haas Grotesk) at 700+ weight for the headline.
- Maintain WCAG AA contrast (≥ 4.5:1) between text and the area directly behind it. If the background is busy or low-contrast, place text on a solid panel, semi-transparent overlay (60-90% opacity), gradient scrim, or a dedicated color block — pick whichever fits the design system.
- Keep generous padding: at least 80px safe margin from every edge. Never let text touch the canvas edge or other elements.
- Set short, comfortable line-length (max ~28 characters per line for headlines). Use clear line breaks; do not let words crash into each other.
- The text rendered on the slide MUST be EXACTLY the headline and body provided — never paraphrase, abbreviate, or translate them.`
      : `MEDIUM-NATIVE LEGIBILITY RULES (this slide is in the source medium — DO NOT impose digital design typography):
- Render the text the way the medium would naturally render it (real handwriting strokes, native screenshot system text, meme caption font, etc.).
- Keep the writing large enough to read on a phone; the hand-lettered / native text should occupy a generous portion of the canvas with comfortable margins.
- Maintain natural contrast through the medium itself (ink on paper, screenshot UI, etc.) — do NOT add design overlays, gradient scrims, or solid color panels.
- The text rendered on the slide MUST be EXACTLY the headline and body provided — never paraphrase, abbreviate, or translate them.`;

    const mediumSystemHeader = mediumCtx.opening
      ? `MEDIUM (NON-NEGOTIABLE — this slide MUST be in this medium): ${mediumCtx.opening}

NEGATIVE — do NOT produce: ${mediumCtx.negatives || "any other medium"}.

`
      : "";

    const enhanceSystem = `You are a world-class Instagram carousel art director and prompt engineer. You translate rough slide notes into a single, dense, image-generation prompt that an expert designer would brief out. The output is one paragraph (max 180 words), no preamble, no bullet points, no markdown. It must specify: exact composition and layout, where the on-image text sits and how it's typeset, color palette with hex usage, lighting/material/texture, mood, and any iconography or shapes.

${mediumSystemHeader}${legibilityBlock}

Always end with: "1:1 square, 1080x1080, Instagram-ready, no borders, no Instagram UI, no watermark, perfect spelling${
      mediumCtx.allowDesignType ? ", large legible typography, high contrast text against background" : ""
    }."`;

    const enhanceUser = `Carousel: "${doc.title}"
Slide ${slide.index} of ${doc.slides.length} — role: ${slide.role}.

${
      mediumCtx.primary
        ? `MEDIUM FOR THIS SLIDE (${CLONE_LABEL.A1} — must match the source post's format):
→ ${mediumLabel(mediumCtx.primary)} (${mediumCtx.primary})
${sourceMedium?.description ? `Source-format notes: ${sourceMedium.description}` : ""}
${sourceMedium?.replicationInstructions ? `How to recreate: ${sourceMedium.replicationInstructions}` : ""}
The first sentence of the prompt you write MUST establish this medium concretely.

`
        : ""
    }TEXT TO RENDER ON THE SLIDE (verbatim, perfect spelling):
- Headline: """${slide.headline}"""
- Body: """${slide.body}"""

Rough visual direction from the writer: ${slide.visualNote || "(none — invent something on-brand)"}

Design system for the whole carousel (apply consistently across every slide):
- Palette: ${brief.palette || "(unspecified — pick something cohesive)"}
- Typography: ${brief.typography || "(unspecified)"}
- Layout system: ${brief.layout || "(unspecified)"}
- Mood: ${brief.mood || "(unspecified)"}
- Overlays / motifs: ${brief.overlays || "(unspecified)"}

${data.extraDirection ? `User override / extra direction: ${data.extraDirection}` : ""}

Rewrite this into ONE expert image-generation prompt for slide ${slide.index}.`;

    const { text: enhanced } = await copyText({
      system: enhanceSystem,
      prompt: enhanceUser,
    });
    const finalPrompt = enhanced.replace(/^["'`\s]+|["'`\s]+$/g, "").trim();

    if(cloneMethod==="A0" || cloneMethod==="A1") throw new Error("Use the rights-checked copy studio for source-media modes.");
    const {debitCredits,refundCredits}=await import("./credits.server");
    const {editImageGemini}=await import("./image-edit.server");
    const {verifyEditedSlide}=await import("./clone-ai.server");
    const refs:{bytes:Uint8Array;mime:string}[]=[];
    // Fresh storage URLs, never the expired URL embedded in the document.
    for(const index of [...new Set([1,slide.index-1])].filter(i=>i>0&&i<slide.index)) {
      const {data:assets}=await supabase.from("project_assets").select("filename,metadata").eq("project_id",project.id).eq("user_id",userId).eq("asset_type","image").order("created_at",{ascending:false});
      const asset=assets?.find(a=>(a.metadata as any)?.slideIndex===index);
      if(asset?.filename){const r=await supabase.storage.from("project-assets").download(asset.filename);if(r.data)refs.push({bytes:new Uint8Array(await r.data.arrayBuffer()),mime:r.data.type||"image/png"});}
    }
    if(slide.index>1&&!refs.length)throw new Error("Generate slide 1 first to establish the carousel style.");
    const intended=[slide.headline,slide.body].filter(Boolean).join("\n");
    const attemptId=crypto.randomUUID();const cost=ACTION_COSTS.imageGeneration;
    await debitCredits(userId,cost,"debit_image","carousel_slide",attemptId,attemptId);
    try {
      const attempts:{bytes:Uint8Array;mime:string;gate:GateResult;observedText:string}[]=[];
      let retry="";
      for(let i=0;i<3;i++) {
        const out=await editImageGemini(`${finalPrompt}\nRender EXACTLY this text and NO text from reference slides: ${JSON.stringify(intended)}. References are slide 1 and previous slide: match their design system but use THIS slide's new content. ${retry}`,refs,"google/gemini-2.5-flash-image","1:1");
        // A2/A3 change subject/scene; gate text strictly, use composition only as an advisory continuity note.
        const v=await verifyEditedSlide({original:refs[0]??out,output:out,originalText:"",intendedText:intended});
        const check=compareText(intended,v.result.observedText);
        const gate:GateResult={pass:check.verdict==="exact",textVerdict:check.verdict,similarity:check.similarity,problems:check.verdict==="exact"?[]:[`Expected ${intended}; read ${v.result.observedText}`]};
        attempts.push({...out,gate,observedText:v.result.observedText});
        if(gate.pass)break;retry=`Previous text verification failed: ${gate.problems.join(" ")}. Fix spelling and remove extra reference text.`;
      }
      const best=pickBestAttempt(attempts);const {bytes,mime}=best;
      const ext=mime.includes("jpeg")?"jpg":"png";
    const filename = `${userId}/${data.projectId}/slide-${slide.index}-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("project-assets")
      .upload(filename, bytes, { contentType: mime, upsert: false });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    const { data: signed, error: sErr } = await supabase.storage
      .from("project-assets")
      .createSignedUrl(filename, 60 * 60 * 24 * 7);
    if (sErr) throw new Error(sErr.message);

    const {error:assetErr}=await supabase.from("project_assets").insert({
      project_id: data.projectId,
      user_id: userId,
      asset_type: "image",
      source: "generated",
      url: signed.signedUrl,
      filename,
      metadata: { mime, slideIndex: slide.index, enhancedPrompt: finalPrompt,referenceCount:refs.length,textGate:best.gate,observedText:best.observedText,attempts:attempts.length } as any,
    });

    if(assetErr)throw new Error(assetErr.message);
    // Save the image URL onto the slide in the carousel doc.
    const updatedDoc = {
      ...doc,
      slides: (doc.slides as any[]).map((s) =>
        s.index === slide.index ? { ...s, imageUrl: signed.signedUrl, needsLook:!best.gate.pass, textGate:best.gate } : s,
      ),
    };
    const { data: saved, error: uErr } = await supabase
      .from("projects")
      .update({ project_data: updatedDoc as any })
      .eq("id", data.projectId)
      .select("*")
      .single();
    if (uErr) throw new Error(uErr.message);

    if(!best.gate.pass)await refundCredits(userId,cost,"carousel_slide",attemptId,attemptId);
    return { project: saved, slideIndex: slide.index, imageUrl: signed.signedUrl, enhancedPrompt: finalPrompt,needsLook:!best.gate.pass,attempts:attempts.length,charged:best.gate.pass?cost:0,gate:best.gate };
    }catch(e){await refundCredits(userId,cost,"carousel_slide",attemptId,attemptId);throw e;}
  });