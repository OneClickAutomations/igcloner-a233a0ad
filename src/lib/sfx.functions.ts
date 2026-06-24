import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  projectId: z.string().uuid(),
  prompt: z.string().min(3).max(500),
  durationSec: z.number().min(0.5).max(22).default(8),
  kind: z.enum(["ambient", "sfx"]).default("sfx"),
  promptInfluence: z.number().min(0).max(1).default(0.4),
});

function requireKey() {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error("ElevenLabs is not connected. Add the ELEVENLABS_API_KEY secret.");
  return k;
}

/** Generate ambient soundscape or sound effect via ElevenLabs sound-generation. */
export const generateSoundFx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = requireKey();

    const res = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: data.prompt,
        duration_seconds: data.durationSec,
        prompt_influence: data.promptInfluence,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`ElevenLabs SFX ${res.status}: ${err.slice(0, 240)}`);
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    const filename = `${userId}/${data.projectId}/${data.kind}/${Date.now()}.mp3`;
    const { error: upErr } = await supabase.storage
      .from("project-assets")
      .upload(filename, bytes, { contentType: "audio/mpeg", upsert: false });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    const { data: signed, error: sErr } = await supabase.storage
      .from("project-assets")
      .createSignedUrl(filename, 60 * 60 * 24 * 7);
    if (sErr) throw new Error(sErr.message);

    await supabase.from("project_assets").insert({
      project_id: data.projectId,
      user_id: userId,
      asset_type: "audio",
      source: "generated",
      url: signed.signedUrl,
      filename,
      metadata: { mime: "audio/mpeg", kind: data.kind, prompt: data.prompt },
    });

    return { url: signed.signedUrl };
  });