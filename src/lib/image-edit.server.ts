// Server-only image edit/generation through the Lovable AI gateway.
// Used by "Same look, new words" (A1) slide text replacement and by
// "Mix images" (A2/A3) multi-reference generation. Credentials stay here.
import { imageSize, openAiSizeFor } from "@/lib/clone-rules";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

/** Chosen after a live probe (see AGENTS.md): best text fidelity + exact aspect via custom size. */
export const TEXT_EDIT_MODEL = "openai/gpt-image-2";
export const MIX_IMAGE_MODEL = "openai/gpt-image-2";

export interface ImageInput { bytes: Uint8Array; mime: string; name?: string }
export interface ImageOutput { bytes: Uint8Array; mime: string; model: string; ms: number }

function apiKey() {
  const k = process.env.LOVABLE_API_KEY;
  if (!k) throw new Error("AI connection is not configured.");
  return k;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function readError(res: Response): Promise<string> {
  const t = await res.text();
  try { const j = JSON.parse(t); return j.message ?? j.error?.message ?? t.slice(0, 300); } catch { return t.slice(0, 300); }
}

/**
 * Edit with one or more reference images (first image = canvas). Output keeps
 * the first image's aspect ratio exactly when the provider accepts the size.
 */
export async function editImageWithRefs(prompt: string, images: ImageInput[], model = TEXT_EDIT_MODEL): Promise<ImageOutput> {
  if (!images.length) throw new Error("No reference image to edit.");
  const t0 = Date.now();
  const dims = imageSize(images[0].bytes);
  const form = new FormData();
  form.set("model", model);
  form.set("prompt", prompt);
  if (dims) form.set("size", openAiSizeFor(dims.width, dims.height));
  images.forEach((im, i) => {
    form.append("image[]", new Blob([im.bytes as BlobPart], { type: im.mime }), im.name ?? `ref-${i + 1}.${im.mime.includes("png") ? "png" : "jpg"}`);
  });
  const res = await fetch(`${GATEWAY}/images/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "X-Lovable-AIG-SDK": "fetch" },
    body: form,
  });
  if (!res.ok) {
    const msg = await readError(res);
    if (res.status === 402) throw new Error("AI credits for image editing are exhausted for this workspace.");
    if (res.status === 429) throw new Error("Image editing is busy right now — please try again in a minute.");
    throw new Error(`Image edit failed (${res.status}): ${msg}`);
  }
  const j = (await res.json()) as any;
  const b64 = j?.data?.[0]?.b64_json;
  if (!b64) throw new Error("The image model returned no image.");
  return { bytes: b64ToBytes(b64), mime: "image/png", model, ms: Date.now() - t0 };
}

/** Gemini-chat edit variant, kept for model comparison probes. */
export async function editImageGemini(prompt: string, images: ImageInput[], model: string, aspect?: string): Promise<ImageOutput> {
  const t0 = Date.now();
  const content: any[] = [{ type: "text", text: prompt }];
  for (const im of images) {
    let s = ""; const c = 0x8000;
    for (let i = 0; i < im.bytes.length; i += c) s += String.fromCharCode(...im.bytes.subarray(i, i + c));
    content.push({ type: "image_url", image_url: { url: `data:${im.mime};base64,${btoa(s)}` } });
  }
  const res = await fetch(`${GATEWAY}/images/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({ model, messages: [{ role: "user", content }], modalities: ["image", "text"], ...(aspect ? { image_config: { aspect_ratio: aspect } } : {}) }),
  });
  if (!res.ok) throw new Error(`Image edit failed (${res.status}): ${await readError(res)}`);
  const j = (await res.json()) as any;
  const b64 = j?.data?.[0]?.b64_json;
  if (!b64) throw new Error("The image model returned no image.");
  return { bytes: b64ToBytes(b64), mime: "image/png", model, ms: Date.now() - t0 };
}
