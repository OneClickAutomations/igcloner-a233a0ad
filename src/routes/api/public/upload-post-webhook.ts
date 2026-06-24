import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ════════════════════════════════════════════════════════════════════════
// PUBLIC webhook endpoint — Upload-Post calls this directly, so there is no
// Supabase user JWT. We verify an HMAC signature instead (when a secret is
// configured) and ALWAYS return 200 so provider-side retry storms can't be
// triggered by our own internal errors.
// ════════════════════════════════════════════════════════════════════════

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const computed = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const hex = Array.from(new Uint8Array(computed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Constant-time-ish comparison.
  const normalized = signature.replace(/^sha256=/, "");
  if (hex.length !== normalized.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ normalized.charCodeAt(i);
  return diff === 0;
}

const RETRYABLE_EXCLUDE = ["INVALID_CREDENTIALS", "CONTENT_POLICY_VIOLATION"];

async function recalcJobStatus(jobId: string) {
  const { data: results } = await supabaseAdmin
    .from("publishing_results")
    .select("status")
    .eq("job_id", jobId);
  if (!results || results.length === 0) return;
  const allDone = results.every((r: any) => ["published", "failed"].includes(r.status));
  if (!allDone) {
    await supabaseAdmin.from("publishing_jobs").update({ status: "processing" }).eq("id", jobId);
    return;
  }
  const allPublished = results.every((r: any) => r.status === "published");
  const allFailed = results.every((r: any) => r.status === "failed");
  const status = allPublished ? "published" : allFailed ? "failed" : "partially_published";
  await supabaseAdmin
    .from("publishing_jobs")
    .update({
      status,
      published_at: status !== "failed" ? new Date().toISOString() : null,
    })
    .eq("id", jobId);
}

async function handleSuccess(jobId: string, payload: any) {
  await supabaseAdmin
    .from("publishing_results")
    .update({
      status: "published",
      post_url: payload.post_url ?? payload.url ?? null,
      platform_post_id: payload.platform_post_id ?? payload.post_id ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("job_id", jobId)
    .eq("platform", payload.platform);
  await recalcJobStatus(jobId);
}

async function handleFailure(jobId: string, payload: any) {
  const code = payload.error_code ?? null;
  await supabaseAdmin
    .from("publishing_results")
    .update({
      status: "failed",
      error_code: code,
      error_message: payload.error_message ?? payload.error ?? null,
      error_is_retryable: code ? !RETRYABLE_EXCLUDE.includes(code) : true,
      completed_at: new Date().toISOString(),
    })
    .eq("job_id", jobId)
    .eq("platform", payload.platform);
  await recalcJobStatus(jobId);
}

async function handleAccountChange(payload: any) {
  const username = payload.username;
  if (!username) return;
  const { data: profile } = await supabaseAdmin
    .from("upload_post_profiles")
    .select("user_id")
    .eq("upload_post_username", username)
    .maybeSingle();
  if (!profile) return;

  if (payload.event_type === "account.connected") {
    await supabaseAdmin.from("social_accounts").upsert(
      {
        user_id: profile.user_id,
        platform: payload.platform,
        upload_post_username: username,
        is_connected: true,
        last_validated_at: new Date().toISOString(),
        last_validation_status: "valid",
        connected_at: new Date().toISOString(),
        disconnected_at: null,
      },
      { onConflict: "user_id,platform" },
    );
  } else {
    await supabaseAdmin
      .from("social_accounts")
      .update({
        is_connected: false,
        disconnected_at: new Date().toISOString(),
        last_validation_status: "revoked",
      })
      .eq("user_id", profile.user_id)
      .eq("platform", payload.platform);
  }
}

async function processWebhook(request: Request): Promise<void> {
  const signature =
    request.headers.get("x-upload-post-signature") ?? request.headers.get("x-signature") ?? "";
  const secret = process.env.UPLOAD_POST_WEBHOOK_SECRET;
  const rawBody = await request.text();

  if (secret) {
    if (!signature || !(await verifySignature(rawBody, signature, secret))) {
      console.warn("[upload-post-webhook] invalid or missing signature");
      throw new Error("INVALID_SIGNATURE");
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw new Error("INVALID_JSON");
  }

  // Idempotency guard.
  const eventId =
    payload.event_id ??
    payload.id ??
    `${payload.request_id ?? "noreq"}_${payload.event_type ?? "evt"}_${payload.platform ?? ""}_${Date.now()}`;

  const { data: existing } = await supabaseAdmin
    .from("webhook_events")
    .select("id")
    .eq("provider_event_id", eventId)
    .maybeSingle();
  if (existing) return; // duplicate — already handled

  const { data: logged } = await supabaseAdmin
    .from("webhook_events")
    .insert({
      provider_event_id: eventId,
      event_type: payload.event_type ?? "unknown",
      raw_payload: payload,
    })
    .select("id")
    .single();

  try {
    const requestId = payload.request_id;
    if (requestId) {
      const { data: job } = await supabaseAdmin
        .from("publishing_jobs")
        .select("id")
        .eq("upload_post_request_id", requestId)
        .maybeSingle();
      if (job) {
        if (logged) {
          await supabaseAdmin.from("webhook_events").update({ job_id: job.id }).eq("id", logged.id);
        }
        switch (payload.event_type) {
          case "upload.completed":
          case "post.published":
          case "scheduled.published":
            if (payload.platform) await handleSuccess(job.id, payload);
            else await recalcJobStatus(job.id);
            break;
          case "upload.failed":
          case "post.failed":
            await handleFailure(job.id, payload);
            break;
          default:
            console.log("[upload-post-webhook] unhandled event:", payload.event_type);
        }
      }
    }

    if (
      payload.event_type === "account.connected" ||
      payload.event_type === "account.disconnected"
    ) {
      await handleAccountChange(payload);
    }

    if (logged) {
      await supabaseAdmin
        .from("webhook_events")
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq("id", logged.id);
    }
  } catch (e: any) {
    if (logged) {
      await supabaseAdmin
        .from("webhook_events")
        .update({ processing_error: String(e?.message ?? e) })
        .eq("id", logged.id);
    }
    throw e;
  }
}

export const Route = createFileRoute("/api/public/upload-post-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await processWebhook(request);
        } catch (e: any) {
          // Always 200 — log internally, never let our bug look like their
          // delivery failure and trigger a retry storm.
          console.error("[upload-post-webhook] error:", e?.message ?? e);
        }
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
