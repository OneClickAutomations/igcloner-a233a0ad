import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const StyleEnum = z.enum([
  "photorealistic",
  "minimalist",
  "bold-vibrant",
  "cinematic",
  "editorial",
  "3d-render",
  "illustration",
]);

const AspectEnum = z.enum(["1:1", "4:5", "9:16", "16:9"]);

const GenInput = z.object({
  projectId: z.string().uuid(),
  concept: z.string().min(3).max(2000),
  style: StyleEnum.default("photorealistic"),
  aspect: AspectEnum.default("4:5"),
  textOverlay: z.string().max(120).optional(),
  brandColor: z.string().max(20).optional(),
  extra: z.string().max(500).optional(),
});

const STYLE_DESCRIPTIONS: Record<string, string> = {
  photorealistic:
    "Hyper-photorealistic, natural lighting, shallow depth of field, professional camera capture, sharp focus, true-to-life colors.",
  minimalist:
    "Minimalist composition, lots of negative space, single subject, muted palette, clean lines, editorial whitespace.",
  "bold-vibrant":
    "Bold high-contrast colors, saturated palette, attention-grabbing energy, magazine-cover composition.",
  cinematic:
    "Cinematic film still, dramatic lighting, anamorphic widescreen feel, moody color grade, depth and atmosphere.",
  editorial:
    "Editorial fashion photography, magazine layout, refined lighting, considered composition, premium feel.",
  "3d-render": "Modern 3D render, soft global illumination, glossy and matte materials, polished studio look.",
  illustration:
    "Flat vector illustration, geometric shapes, harmonious palette, friendly modern feel suitable for Instagram.",
};

const ASPECT_DIMS: Record<string, string> = {
  "1:1": "square 1080x1080",
  "4:5": "portrait 1080x1350",
  "9:16": "vertical 1080x1920",
  "16:9": "landscape 1920x1080",
};

function buildPrompt(input: z.infer<typeof GenInput>, project: any): string {
  const prefs = (project?.user_preferences as any) ?? {};
  const dna = (project?.dna_analysis as any) ?? {};
  const visual = dna.visualStyle ?? {};
  const lines: string[] = [];
  lines.push(`Generate a single Instagram post image (${ASPECT_DIMS[input.aspect]}).`);
  lines.push(`Concept: ${input.concept}`);
  if (prefs.angle) lines.push(`Headline angle: "${prefs.angle}"`);
  lines.push(`Style: ${STYLE_DESCRIPTIONS[input.style] ?? input.style}`);
  if (visual.colorMood) lines.push(`Color mood inspiration: ${visual.colorMood}`);
  if (visual.composition) lines.push(`Composition cue: ${visual.composition}`);
  if (input.brandColor) lines.push(`Use ${input.brandColor} as a brand accent color.`);
  if (input.textOverlay) {
    lines.push(
      `IMPORTANT — Render the following text directly on the image as a bold legible overlay (typography matters, no spelling errors): "${input.textOverlay}"`,
    );
  } else {
    lines.push("Do NOT add any text or watermark to the image.");
  }
  if (input.extra) lines.push(`Extra direction: ${input.extra}`);
  lines.push(
    "Output a finished, post-ready image. No borders, no UI chrome, no Instagram frame. Subject centered, scroll-stopping.",
  );
  return lines.join("\n");
}

function extractImageDataUrl(payload: any): string | null {
  // Lovable AI gateway routes Gemini image models via OpenRouter chat completions.
  // Response can include images in a few shapes; try them all.
  const msg = payload?.choices?.[0]?.message;
  if (!msg) return null;
  if (Array.isArray(msg.images) && msg.images[0]?.image_url?.url) {
    return msg.images[0].image_url.url as string;
  }
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
  const mime = m[1];
  const b64 = m[2];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, mime };
}

export const generateProjectImage = createServerFn({ method: "POST" })
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

    const prompt = buildPrompt(data, project);

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
        messages: [{ role: "user", content: prompt }],
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
    if (!dataUrl) throw new Error("Model did not return an image. Try a more specific concept.");

    const { bytes, mime } = dataUrlToBytes(dataUrl);
    const ext = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
    const filename = `${userId}/${data.projectId}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("project-assets")
      .upload(filename, bytes, { contentType: mime, upsert: false });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    const { data: signed, error: sErr } = await supabase.storage
      .from("project-assets")
      .createSignedUrl(filename, 60 * 60 * 24 * 7);
    if (sErr) throw new Error(sErr.message);

    const { data: asset, error: aErr } = await supabase
      .from("project_assets")
      .insert({
        project_id: data.projectId,
        user_id: userId,
        asset_type: "image",
        source: "generated",
        url: signed.signedUrl,
        filename,
        metadata: {
          mime,
          style: data.style,
          aspect: data.aspect,
          textOverlay: data.textOverlay ?? null,
          brandColor: data.brandColor ?? null,
          prompt,
        } as any,
      })
      .select("*")
      .single();
    if (aErr) throw new Error(aErr.message);

    return { asset, signedUrl: signed.signedUrl, filename };
  });

const CaptionInput = z.object({
  projectId: z.string().uuid(),
  concept: z.string().min(3).max(2000),
});

export const generateImageCaption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CaptionInput.parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const { data: project } = await context.supabase
      .from("projects")
      .select("*")
      .eq("id", data.projectId)
      .eq("user_id", context.userId)
      .maybeSingle();
    const prefs = (project?.user_preferences as any) ?? {};
    const dna = (project?.dna_analysis as any) ?? {};

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    const prompt = `Write an Instagram image post caption + hashtags.
Niche: ${prefs.niche ?? "general"}
Angle/hook: ${prefs.angle ?? "(none)"}
Concept of the image: ${data.concept}
Tone reference: ${dna.captionDNA?.tone ?? "conversational, confident"}

Return ONLY a JSON object:
{ "caption": string (3-6 short lines, line breaks + tasteful emojis, opens with hook, ends with one CTA), "hashtags": string[] (12 lowercase tags, no #, mix broad + niche) }`;

    const { text } = await generateText({ model, prompt });
    const cleaned = text.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("{");
    const parsed = JSON.parse(start >= 0 ? cleaned.slice(start) : cleaned);
    return {
      caption: String(parsed.caption ?? ""),
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.map((h: string) => String(h).replace(/^#/, "")) : [],
    };
  });

const ListInput = z.object({ projectId: z.string().uuid() });

export const listProjectImages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("project_assets")
      .select("*")
      .eq("project_id", data.projectId)
      .eq("user_id", context.userId)
      .eq("asset_type", "image")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Refresh signed URLs (the stored one may have expired).
    const refreshed = await Promise.all(
      (rows ?? []).map(async (r) => {
        if (!r.filename) return r;
        const { data: signed } = await context.supabase.storage
          .from("project-assets")
          .createSignedUrl(r.filename, 60 * 60 * 24 * 7);
        return { ...r, url: signed?.signedUrl ?? r.url };
      }),
    );
    return { images: refreshed };
  });