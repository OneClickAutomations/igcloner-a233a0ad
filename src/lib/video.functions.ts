import { createServerFn } from "@tanstack/react-start";
import { STUDIO_PRICING } from './studio-pricing';
import { ACTION_COSTS } from "@/lib/credits";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FAL_BASE = "https://queue.fal.run";

// We pick endpoint based on whether a source image is provided.
// Image-to-video endpoints animate FROM the provided image (first frame +
// visual anchor) instead of generating a brand-new scene.
const MODELS = {
  "veo3-fast": {
    t2v: "fal-ai/veo3/fast",
    i2v: "fal-ai/veo3/fast/image-to-video",
  },
  veo3: {
    t2v: "fal-ai/veo3",
    i2v: "fal-ai/veo3/image-to-video",
  },
  "kling-2.1": {
    t2v: "fal-ai/kling-video/v2.1/standard/text-to-video",
    i2v: "fal-ai/kling-video/v2.1/standard/image-to-video",
  },
} as const;

type ModelKey = keyof typeof MODELS;

/** Credits per video job, from the shared credits config. Derived server-side, never client-supplied. */
function costForSlug(slug: string): number {
  return slug.includes("veo3/fast") ? ACTION_COSTS.videoGenerationVeo3Fast : ACTION_COSTS.videoGenerationVeo3OrKling;
}

const SubmitInput = z.object({
  prompt: z.string().min(10).max(8000),
  model: z.enum(["veo3-fast", "veo3", "kling-2.1"]).default("veo3-fast"),
  aspect_ratio: z.enum(["16:9", "9:16", "1:1"]).default("9:16"),
  duration: z.union([z.literal(5), z.literal(8), z.literal(10)]).default(8),
  generate_audio: z.boolean().default(true),
  image_url: z.string().url().optional(),
});

function authHeader() {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY is not configured");
  return { Authorization: `Key ${key}`, "Content-Type": "application/json" };
}

function buildPayload(data: z.infer<typeof SubmitInput>) {
  if (data.model === "kling-2.1") {
    return {
      prompt: data.prompt,
      aspect_ratio: data.aspect_ratio,
      duration: String(data.duration === 8 ? 5 : data.duration),
      ...(data.image_url ? { image_url: data.image_url } : {}),
    };
  }
  // veo3 / veo3-fast
  return {
    prompt: data.prompt,
    aspect_ratio: data.aspect_ratio,
    duration: `${data.duration === 5 ? 8 : data.duration}s`,
    generate_audio: data.generate_audio,
    resolution: "720p",
    ...(data.image_url ? { image_url: data.image_url } : {}),
  };
}

export const submitVideoJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SubmitInput.parse(d))
  .handler(async ({ data, context }) => {
    if(!STUDIO_PRICING.video.approved)throw new Error('Video add-on prices await approval. No plan credits charged. Use the Video Inspiration Studio to review proposed video-credit quotes.');
    throw new Error('Legacy video pricing is not configured for video packs yet. No credits charged.');
    const variants = MODELS[data.model as ModelKey];
    const slug = data.image_url ? variants.i2v : variants.t2v;
    const cost = costForSlug(slug);
    const attemptId = crypto.randomUUID();
    const { debitCredits, refundCredits } = await import("@/lib/credits.server");
    await debitCredits(context.userId, cost, "debit_image", "video_job", attemptId, attemptId);
    let res: Response, text: string;
    try {
      res = await fetch(`${FAL_BASE}/${slug}`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify(buildPayload(data)),
      });
      text = await res.text();
    } catch (e) {
      await refundCredits(context.userId, cost, "video_job", attemptId, attemptId);
      throw e;
    }
    if (!res.ok) {
      await refundCredits(context.userId, cost, "video_job", attemptId, attemptId);
      if (/exhausted balance|locked/i.test(text)) throw new Error("The video service is out of balance right now, so videos can't be made. Your credits were refunded.");
      throw new Error(`Video service submit failed (${res.status}): ${text.slice(0, 300)}. Your credits were refunded.`);
    }
    const j = JSON.parse(text) as { request_id: string };
    const j2 = JSON.parse(text) as {
      request_id: string;
      status_url?: string;
      response_url?: string;
    };
    return {
      attemptId,
      requestId: j.request_id,
      modelSlug: slug,
      statusUrl: j2.status_url ?? `${FAL_BASE}/${slug}/requests/${j.request_id}/status`,
      responseUrl: j2.response_url ?? `${FAL_BASE}/${slug}/requests/${j.request_id}`,
    };
  });

const PollInput = z.object({
  requestId: z.string().min(1),
  modelSlug: z.string().min(1),
  statusUrl: z.string().url(),
  responseUrl: z.string().url(),
  attemptId: z.string().uuid().optional(),
});

export const pollVideoJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PollInput.parse(d))
  .handler(async ({ data, context }) => {
    const statusRes = await fetch(data.statusUrl, { headers: authHeader() });
    if (!statusRes.ok) {
      const t = await statusRes.text().catch(() => "");
      throw new Error(`status check failed (${statusRes.status}): ${t.slice(0, 200)}`);
    }
    const status = (await statusRes.json()) as {
      status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "ERROR";
      queue_position?: number;
      logs?: Array<{ message: string }>;
    };

    if (status.status === "FAILED" || status.status === "ERROR") {
      const lastLog = status.logs?.slice(-1)[0]?.message;
      if (data.attemptId) {
        const { refundCredits } = await import("@/lib/credits.server");
        await refundCredits(context.userId, costForSlug(data.modelSlug), "video_job", data.attemptId, data.attemptId);
      }
      throw new Error(`Video generation failed${lastLog ? `: ${lastLog}` : ""}`);
    }

    if (status.status !== "COMPLETED") {
      return {
        status: status.status,
        queuePosition: status.queue_position,
        videoUrl: null as string | null,
      };
    }

    const resultRes = await fetch(data.responseUrl, { headers: authHeader() });
    if (!resultRes.ok) {
      throw new Error(`result fetch failed (${resultRes.status})`);
    }
    const result = (await resultRes.json()) as { video?: { url?: string } };
    const url = result?.video?.url ?? null;
    return { status: "COMPLETED" as const, queuePosition: null, videoUrl: url };
  });