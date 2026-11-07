import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { copyJson, buildCopyContext, contextPrompt } from "./copy-engine.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  projectId: z.string().uuid(),
  stylePreset: z.string().optional(),
  imageUrl: z.string().url().optional(),
  angle: z.string().max(2000).optional(),
  audience: z.string().max(500).optional(),
  industry: z.string().max(200).optional(),
  platform: z.string().max(40).optional(),
});

/**
 * AI Creative Director — given the brief, returns a complete audio plan:
 * mode, voice direction, music prompt, ambient prompt, sfx intensity, captions,
 * a strategy summary and 3 hook variations + 3 opening scripts.
 */
export const planAudioStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");


    const system = `You are an AI Creative Director for short-form social video.
You receive a content brief and return a complete production plan in STRICT JSON.

Output ONLY a JSON object with this exact shape:
{
  "mode": "auto|native|voiceover|music|voice-music|voice-music-sfx|ambient",
  "voiceCategory": "narration|warm|news|conversational|energetic|trailer|social|calm|character",
  "voiceTone": "<short adjective phrase>",
  "musicGenre": "trending-reel|cinematic|motivational|luxury|corporate|inspiring|technology|documentary|emotional|nature|ambient|lofi|electronic|epic|none",
  "musicPrompt": "<one sentence describing the music bed>",
  "ambientPrompt": "<one sentence; or empty string if no ambient layer>",
  "sfxIntensity": "none|subtle|standard|cinematic|heavy",
  "captionStyle": "burned-in|dynamic|tiktok|instagram|premium|brand|none",
  "strategy": {
    "visual": "<2 sentences>",
    "motion": "<2 sentences>",
    "voice":  "<2 sentences>",
    "music":  "<2 sentences>",
    "sound":  "<2 sentences>",
    "hook":   "<2 sentences>"
  },
  "hookVariations": ["<hook A>", "<hook B>", "<hook C>"],
  "openingScripts": ["<3-sentence opener A>", "<3-sentence opener B>", "<3-sentence opener C>"]
}
No prose. No markdown fences. JSON only.`;

    const userPrompt = `Brief:
- Style preset: ${data.stylePreset || "(none)"}
- Platform: ${data.platform || "instagram"}
- Industry: ${data.industry || "(unspecified)"}
- Target audience: ${data.audience || "(unspecified)"}
- Source image: ${data.imageUrl ? "provided (assume realistic, animated subject)" : "none"}
- Creator angle / concept:
${data.angle || "(none — infer from style preset)"}
`;

    const {data:p}=await context.supabase.from("projects").select("analysis_id,user_preferences").eq("id",data.projectId).eq("user_id",context.userId).maybeSingle();
    if(!p)throw new Error("Project not found");
    const ctx=p.analysis_id?await buildCopyContext(p.analysis_id,context.userId,data.platform,p.user_preferences):{};
    const schema=z.object({mode:z.string(),voiceCategory:z.string(),voiceTone:z.string(),musicGenre:z.string(),musicPrompt:z.string(),ambientPrompt:z.string(),sfxIntensity:z.string(),captionStyle:z.string(),strategy:z.object({visual:z.string(),motion:z.string(),voice:z.string(),music:z.string(),sound:z.string(),hook:z.string()}),hookVariations:z.array(z.string()),openingScripts:z.array(z.string())});
    const {value:plan}=await copyJson(schema,`${userPrompt}\n${contextPrompt(ctx)}`,system,6000);
    return { plan };
  });