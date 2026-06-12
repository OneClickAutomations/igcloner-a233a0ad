import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FORMATS = ["reel", "carousel", "caption", "voiceover", "image"] as const;
export type ProjectFormat = (typeof FORMATS)[number];

const CreateInput = z.object({
  analysisId: z.string().uuid().optional().nullable(),
  format: z.enum(FORMATS),
  title: z.string().min(1).max(200).optional(),
  cloneMode: z.enum(["exact", "inspired"]).optional(),
});

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Pull source analysis to seed the project (DNA, source post, prefs).
    let analysis: any = null;
    if (data.analysisId) {
      const { data: row, error } = await supabase
        .from("analyses")
        .select("*")
        .eq("id", data.analysisId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      analysis = row;
    }

    const scraped = analysis?.scraped_data as any;
    const ownerHandle =
      scraped?.owner?.username ?? scraped?.ownerUsername ?? null;
    const thumbnail =
      scraped?.displayUrl ?? scraped?.thumbnailUrl ?? scraped?.imageUrl ?? null;

    const defaultTitle =
      data.title ??
      `${formatLabel(data.format)}${ownerHandle ? ` — @${ownerHandle}` : ""}`;

    const userPrefs = {
      ...(analysis?.user_preferences ?? {}),
      cloneMode: data.cloneMode ?? "exact",
    };

    const insert = {
      user_id: userId,
      analysis_id: data.analysisId ?? null,
      title: defaultTitle,
      format: data.format,
      status: "draft" as const,
      source_url: analysis?.instagram_url ?? null,
      source_thumbnail: thumbnail,
      source_account: ownerHandle,
      dna_analysis: analysis?.dna_analysis ?? null,
      user_preferences: userPrefs,
      project_data: null,
    };

    const { data: created, error } = await supabase
      .from("projects")
      .insert(insert)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { project: created };
  });

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { projects: data ?? [] };
  });

const IdInput = z.object({ id: z.string().uuid() });

export const getProject = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("projects")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Project not found");
    return { project: row };
  });

const UpdateInput = z.object({
  id: z.string().uuid(),
  patch: z.object({
    title: z.string().min(1).max(200).optional(),
    status: z.enum(["draft", "in_progress", "complete", "exported"]).optional(),
    project_data: z.any().optional(),
    user_preferences: z.any().optional(),
    exports: z.any().optional(),
  }),
});

export const updateProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("projects")
      .update(data.patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { project: row };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("projects")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export function formatLabel(f: ProjectFormat): string {
  switch (f) {
    case "reel":
      return "Reel";
    case "carousel":
      return "Carousel";
    case "voiceover":
      return "Voiceover";
    case "caption":
      return "Caption";
    case "image":
      return "Image";
  }
}