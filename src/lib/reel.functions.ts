import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const SceneSchema = z.object({
  index: z.number(),
  durationSec: z.number(),
  visualNote: z.string(),
  voiceover: z.string(),
  onScreenText: z.string().optional().default(""),
});

const ReelSchema = z.object({
  title: z.string(),
  hook: z.object({ text: z.string(), visualNote: z.string() }),
  scenes: z.array(SceneSchema).min(2).max(8),
  cta: z.string(),
  caption: z.string(),
  hashtags: z.array(z.string()),
  hookVariations: z.array(z.string()).default([]),
  musicMood: z.string(),
});

export type ReelDoc = z.infer<typeof ReelSchema> & { veoPrompt?: string };

const SettingsSchema = z.object({
  format: z.enum(["9:16", "1:1", "16:9"]).default("9:16"),
  duration: z.number().int().min(8).max(60).default(20),
  style: z.string().max(120).default("cinematic UGC"),
  pace: z.enum(["fast", "medium", "slow"]).default("fast"),
});

function parseJsonish(text: string): any {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  return JSON.parse(start > 0 ? cleaned.slice(start) : cleaned);
}

const GenInput = z.object({
  projectId: z.string().uuid(),
  angle: z.string().max(500).optional(),
  settings: SettingsSchema.optional(),
});

export const generateReel = createServerFn({ method: "POST" })
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

    const dna = (project.dna_analysis as any) ?? {};
    const prefs = (project.user_preferences as any) ?? {};
    const cloneMode: "exact" | "inspired" = prefs.cloneMode === "inspired" ? "inspired" : "exact";
    const forensics = (dna.forensics?.videoForensics ?? dna.forensics ?? null) as any;
    const settings = SettingsSchema.parse(data.settings ?? {});

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    const system = `You are IG-Cloner's elite short-form video director. Operate as a forensic video analyst + film editor + copywriter. Extract the source's video formula and rebuild it for a new niche. Return ONLY a single JSON object — no prose, no fences. Every line must be 100% production-ready — no placeholders.`;

    const forensicsBlock = forensics
      ? `\nVIDEO FORENSICS (source formula extracted):
- Hook: ${JSON.stringify(forensics.hook ?? {})}
- Pacing: ${JSON.stringify(forensics.pacing ?? {})}
- Visual: ${JSON.stringify(forensics.visual ?? {})}
- Audio: ${JSON.stringify(forensics.audio ?? {})}
- Structure: ${JSON.stringify(forensics.structure ?? {})}
- Performance triggers: ${JSON.stringify(forensics.performance ?? {})}\n`
      : "";

    const modeBlock =
      cloneMode === "exact"
        ? `\nMODE: EXACT DUPLICATE.
Apply the EXACT video formula above to a new script in the user's niche. Keep identical: hook type, pacing, structure, audio strategy, editing style. Change subject matter and messaging only.`
        : `\nMODE: INSPIRED VERSION.
Preserve the source's psychological mechanics (hook power, retention loop, share/comment triggers). Take a completely different creative angle — the result should not look or sound like the source.`;

    const prompt = `Write a ${settings.duration}-second ${settings.format} short-form video script. Pace: ${settings.pace}. Style: ${settings.style}.
${modeBlock}
${forensicsBlock}

Return JSON of exact shape:
{
  "title": string,
  "hook": { "text": string (spoken in first 1-2 seconds), "visualNote": string },
  "scenes": [
    { "index": 1, "durationSec": number, "visualNote": string, "voiceover": string, "onScreenText": string }
  ],
  "cta": string,
  "caption": string (full IG caption with line breaks + emojis),
  "hashtags": string[] (10-15, no #, lowercase),
  "hookVariations": string[] (5 alternate opening hooks),
  "musicMood": string (e.g. "uplifting lo-fi", "tense cinematic")
}

Scene count: 3-6. Total scene durations should roughly sum to ${settings.duration}s.

Source DNA snapshot (inspiration, never copy verbatim):
- Category: ${dna.contentCategory ?? "unknown"}
- Why it works: ${(dna.whyItWorks ?? []).slice(0, 4).join(" | ")}
- Target: ${dna.targetAudience?.who ?? ""} — wants ${dna.targetAudience?.desire ?? ""}
- Hook type: ${dna.hookBreakdown?.type ?? ""}
- Visual style: color=${dna.visualStyle?.colorMood ?? ""}; composition=${dna.visualStyle?.composition ?? ""}
- Brand niche: ${prefs.niche ?? "general"}
${data.angle ? `\nUser angle: ${data.angle}` : ""}

Output the JSON object only.`;

    const { text } = await generateText({ model, system, prompt });
    const parsed = ReelSchema.parse(parseJsonish(text));

    // Second call: VEO 3 prompt
    const veoRequest = `You are an expert at writing Google VEO 3 video generation prompts.

Based on this short video script, write ONE optimized VEO 3 prompt that will generate the best possible video.

Script hook: ${parsed.hook.text}
Hook visual: ${parsed.hook.visualNote}
Scene 1 visual: ${parsed.scenes[0]?.visualNote ?? ""}
Style: ${settings.style}
Duration: ${settings.duration}s
Format: vertical ${settings.format}
Niche: ${prefs.niche ?? "general"}
Mood: ${parsed.musicMood}

Rules for VEO 3 prompts:
- Start with subject and main action
- Include camera movement (slow pan, static, tracking, dolly, etc.)
- Specify lighting (golden hour, soft window light, studio, etc.)
- Include visual style (cinematic, documentary, UGC authentic, etc.)
- Specify aspect ratio: vertical ${settings.format}
- Include mood and atmosphere
- End with technical specs: high quality, sharp focus, professional grade
- Under 200 words
- No brackets or variables — complete descriptive sentences only

Return ONLY the prompt text. No JSON. No explanation.`;

    const { text: veoText } = await generateText({
      model,
      prompt: veoRequest,
    });
    const veoPrompt = veoText.replace(/```/g, "").trim();

    const doc: ReelDoc = { ...parsed, veoPrompt };

    const { data: updated, error: uErr } = await supabase
      .from("projects")
      .update({
        project_data: doc as any,
        title: parsed.title.slice(0, 200),
        status: "in_progress",
      })
      .eq("id", data.projectId)
      .select("*")
      .single();
    if (uErr) throw new Error(uErr.message);

    return { project: updated, reel: doc };
  });

const SaveInput = z.object({
  projectId: z.string().uuid(),
  reel: ReelSchema.extend({ veoPrompt: z.string().optional() }),
});

export const saveReel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: saved, error } = await context.supabase
      .from("projects")
      .update({
        project_data: data.reel as any,
        title: data.reel.title.slice(0, 200),
      })
      .eq("id", data.projectId)
      .eq("user_id", context.userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { project: saved };
  });

const VeoRegenInput = z.object({
  projectId: z.string().uuid(),
  instruction: z.string().max(500).optional(),
});

export const regenerateVeoPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => VeoRegenInput.parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const { data: project, error } = await context.supabase
      .from("projects")
      .select("*")
      .eq("id", data.projectId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!project?.project_data) throw new Error("Generate a reel first");

    const doc = project.project_data as ReelDoc;
    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    const { text } = await generateText({
      model,
      prompt: `Rewrite this Google VEO 3 video prompt. Keep the subject and intent, improve cinematography and specificity. Return ONLY the prompt text, no fences.

Current prompt:
${doc.veoPrompt ?? ""}

Script hook: ${doc.hook.text}
Mood: ${doc.musicMood}
${data.instruction ? `User instruction: ${data.instruction}` : ""}`,
    });
    const veoPrompt = text.replace(/```/g, "").trim();

    const updatedDoc: ReelDoc = { ...doc, veoPrompt };
    const { data: saved, error: uErr } = await context.supabase
      .from("projects")
      .update({ project_data: updatedDoc as any })
      .eq("id", data.projectId)
      .select("*")
      .single();
    if (uErr) throw new Error(uErr.message);
    return { project: saved, veoPrompt };
  });