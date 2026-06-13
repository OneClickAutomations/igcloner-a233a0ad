import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ---------- Voice catalog (curated) ---------- */

export type VoiceCategory =
  | "narration"
  | "conversational"
  | "energetic"
  | "calm"
  | "character"
  | "news"
  | "trailer"
  | "warm"
  | "social";

export interface VoicePreset {
  id: string;
  name: string;
  gender: "male" | "female" | "neutral";
  accent: string;
  categories: VoiceCategory[];
  description: string;
}

export const VOICE_CATALOG: VoicePreset[] = [
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George",   gender: "male",   accent: "British",  categories: ["narration", "warm", "trailer"],         description: "Warm, authoritative British narrator." },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian",    gender: "male",   accent: "American", categories: ["narration", "news", "trailer"],         description: "Deep, broadcast-quality American voice." },
  { id: "bIHbv24MWmeRgasZH58o", name: "Will",     gender: "male",   accent: "American", categories: ["conversational", "social", "energetic"],description: "Friendly, modern, perfect for IG reels." },
  { id: "cjVigY5qzO86Huf0OWal", name: "Eric",     gender: "male",   accent: "American", categories: ["conversational", "warm"],               description: "Calm, trustworthy, podcast-style." },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel",   gender: "male",   accent: "British",  categories: ["news", "trailer", "narration"],         description: "News anchor energy with gravitas." },
  { id: "iP95p4xoKVk53GoZ742B", name: "Chris",    gender: "male",   accent: "American", categories: ["conversational", "social"],             description: "Casual, friendly, every-day guy." },
  { id: "pqHfZKP75CvOlQylNhV4", name: "Bill",     gender: "male",   accent: "American", categories: ["narration", "calm"],                    description: "Mature documentary narrator." },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam",     gender: "male",   accent: "American", categories: ["energetic", "social"],                  description: "Young, upbeat, high-energy." },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie",  gender: "male",   accent: "Australian",categories: ["conversational", "energetic"],         description: "Aussie charm, conversational." },
  { id: "N2lVS1w4EtoT3dr4eOWO", name: "Callum",   gender: "male",   accent: "British",  categories: ["character", "trailer"],                 description: "Intense, slightly raspy character voice." },

  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah",    gender: "female", accent: "American", categories: ["conversational", "social", "warm"],     description: "Soft, friendly, great for storytelling." },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura",    gender: "female", accent: "American", categories: ["narration", "calm"],                    description: "Smooth, professional, audiobook-grade." },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice",    gender: "female", accent: "British",  categories: ["narration", "news"],                    description: "Clear, articulate British presenter." },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda",  gender: "female", accent: "American", categories: ["warm", "narration"],                    description: "Warm, friendly storyteller." },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica",  gender: "female", accent: "American", categories: ["conversational", "energetic", "social"],description: "Bright, expressive, made for short-form." },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily",     gender: "female", accent: "British",  categories: ["calm", "warm"],                         description: "Gentle, soothing British voice." },
  { id: "SAz9YHcvj6GT2YYXdXww", name: "River",    gender: "neutral",accent: "American", categories: ["conversational", "calm"],               description: "Smooth, gender-neutral, modern." },
];

/* ---------- Settings schema ---------- */

const VoiceSettingsSchema = z.object({
  stability: z.number().min(0).max(1).default(0.5),
  similarity_boost: z.number().min(0).max(1).default(0.75),
  style: z.number().min(0).max(1).default(0.3),
  use_speaker_boost: z.boolean().default(true),
  speed: z.number().min(0.7).max(1.2).default(1.0),
});
export type VoiceSettings = z.infer<typeof VoiceSettingsSchema>;

const MODEL_ID = "eleven_multilingual_v2";

function requireKey() {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error("ElevenLabs is not connected. Add the ELEVENLABS_API_KEY secret.");
  return k;
}

async function callTts(args: {
  text: string;
  voiceId: string;
  settings: VoiceSettings;
}): Promise<{ bytes: Uint8Array; mime: string }> {
  const apiKey = requireKey();
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${args.voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: args.text,
        model_id: MODEL_ID,
        voice_settings: args.settings,
      }),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs ${res.status}: ${err.slice(0, 240)}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  return { bytes: buf, mime: "audio/mpeg" };
}

/* ---------- List voices ---------- */

export const listVoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ voices: VOICE_CATALOG }));

/* ---------- Preview a voice (in-memory data URL, no storage) ---------- */

const PreviewInput = z.object({
  voiceId: z.string().min(1),
  text: z.string().min(1).max(280).default("Hey! This is what I sound like for your next reel."),
  settings: VoiceSettingsSchema.partial().optional(),
});

export const previewVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PreviewInput.parse(d))
  .handler(async ({ data }) => {
    const settings = VoiceSettingsSchema.parse(data.settings ?? {});
    const { bytes, mime } = await callTts({
      text: data.text,
      voiceId: data.voiceId,
      settings,
    });
    const base64 = Buffer.from(bytes).toString("base64");
    return { audioDataUrl: `data:${mime};base64,${base64}` };
  });

/* ---------- Generate a single scene voiceover (uploaded to storage) ---------- */

const SceneInput = z.object({
  projectId: z.string().uuid(),
  sceneIndex: z.number().int().min(0),
  text: z.string().min(1).max(5000),
  voiceId: z.string().min(1),
  settings: VoiceSettingsSchema.partial().optional(),
});

export const generateSceneVoiceover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SceneInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: project, error: pErr } = await supabase
      .from("projects")
      .select("id, user_id")
      .eq("id", data.projectId)
      .eq("user_id", userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!project) throw new Error("Project not found");

    const settings = VoiceSettingsSchema.parse(data.settings ?? {});
    const { bytes, mime } = await callTts({
      text: data.text,
      voiceId: data.voiceId,
      settings,
    });

    const filename = `${userId}/${data.projectId}/voiceover/scene-${data.sceneIndex}-${Date.now()}.mp3`;
    const { error: upErr } = await supabase.storage
      .from("project-assets")
      .upload(filename, bytes, { contentType: mime, upsert: false });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    const { data: signed, error: sErr } = await supabase.storage
      .from("project-assets")
      .createSignedUrl(filename, 60 * 60 * 24 * 7);
    if (sErr) throw new Error(sErr.message);

    // Remove old scene assets for the same index so the list stays clean.
    const { data: existing } = await supabase
      .from("project_assets")
      .select("id, filename, metadata")
      .eq("project_id", data.projectId)
      .eq("user_id", userId)
      .eq("asset_type", "audio");
    const toRemove = (existing ?? []).filter(
      (a: any) => (a?.metadata?.sceneIndex ?? -1) === data.sceneIndex,
    );
    if (toRemove.length) {
      const paths = toRemove.map((a: any) => a.filename).filter(Boolean);
      if (paths.length)
        await supabase.storage.from("project-assets").remove(paths);
      await supabase
        .from("project_assets")
        .delete()
        .in(
          "id",
          toRemove.map((a: any) => a.id),
        );
    }

    const { data: asset, error: aErr } = await supabase
      .from("project_assets")
      .insert({
        project_id: data.projectId,
        user_id: userId,
        asset_type: "audio",
        source: "generated",
        url: signed.signedUrl,
        filename,
        metadata: {
          mime,
          sceneIndex: data.sceneIndex,
          voiceId: data.voiceId,
          settings,
          text: data.text,
        },
      })
      .select("*")
      .single();
    if (aErr) throw new Error(aErr.message);

    return { asset, audioUrl: signed.signedUrl };
  });

/* ---------- List existing voiceovers (with fresh signed URLs) ---------- */

const ListInput = z.object({ projectId: z.string().uuid() });

export const listSceneVoiceovers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("project_assets")
      .select("*")
      .eq("project_id", data.projectId)
      .eq("user_id", userId)
      .eq("asset_type", "audio")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const out = await Promise.all(
      (rows ?? []).map(async (a: any) => {
        if (!a.filename) return a;
        const { data: signed } = await supabase.storage
          .from("project-assets")
          .createSignedUrl(a.filename, 60 * 60 * 24 * 7);
        return { ...a, url: signed?.signedUrl ?? a.url };
      }),
    );
    return { assets: out };
  });

const DelInput = z.object({ assetId: z.string().uuid() });

export const deleteVoiceover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DelInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("project_assets")
      .select("id, filename, user_id")
      .eq("id", data.assetId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!row) throw new Error("Not found");
    if (row.filename)
      await supabase.storage.from("project-assets").remove([row.filename]);
    await supabase.from("project_assets").delete().eq("id", data.assetId);
    return { ok: true };
  });