import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extractJson } from "@/lib/json-extract";
import { PLATFORM_VOICE_PROFILES, type SocialPlatform } from "@/lib/platform-voice";
import { GOAL_COPY_INSTRUCTIONS, GOAL_LABEL, type PostGoal } from "@/lib/post-goals";

const PlatformEnum = z.enum([
  "instagram",
  "linkedin",
  "youtube",
  "facebook",
  "x",
  "threads",
  "pinterest",
  "reddit",
  "bluesky",
]);

const Input = z.object({
  platforms: z.array(PlatformEnum).min(1).max(9),
  goal: z.string().min(1),
  niche: z.string().min(1).max(120).optional(),
  tone: z.string().max(200).optional(),
  angleHook: z.string().max(500).optional(),
  angleConcept: z.string().max(2000),
  baseCaption: z.string().max(4000).optional(),
});

export interface PlatformCopyResult {
  platform: SocialPlatform;
  hook: string;
  caption: string;
  description: string;
  hashtags: string[];
  cta: string;
  characterCount: number;
  platformFitNotes: string;
}

async function generatePack(data:z.infer<typeof Input>) {
  const {nativeCaptionPack}=await import("./copy-engine.server");
  const ctx={source:{exactHook:data.angleHook??"",caption:data.baseCaption??"",captionDNA:{},blueprint:null},voice:{niche:data.niche,tone:data.tone},research:null};
  const r=await nativeCaptionPack(ctx,data.platforms,`${data.angleConcept} Goal: ${data.goal}`);
  return r.platforms.map(p=>({...p,platform:p.platform as SocialPlatform,characterCount:p.caption.length}));
}

export const generatePlatformCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    return {platforms:await generatePack(data)};
  });

const SingleInput = Input.omit({ platforms: true }).extend({ platform: PlatformEnum });

export const regeneratePlatformCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SingleInput.parse(d))
  .handler(async ({ data }) => {
    const {platform,...rest}=data;
    return (await generatePack({...rest,platforms:[platform]}))[0];
  });