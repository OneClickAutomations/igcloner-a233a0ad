import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  projectId: z.string().uuid(),
  prompt: z.string().min(3).max(2000),
  genre: z.string().min(1).max(40),
  durationSec: z.number().int().min(5).max(60).default(20),
});

function requireKey() {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error("ElevenLabs is not connected. Add the ELEVENLABS_API_KEY secret.");
  return k;
}

/** Generate a music bed via ElevenLabs Music API. Uploads to project-assets and returns a signed URL. */
export const generateMusicBed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = requireKey();

    const res = await fetch("https://api.elevenlabs.io/v1/music", {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: `${data.genre} — ${data.prompt}`,
        music_length_ms: Math.round(data.durationSec * 1000),
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(
        res.status === 403 || res.status === 404
          ? "Music generation is not enabled on your ElevenLabs plan. Pick 'No Music' or upgrade."
          : `ElevenLabs music ${res.status}: ${err.slice(0, 240)}`,
      );
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    const filename = `${userId}/${data.projectId}/music/${data.genre}-${Date.now()}.mp3`;
    const { error: upErr } = await supabase.storage
      .from("project-assets")
      .upload(filename, bytes, { contentType: "audio/mpeg", upsert: false });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    const { data: signed, error: sErr } = await supabase.storage
      .from("project-assets")
      .createSignedUrl(filename, 60 * 60 * 24 * 7);
    if (sErr) throw new Error(sErr.message);

    const { data: asset } = await supabase
      .from("project_assets")
      .insert({
        project_id: data.projectId,
        user_id: userId,
        asset_type: "audio",
        source: "generated",
        url: signed.signedUrl,
        filename,
        metadata: { mime: "audio/mpeg", kind: "music", genre: data.genre, prompt: data.prompt },
      })
      .select("*")
      .single();

    return { url: signed.signedUrl, asset };
  });