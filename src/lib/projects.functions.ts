import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceRights } from "@/lib/clone-copy.functions";

const FORMATS = ["reel", "carousel", "caption", "voiceover", "image"] as const;
export type ProjectFormat = (typeof FORMATS)[number];

const CreateInput = z.object({
  analysisId: z.string().uuid().optional().nullable(),
  format: z.enum(FORMATS),
  title: z.string().min(1).max(200).optional(),
  // "formula" = same formula, different subject (legacy value "exact").
  cloneMode: z.enum(["formula", "exact", "inspired"]).optional(),
  userPreferences: z.record(z.any()).optional(),
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
        .eq("analysis_status", "ready")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) throw new Error("That analysis isn't finished yet — open it to let it complete first.");
      analysis = row;
    }

    const intent = String((data.userPreferences as any)?.intent ?? (data.userPreferences as any)?.cloneMethod ?? "");
    await enforceRights(supabase, userId, data.analysisId ?? null, intent);

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
      ...(data.userPreferences ?? {}),
      cloneMode: data.cloneMode === "inspired" ? "inspired" : "formula",
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
    const projects = data ?? [];
    const {data:jobs}=await context.supabase.from('publishing_jobs').select('project_id,status').eq('user_id',context.userId).order('created_at',{ascending:false});
    const publishedIds=new Set((jobs??[]).filter(j=>j.status==='published').map(j=>j.project_id));
    for(const p of projects)if(publishedIds.has(p.id))p.status='published';
    if (projects.length === 0) return { projects };

    // Attach the most recent generated asset per project so the Projects
    // grid shows the user's actual output, not just the source thumbnail.
    const ids = projects.map((p) => p.id);
    const { data: assets } = await context.supabase
      .from("project_assets")
      .select("project_id, filename, url, created_at, asset_type")
      .in("project_id", ids)
      .order("created_at", { ascending: false });

    const latestByProject = new Map<string, any>();
    for (const a of assets ?? []) {
      if (!latestByProject.has(a.project_id)) latestByProject.set(a.project_id, a);
    }

    const enriched = await Promise.all(
      projects.map(async (p) => {
        const a = latestByProject.get(p.id);
        if (!a) return { ...p, latest_asset_url: null };
        let url = a.url as string | null;
        if (a.filename) {
          const { data: signed } = await context.supabase.storage
            .from("project-assets")
            .createSignedUrl(a.filename, 60 * 60 * 24 * 7);
          if (signed?.signedUrl) url = signed.signedUrl;
        }
        return { ...p, latest_asset_url: url };
      }),
    );
    return { projects: enriched };
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