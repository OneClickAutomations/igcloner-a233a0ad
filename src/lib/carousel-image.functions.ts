import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { fetchVisionImage } from "@/lib/source-context";

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
    const gateway = createLovableAiGatewayProvider(apiKey);
    const promptModel = gateway("google/gemini-3-flash-preview");

    const enhanceSystem = `You are a world-class Instagram carousel art director and prompt engineer. You translate rough slide notes into a single, dense, image-generation prompt that an expert designer would brief out. The output is one paragraph (max 180 words), no preamble, no bullet points, no markdown. It must specify: exact composition and layout, where the on-image text sits and how it's typeset, color palette with hex usage, lighting/material/texture, mood, and any iconography or shapes.

TEXT LEGIBILITY RULES (NON-NEGOTIABLE — the slide must be readable on a phone):
- Headline type must occupy AT LEAST 8% of the canvas height (≈ 86px+ on 1080). Body type at least 4% (≈ 44px+). NEVER tiny text.
- Use a bold, geometric or modern sans-serif (e.g. Inter, Söhne, GT America, Neue Haas Grotesk) at 700+ weight for the headline.
- Maintain WCAG AA contrast (≥ 4.5:1) between text and the area directly behind it. If the background is busy or low-contrast, place text on a solid panel, semi-transparent overlay (60-90% opacity), gradient scrim, or a dedicated color block — pick whichever fits the design system.
- Keep generous padding: at least 80px safe margin from every edge. Never let text touch the canvas edge or other elements.
- Set short, comfortable line-length (max ~28 characters per line for headlines). Use clear line breaks; do not let words crash into each other.
- The text rendered on the slide MUST be EXACTLY the headline and body provided — never paraphrase, abbreviate, or translate them.

Always end with: "1:1 square, 1080x1080, Instagram-ready, no borders, no Instagram UI, no watermark, perfect spelling, large legible typography, high contrast text against background."`;

    const enhanceUser = `Carousel: "${doc.title}"
Slide ${slide.index} of ${doc.slides.length} — role: ${slide.role}.

TEXT TO RENDER ON THE SLIDE (verbatim, perfect spelling):
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

    const { text: enhanced } = await generateText({
      model: promptModel,
      system: enhanceSystem,
      prompt: enhanceUser,
    });
    const finalPrompt = enhanced.replace(/^["'`\s]+|["'`\s]+$/g, "").trim();

    // === Step 2: render the slide image ===
    const userContent: any[] = [{ type: "text", text: finalPrompt }];
    if (refImage) {
      let bin = "";
      const chunk = 0x8000;
      for (let i = 0; i < refImage.image.length; i += chunk) {
        bin += String.fromCharCode(...refImage.image.subarray(i, i + chunk));
      }
      const b64 = btoa(bin);
      userContent.push({
        type: "text",
        text: "Reference image attached — match its visual energy, but the slide content/topic is defined above.",
      });
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${refImage.mediaType};base64,${b64}` },
      });
    }

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "raw-fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        modalities: ["image", "text"],
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      if (upstream.status === 429) throw new Error("Image generation is rate limited — please retry in a moment.");
      if (upstream.status === 402) throw new Error("Lovable AI credits exhausted. Add credits in workspace settings.");
      throw new Error(`Image model error [${upstream.status}]: ${text.slice(0, 200)}`);
    }

    const payload = await upstream.json();
    const dataUrl = extractImageDataUrl(payload);
    if (!dataUrl) throw new Error("Model did not return an image. Try regenerating the slide first.");

    const { bytes, mime } = dataUrlToBytes(dataUrl);
    const ext = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
    const filename = `${userId}/${data.projectId}/slide-${slide.index}-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("project-assets")
      .upload(filename, bytes, { contentType: mime, upsert: false });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    const { data: signed, error: sErr } = await supabase.storage
      .from("project-assets")
      .createSignedUrl(filename, 60 * 60 * 24 * 7);
    if (sErr) throw new Error(sErr.message);

    await supabase.from("project_assets").insert({
      project_id: data.projectId,
      user_id: userId,
      asset_type: "image",
      source: "generated",
      url: signed.signedUrl,
      filename,
      metadata: { mime, slideIndex: slide.index, enhancedPrompt: finalPrompt } as any,
    });

    // Save the image URL onto the slide in the carousel doc.
    const updatedDoc = {
      ...doc,
      slides: (doc.slides as any[]).map((s) =>
        s.index === slide.index ? { ...s, imageUrl: signed.signedUrl } : s,
      ),
    };
    const { data: saved, error: uErr } = await supabase
      .from("projects")
      .update({ project_data: updatedDoc as any })
      .eq("id", data.projectId)
      .select("*")
      .single();
    if (uErr) throw new Error(uErr.message);

    return { project: saved, slideIndex: slide.index, imageUrl: signed.signedUrl, enhancedPrompt: finalPrompt };
  });