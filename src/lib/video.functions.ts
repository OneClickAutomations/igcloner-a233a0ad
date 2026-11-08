import { createServerFn } from "@tanstack/react-start";
import { STUDIO_PRICING, videoCreditsForWorkspace } from './studio-pricing';
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Reel video generation runs on the Lovable AI gateway (Veo 3.1) and is paid
 * from video credits at the approved per-second rates. The old fal.ai path is gone.
 * Legacy picker ids map onto gateway models: veo3/veo3-fast -> Fast, kling-2.1 -> Lite.
 */
const GATEWAY = "https://ai.gateway.lovable.dev";
const MODEL_MAP = { "veo3-fast": "google/veo-3.1-fast", veo3: "google/veo-3.1-fast", "kling-2.1": "google/veo-3.1-lite" } as const;
const KIND = "reel_clip";

export function gatewaySeconds(d: number) { return d <= 4 ? 4 : d <= 6 ? 6 : 8; }
export function reelClipCredits(model: keyof typeof MODEL_MAP, duration: number) {
  const rate = STUDIO_PRICING.rates[MODEL_MAP[model]];
  return videoCreditsForWorkspace(rate * gatewaySeconds(duration));
}

const SubmitInput = z.object({
  prompt: z.string().min(10).max(8000),
  model: z.enum(["veo3-fast", "veo3", "kling-2.1"]).default("veo3-fast"),
  aspect_ratio: z.enum(["16:9", "9:16", "1:1"]).default("9:16"),
  duration: z.union([z.literal(5), z.literal(8), z.literal(10)]).default(8),
  generate_audio: z.boolean().default(true),
  image_url: z.string().url().optional(),
});

async function imageInput(url: string) {
  if (!url.startsWith("https://")) return null;
  const r = await fetch(url).catch(() => null);
  if (!r?.ok) return null;
  const buf = new Uint8Array(await r.arrayBuffer());
  if (!buf.length || buf.length > 10 * 1024 * 1024) return null;
  let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { bytesBase64Encoded: btoa(s), mimeType: r.headers.get("content-type") || "image/jpeg" };
}

export const submitVideoJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SubmitInput.parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI connection is not configured.");
    const model = MODEL_MAP[data.model], seconds = gatewaySeconds(data.duration), credits = reelClipCredits(data.model, data.duration);
    const attemptId = crypto.randomUUID();
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: debit, error } = await db.rpc("debit_video_credits", { p_user: context.userId, p_amount: credits, p_kind: KIND, p_entity: attemptId, p_attempt: attemptId });
    if (error) throw new Error(error.message);
    if (!(debit as any)?.ok) throw new Error(`You need ${credits} video credits for this ${seconds}-second clip (you have ${(debit as any)?.balance ?? 0}). Nothing was charged.`);
    const refund = () => db.rpc("refund_video_credits", { p_user: context.userId, p_kind: KIND, p_entity: attemptId, p_attempt: attemptId });
    try {
      const image = data.image_url ? await imageInput(data.image_url) : null;
      const res = await fetch(`${GATEWAY}/v1/videos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
        body: JSON.stringify({ model, instances: [{ prompt: data.prompt, ...(image ? { image } : {}) }], parameters: { durationSeconds: seconds, resolution: "720p", sampleCount: 1, generateAudio: data.generate_audio, aspectRatio: data.aspect_ratio === "1:1" ? "9:16" : data.aspect_ratio } }),
      });
      const j: any = await res.json().catch(() => null);
      if (!res.ok || !j?.id) throw new Error(`Video provider error (${res.status}): ${String(j?.message ?? j?.error?.message ?? "").slice(0, 300)}`);
      return { attemptId, requestId: j.id as string, modelSlug: model, statusUrl: "", responseUrl: "", credits };
    } catch (e) { await refund(); throw new Error(`${(e as Error).message} Your ${credits} video credits were refunded.`); }
  });

const PollInput = z.object({
  requestId: z.string().min(1).max(300),
  modelSlug: z.string().min(1),
  statusUrl: z.string().optional(),
  responseUrl: z.string().optional(),
  attemptId: z.string().uuid().optional(),
});

export const pollVideoJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PollInput.parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI connection is not configured.");
    if (!data.attemptId) throw new Error("Missing video attempt.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: owned } = await db.from("video_credit_ledger").select("id").eq("user_id", context.userId).eq("idempotency_key", `debit:${KIND}:${data.attemptId}:${data.attemptId}`).maybeSingle();
    if (!owned) throw new Error("No owned video debit found for this clip.");
    const r = await fetch(`${GATEWAY}/v1/videos/${encodeURIComponent(data.requestId)}`, { headers: { Authorization: `Bearer ${key}` } });
    const job: any = await r.json().catch(() => null);
    if (!r.ok) throw new Error(`Status check failed (${r.status}): ${String(job?.message ?? "").slice(0, 200)}`);
    if (job.status === "failed") {
      await db.rpc("refund_video_credits", { p_user: context.userId, p_kind: KIND, p_entity: data.attemptId, p_attempt: data.attemptId });
      throw new Error(`Video generation failed: ${job.error?.message ?? "provider error"}. Video credits refunded.`);
    }
    if (job.status !== "completed") return { status: job.status === "queued" ? "IN_QUEUE" : "IN_PROGRESS", queuePosition: null, videoUrl: null as string | null };
    const path = `${context.userId}/reel-clips/${data.attemptId}.mp4`;
    const { data: signedExisting } = await db.storage.from("project-assets").createSignedUrl(path, 60 * 60 * 24 * 7);
    if (signedExisting?.signedUrl) return { status: "COMPLETED" as const, queuePosition: null, videoUrl: signedExisting.signedUrl };
    const c = await fetch(`${GATEWAY}/v1/videos/${encodeURIComponent(data.requestId)}/content`, { headers: { Authorization: `Bearer ${key}` } });
    if (!c.ok) throw new Error(`Video download failed (${c.status}).`);
    const bytes = new Uint8Array(await c.arrayBuffer());
    const { error: up } = await db.storage.from("project-assets").upload(path, bytes, { contentType: "video/mp4", upsert: true });
    if (up) throw new Error(up.message);
    const { data: signed } = await db.storage.from("project-assets").createSignedUrl(path, 60 * 60 * 24 * 7);
    return { status: "COMPLETED" as const, queuePosition: null, videoUrl: signed?.signedUrl ?? null };
  });
