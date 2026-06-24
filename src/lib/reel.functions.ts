import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, type ModelMessage } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { fetchVisionImage, buildSourceContextBlock } from "@/lib/source-context";
import type { AudioPlan, AudioMixProfile, ReelStylePreset } from "@/lib/audio-types";

/* ---------- Schemas ---------- */

const VisualDirectionSchema = z.object({
  subjectType: z.string().default("text-graphic"),
  subjectDescription: z.string().default(""),
  backgroundType: z.string().default("gradient"),
  backgroundDescription: z.string().default(""),
  colorPalette: z.object({
    dominant: z.string().default(""),
    secondary: z.string().default(""),
    accent: z.string().default(""),
    mood: z.string().default("neutral"),
    approximateHex: z.array(z.string()).default([]),
  }),
  textStyle: z
    .object({
      present: z.boolean().default(true),
      placement: z.string().default("center"),
      fontStyle: z.string().default("bold-sans-serif"),
      fontSize: z.string().default("large-dominant"),
      color: z.string().default("white"),
      animation: z.string().default("fade-in"),
    })
    .default({} as any),
  lightingStyle: z.string().default("studio-clean"),
  editingStyle: z.string().default("minimal-clean"),
  paceAndEnergy: z.string().default("medium-storytelling"),
  contentFormat: z.string().default("text-on-screen-only"),
  audioStyle: z.string().default("lo-fi-ambient"),
  productionLevel: z.string().default("motion-graphics-only"),
  platformAesthetic: z.string().default(""),
  recreationInstructions: z.string().default(""),
  customNote: z.string().default(""),
  approved: z.boolean().default(false),
});

export type VisualDirection = z.infer<typeof VisualDirectionSchema>;

/** Coerce null/undefined/non-string to "" so the AI's null values never break parsing. */
const safeStr = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v == null ? "" : String(v)));
const safeStrRequired = (fallback = "") =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v == null || v === "" ? fallback : String(v)));

const SceneSchema = z.object({
  index: z.number(),
  durationSec: z.number(),
  visualNote: safeStr,
  voiceover: safeStr,
  onScreenText: safeStr,
  backgroundNote: safeStr,
  colorNote: safeStr,
  animationNote: safeStr,
  transitionNote: safeStr,
});

const VeoScenePromptSchema = z.object({
  sceneNumber: z.number(),
  prompt: z.string(),
  duration: z.string(),
  negativePrompt: z.string().default(""),
  textToRender: z.string().default(""),
  keyVisualElements: z.array(z.string()).default([]),
});

const VeoPromptsSchema = z.object({
  masterPrompt: z.string(),
  hookPrompt: z.object({
    prompt: z.string(),
    duration: z.string().default("3s"),
    negativePrompt: z.string().default(""),
    keyVisualElements: z.array(z.string()).default([]),
  }),
  scenePrompts: z.array(VeoScenePromptSchema).default([]),
  ctaPrompt: z.object({
    prompt: z.string(),
    duration: z.string().default("5s"),
    negativePrompt: z.string().default(""),
  }),
  styleConsistencyNotes: z.string().default(""),
  colorGradingInstructions: z.string().default(""),
  editingInstructions: z.string().default(""),
});

const ReelSchema = z.object({
  title: safeStrRequired("Untitled"),
  visualSummary: safeStr,
  hook: z.object({
    text: safeStr,
    visualNote: safeStr,
    onScreenText: safeStr,
    animationNote: safeStr,
  }),
  scenes: z.array(SceneSchema).min(2).max(8),
  cta: z.union([
    z.string(),
    z.object({
      text: safeStr,
      visualNote: safeStr,
      onScreenText: safeStr,
    }),
  ]),
  caption: safeStr,
  hashtags: z.array(z.string()).default([]),
  hookVariations: z
    .union([z.array(z.any()), z.null(), z.undefined()])
    .transform((arr) =>
      Array.isArray(arr) ? arr.filter((x) => x != null).map((x) => String(x)) : [],
    ),
  musicMood: safeStr,
  directorNotes: safeStr,
});

export type ReelDoc = z.infer<typeof ReelSchema> & {
  veoPrompt?: string; // legacy single-string master (kept for back-compat)
  veoPrompts?: z.infer<typeof VeoPromptsSchema>;
  visualDirection?: VisualDirection;
  sourceImageUrl?: string | null;
  motionStrategy?: {
    contentType: string;
    confidence: "high" | "medium" | "low";
    preservationTargetPct: number;
    cameraMotion: string;
    environmentalMotion: string;
    secondaryMotion: string;
    subjectMotion: string;
    notes: string;
  };
  // Phase 1 — Audio Engine additions. All optional; existing reels keep working.
  audioPlan?: AudioPlan;
  mixProfile?: AudioMixProfile;
  stylePreset?: ReelStylePreset;
};

const SettingsSchema = z.object({
  format: z.enum(["9:16", "1:1", "16:9"]).default("9:16"),
  duration: z.number().int().min(8).max(60).default(20),
  style: z.string().max(120).default("cinematic UGC"),
  pace: z.enum(["fast", "medium", "slow"]).default("fast"),
});

import { extractJson } from "./json-extract";
function parseJsonish<T = any>(text: string): T {
  return extractJson<T>(text);
}

/** Recursively replace null/undefined string-likes with "" before Zod parsing. */
function sanitizeReelJson(raw: any): any {
  if (raw == null || typeof raw !== "object") return raw;
  const s = (v: any) => (v == null ? "" : typeof v === "string" ? v : String(v));
  const out: any = { ...raw };
  out.title = s(raw.title) || "Untitled";
  out.visualSummary = s(raw.visualSummary);
  out.caption = s(raw.caption);
  out.musicMood = s(raw.musicMood);
  out.directorNotes = s(raw.directorNotes);
  if (raw.hook && typeof raw.hook === "object") {
    out.hook = {
      ...raw.hook,
      text: s(raw.hook.text) || s(raw.hook.onScreenText),
      visualNote: s(raw.hook.visualNote),
      onScreenText: s(raw.hook.onScreenText) || s(raw.hook.text),
      animationNote: s(raw.hook.animationNote),
    };
  }
  if (Array.isArray(raw.scenes)) {
    out.scenes = raw.scenes.map((sc: any, i: number) => ({
      index: typeof sc?.index === "number" ? sc.index : i + 1,
      durationSec: typeof sc?.durationSec === "number" ? sc.durationSec : 3,
      visualNote: s(sc?.visualNote),
      voiceover: s(sc?.voiceover),
      onScreenText: s(sc?.onScreenText),
      backgroundNote: s(sc?.backgroundNote),
      colorNote: s(sc?.colorNote),
      animationNote: s(sc?.animationNote),
      transitionNote: s(sc?.transitionNote),
    }));
  }
  if (raw.cta && typeof raw.cta === "object") {
    out.cta = {
      text: s(raw.cta.text),
      visualNote: s(raw.cta.visualNote),
      onScreenText: s(raw.cta.onScreenText) || s(raw.cta.text),
    };
  } else if (typeof raw.cta === "string") {
    out.cta = raw.cta;
  }
  out.hashtags = Array.isArray(raw.hashtags)
    ? raw.hashtags.filter((h: any) => h != null).map((h: any) => String(h))
    : [];
  out.hookVariations = Array.isArray(raw.hookVariations)
    ? raw.hookVariations.filter((h: any) => h != null).map((h: any) => String(h))
    : [];
  return out;
}

/* ---------- Derive visual direction from videoVisualDNA ---------- */

function deriveVisualDirectionFromDna(dna: any): VisualDirection {
  const v = dna?.videoVisualDNA ?? {};
  const vs = dna?.visualStyle ?? {};
  const palette = v.colorPalette ?? {};
  const text = v.textStyle ?? {};
  return VisualDirectionSchema.parse({
    subjectType: v.subjectType ?? "text-graphic",
    subjectDescription: v.subjectDescription ?? "",
    backgroundType: v.backgroundType ?? "gradient",
    backgroundDescription:
      v.backgroundDescription ??
      vs.colorMood ??
      "Background matching the source post aesthetic",
    colorPalette: {
      dominant: palette.dominant ?? vs.colorMood ?? "",
      secondary: palette.secondary ?? "",
      accent: palette.accent ?? "",
      mood: palette.mood ?? "neutral",
      approximateHex: palette.approximateHex ?? [],
    },
    textStyle: {
      present: text.present ?? (vs.textOverlay && vs.textOverlay !== "None"),
      placement: text.placement ?? "center",
      fontStyle: text.fontStyle ?? "bold-sans-serif",
      fontSize: text.fontSize ?? "large-dominant",
      color: text.color ?? "white",
      animation: text.animation ?? "fade-in",
    },
    lightingStyle: v.lightingStyle ?? "studio-clean",
    editingStyle: v.editingStyle ?? vs.editStyle ?? "minimal-clean",
    paceAndEnergy: v.paceAndEnergy ?? "medium-storytelling",
    contentFormat: v.contentFormat ?? "text-on-screen-only",
    audioStyle: v.audioStyle ?? "lo-fi-ambient",
    productionLevel: v.productionLevel ?? "motion-graphics-only",
    platformAesthetic:
      v.platformAesthetic ??
      "Visually faithful recreation of the source post's aesthetic.",
    recreationInstructions: v.recreationInstructions ?? "",
    customNote: "",
    approved: false,
  });
}

export const deriveVisualDirection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ projectId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: project, error } = await context.supabase
      .from("projects")
      .select("*")
      .eq("id", data.projectId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!project) throw new Error("Project not found");
    const direction = deriveVisualDirectionFromDna(project.dna_analysis ?? {});
    return { visualDirection: direction };
  });

const ApproveDirectionInput = z.object({
  projectId: z.string().uuid(),
  visualDirection: VisualDirectionSchema,
});

export const saveVisualDirection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ApproveDirectionInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: project, error } = await context.supabase
      .from("projects")
      .select("project_data, user_preferences")
      .eq("id", data.projectId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const existing = (project?.project_data as any) ?? {};
    const updated = { ...existing, visualDirection: data.visualDirection };
    const { error: uErr } = await context.supabase
      .from("projects")
      .update({ project_data: updated, status: "in_progress" })
      .eq("id", data.projectId);
    if (uErr) throw new Error(uErr.message);
    return { ok: true };
  });

/* ---------- Negative prompt builder ---------- */

function buildNegativePrompt(direction: VisualDirection): string {
  const negatives: string[] = [];
  if (
    direction.subjectType === "text-graphic" ||
    direction.subjectType === "abstract"
  ) {
    negatives.push(
      "people",
      "faces",
      "hands",
      "person",
      "human",
      "body",
      "silhouette",
    );
  }
  if (
    direction.colorPalette.mood === "muted" ||
    direction.colorPalette.mood === "high-contrast" ||
    direction.colorPalette.mood === "monochromatic"
  ) {
    negatives.push(
      "bright background",
      "white background",
      "overexposed",
      "washed out",
    );
  }
  if (
    direction.contentFormat === "text-on-screen-only" ||
    direction.contentFormat === "text-with-background"
  ) {
    negatives.push(
      "city",
      "nature",
      "outdoor environment",
      "indoor environment",
      "building",
      "sky",
      "street",
      "office",
      "gym",
      "luxury items",
      "watches",
      "cars",
      "products",
    );
  }
  negatives.push(
    "blurry",
    "low quality",
    "pixelated",
    "watermark",
    "text errors",
    "distorted",
    "ugly",
    "bad quality",
  );
  // Identity / structure preservation — anti-AI quality filter.
  // These run on every reel because the source image is the visual anchor.
  negatives.push(
    "morphing",
    "melting",
    "warping",
    "body distortion",
    "face distortion",
    "identity drift",
    "object duplication",
    "extra limbs",
    "extra fingers",
    "floating objects",
    "hallucinated elements",
    "random scene change",
    "subject replaced",
    "different person",
    "different product",
  );
  return Array.from(new Set(negatives)).join(", ");
}

/* ---------- Generate Reel (visual-first) ---------- */

const GenInput = z.object({
  projectId: z.string().uuid(),
  angle: z.string().max(500).optional(),
  settings: SettingsSchema.optional(),
  visualDirection: VisualDirectionSchema.optional(),
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
    const cloneMode: "exact" | "inspired" =
      prefs.cloneMode === "inspired" ? "inspired" : "exact";
    const settings = SettingsSchema.parse(data.settings ?? {});

    // Visual direction: prefer explicit input, else stored, else derived.
    const stored = (project.project_data as any)?.visualDirection;
    const visualDirection: VisualDirection = VisualDirectionSchema.parse(
      data.visualDirection ?? stored ?? deriveVisualDirectionFromDna(dna),
    );

    // Source post for vision context
    let scraped: any = null;
    if (project.analysis_id) {
      const { data: analysis } = await supabase
        .from("analyses")
        .select("scraped_data")
        .eq("id", project.analysis_id)
        .eq("user_id", userId)
        .maybeSingle();
      scraped = (analysis as any)?.scraped_data ?? null;
    }
    const visionImage = scraped ? await fetchVisionImage(scraped) : null;
    const sourceBlock = buildSourceContextBlock(scraped ?? {}, dna, !!visionImage);

    // The source image URL we hand to fal as the first-frame anchor.
    // Priority: explicit user upload → scraped post thumbnail/displayUrl.
    const sourceImageUrl: string | null =
      (prefs as any).referenceImageUrl ||
      (prefs as any).uploadedImageUrl ||
      (project as any).source_thumbnail ||
      (scraped as any)?.displayUrl ||
      (scraped as any)?.thumbnailUrl ||
      null;

    const effectiveAngle =
      data.angle ||
      [prefs.angle, prefs.angleConcept].filter(Boolean).join(" — ") ||
      "";

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-2.5-flash");

    /* ----- Pass 1: visual-first script ----- */
    const scriptSystem = `You are IG-Cloner's elite short-form video director. Write scripts that are VISUALLY FAITHFUL to an approved visual direction. Every scene you write must be visualizable WITHIN the approved visual direction. Never introduce visual elements that contradict it. Return ONLY a single JSON object — no prose, no fences.`;

    const directionBlock = `APPROVED VISUAL DIRECTION (NON-NEGOTIABLE):
Subject type: ${visualDirection.subjectType} — ${visualDirection.subjectDescription}
Background: ${visualDirection.backgroundType} — ${visualDirection.backgroundDescription}
Colors: dominant ${visualDirection.colorPalette.dominant}; secondary ${visualDirection.colorPalette.secondary}; accent ${visualDirection.colorPalette.accent}; mood ${visualDirection.colorPalette.mood}; hex ${(visualDirection.colorPalette.approximateHex ?? []).join(", ")}
Text style: ${JSON.stringify(visualDirection.textStyle)}
Lighting: ${visualDirection.lightingStyle}
Editing: ${visualDirection.editingStyle}
Pace: ${visualDirection.paceAndEnergy}
Content format: ${visualDirection.contentFormat}
Audio: ${visualDirection.audioStyle}
Production: ${visualDirection.productionLevel}
Director's note: ${visualDirection.platformAesthetic}
${visualDirection.customNote ? `User additional direction: ${visualDirection.customNote}` : ""}`;

    const scriptPrompt = `Write a ${settings.duration}-second ${settings.format} short-form video script that EXECUTES the approved visual direction below.

MODE: ${cloneMode === "exact" ? "EXACT DUPLICATE — apply source's video formula in user niche, change subject/messaging only." : "INSPIRED — preserve psychological mechanics, take a different creative angle."}

${directionBlock}

${sourceBlock}

CONTENT BRIEF:
- Niche: ${prefs.niche ?? "general"}
- Goal: ${prefs.contentGoal ?? prefs.goal ?? "engagement"}
- Tone: ${prefs.toneOfVoice ?? prefs.tone ?? "confident"}
- Keywords: ${(prefs.keywords ?? []).join(", ")}
${effectiveAngle ? `- Chosen angle: ${effectiveAngle}` : ""}

Rules:
1. Every scene's visualDescription MUST match the visual direction. If subject=text-graphic, NO people/environments — only typography on background.
2. If textStyle.present is true, every scene includes exact text-on-screen copy.
3. NEVER return null for ANY string field. If voiceover does not apply (text-on-screen-only / music-only formats), return "" (empty string).
4. hook.text MUST be a non-empty string (the spoken hook OR the on-screen text — never null).
5. Every scene.voiceover MUST be a string ("" if no voiceover in this format).
6. Every scene.onScreenText MUST be a string ("" if none).
7. Scene count: 3-6; durations sum ≈ ${settings.duration}s.

Return JSON of EXACT shape:
{
  "title": string,
  "visualSummary": string (one sentence — must match visual direction),
  "hook": { "text": string (spoken or null), "visualNote": string, "onScreenText": string, "animationNote": string },
  "scenes": [
    { "index": 1, "durationSec": number, "visualNote": string, "voiceover": string, "onScreenText": string, "backgroundNote": string, "colorNote": string, "animationNote": string, "transitionNote": string }
  ],
  "cta": { "text": string, "visualNote": string, "onScreenText": string },
  "caption": string,
  "hashtags": string[] (10-15, no #, lowercase),
  "hookVariations": string[] (5 alternates),
  "musicMood": string,
  "directorNotes": string (2-3 specific execution notes)
}

Output the JSON object only.`;

    const messages: ModelMessage[] | undefined = visionImage
      ? [
          {
            role: "user",
            content: [
              { type: "text", text: scriptPrompt },
              { type: "image", image: visionImage.image, mediaType: visionImage.mediaType },
            ],
          },
        ]
      : undefined;

    const { text: scriptText } = await generateText({
      model,
      system: scriptSystem,
      ...(messages ? { messages } : { prompt: scriptPrompt }),
    });
    const parsed = ReelSchema.parse(sanitizeReelJson(parseJsonish(scriptText)));

    /* ----- Pass 2: VEO 3 prompt package, visual-DNA-grounded ----- */
    const negative = buildNegativePrompt(visualDirection);
    const ctaObj =
      typeof parsed.cta === "string"
        ? { text: parsed.cta, visualNote: "", onScreenText: parsed.cta }
        : parsed.cta;

    const veoSystem = `You are an expert at writing Google VEO 3 video generation prompts. Output JSON only.`;
    const veoRequest = `Build VEO 3 prompts for a ${settings.duration}s ${settings.format} video.

SOURCE POST VIDEO DNA: ${JSON.stringify(dna.videoVisualDNA ?? {})}

APPROVED VISUAL DIRECTION: ${JSON.stringify(visualDirection)}

SCRIPT:
Hook visual: ${parsed.hook.visualNote}
Hook on-screen text: "${parsed.hook.onScreenText}"
Hook animation: ${parsed.hook.animationNote}
Scenes:
${parsed.scenes.map((s) => `  ${s.index}. (${s.durationSec}s) visual="${s.visualNote}" text="${s.onScreenText}" anim="${s.animationNote}" transition="${s.transitionNote}"`).join("\n")}
CTA visual: ${ctaObj.visualNote}; on-screen: "${ctaObj.onScreenText}"

HARD RULES:
- Every prompt MUST stay inside the approved visual direction.
- If subject is text-graphic: NO people, NO environments — only graphic/typography elements on the approved background.
- Colors must match: ${(visualDirection.colorPalette.approximateHex ?? []).join(", ")}
- Lighting must match: ${visualDirection.lightingStyle}
- Production level must match: ${visualDirection.productionLevel}
- Every prompt includes a negativePrompt drawn from: "${negative}"
- Each prompt under 150 words. Complete descriptive sentences, no brackets or variables.

Return ONLY this JSON:
{
  "masterPrompt": string,
  "hookPrompt": { "prompt": string, "duration": "3s", "negativePrompt": string, "keyVisualElements": string[] },
  "scenePrompts": [
    { "sceneNumber": number, "prompt": string, "duration": "<n>s", "negativePrompt": string, "textToRender": string, "keyVisualElements": string[] }
  ],
  "ctaPrompt": { "prompt": string, "duration": "5s", "negativePrompt": string },
  "styleConsistencyNotes": string,
  "colorGradingInstructions": string,
  "editingInstructions": string
}`;

    const { text: veoText } = await generateText({
      model,
      system: veoSystem,
      prompt: veoRequest,
    });
    let veoPrompts: z.infer<typeof VeoPromptsSchema> | null = null;
    try {
      veoPrompts = VeoPromptsSchema.parse(parseJsonish(veoText));
    } catch (e) {
      console.warn("[reel] veo parse failed:", (e as Error).message);
    }

    const masterPrompt =
      veoPrompts?.masterPrompt ??
      `${visualDirection.platformAesthetic} ${visualDirection.backgroundDescription}. Colors: ${(visualDirection.colorPalette.approximateHex ?? []).join(", ")}. ${visualDirection.lightingStyle} lighting. ${parsed.hook.visualNote}. Vertical ${settings.format}. ${settings.duration}s.`;

    // Image-anchored motion planner — derive a conservative motion
    // strategy from the visual direction so prompts emphasize animating
    // the source image rather than reimagining it.
    const subj = visualDirection.subjectType;
    let confidence: "high" | "medium" | "low" = "high";
    if (
      subj === "person-lifestyle" ||
      subj === "person-athlete" ||
      subj === "person-business"
    ) {
      confidence = "medium";
    }
    if (visualDirection.contentFormat === "talking-head") {
      confidence = "low";
    }
    const motionStrategy = {
      contentType: subj,
      confidence,
      preservationTargetPct: 90,
      cameraMotion:
        confidence === "low"
          ? "slow cinematic push-in, micro parallax only"
          : "slow push-in or gentle orbit, subtle parallax",
      environmentalMotion:
        "drifting light, ambient particles, soft atmospheric haze, gentle background motion",
      secondaryMotion:
        "hair, clothing, leaves, reflections, fabric — subtle natural sway only",
      subjectMotion:
        confidence === "low"
          ? "no subject animation — camera movement only"
          : "natural breathing, slow blink, micro head movement — never reshape the subject",
      notes:
        "Animate the attached image — do not replace, restyle, or reimagine it. Preserve identity, faces, products, composition, branding, and colors. Motion must feel like a professional motion designer animated the still.",
    };

    const imageAnchorBlock = sourceImageUrl
      ? `\n\nIMAGE-ANCHORED GENERATION (CRITICAL):\n- A SOURCE IMAGE is attached to the video job and MUST be used as the literal first frame and visual anchor of the generated video.\n- DO NOT replace, restyle, or reimagine the image. Animate what is already in it.\n- Preserve identity: faces, people, products, objects, composition, environment, branding, colors, lighting direction.\n- Apply motion using this hierarchy (start conservative, escalate only if needed):\n  1) Camera motion — ${motionStrategy.cameraMotion}\n  2) Environmental motion — ${motionStrategy.environmentalMotion}\n  3) Secondary motion — ${motionStrategy.secondaryMotion}\n  4) Subject motion — ${motionStrategy.subjectMotion}\n- Confidence: ${motionStrategy.confidence}. Target image-preservation score ≥ ${motionStrategy.preservationTargetPct}/100.\n- Every prompt must describe motion that is plausible inside the source image's existing scene.\n- ${motionStrategy.notes}`
      : "";

    const anchoredMaster = sourceImageUrl
      ? `${masterPrompt}${imageAnchorBlock}`
      : masterPrompt;

    // Inject the image-anchor block into every per-scene/per-prompt prompt so
    // the model running fal sees it regardless of which prompt the user fires.
    const anchoredVeoPrompts = veoPrompts && sourceImageUrl
      ? {
          ...veoPrompts,
          masterPrompt: anchoredMaster,
          hookPrompt: {
            ...veoPrompts.hookPrompt,
            prompt: `${veoPrompts.hookPrompt.prompt}${imageAnchorBlock}`,
          },
          scenePrompts: veoPrompts.scenePrompts.map((p) => ({
            ...p,
            prompt: `${p.prompt}${imageAnchorBlock}`,
          })),
          ctaPrompt: {
            ...veoPrompts.ctaPrompt,
            prompt: `${veoPrompts.ctaPrompt.prompt}${imageAnchorBlock}`,
          },
        }
      : veoPrompts;

    const doc: ReelDoc = {
      ...parsed,
      veoPrompt: anchoredMaster,
      veoPrompts: anchoredVeoPrompts ?? undefined,
      visualDirection: { ...visualDirection, approved: true },
      sourceImageUrl,
      motionStrategy,
    };

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
  reel: z.any(),
});

export const saveReel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: saved, error } = await context.supabase
      .from("projects")
      .update({
        project_data: data.reel as any,
        title: String(data.reel?.title ?? "").slice(0, 200) || undefined,
      })
      .eq("id", data.projectId)
      .eq("user_id", context.userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { project: saved };
  });

/* ---------- Regenerate VEO master prompt (used by "Rewrite") ---------- */

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

    const doc = project.project_data as unknown as ReelDoc;
    const direction = doc.visualDirection;
    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-2.5-flash");

    const { text } = await generateText({
      model,
      prompt: `Rewrite this Google VEO 3 video master prompt. MUST stay inside the approved visual direction. Return ONLY the prompt text, no fences.

Approved visual direction: ${JSON.stringify(direction ?? {})}

Current prompt:
${doc.veoPrompt ?? ""}

Script hook visual: ${doc.hook.visualNote}
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
