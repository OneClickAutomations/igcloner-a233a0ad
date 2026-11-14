import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getOnboardingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("profiles").select("onboarding_completed_at, full_name").eq("id", context.userId).maybeSingle();
    return { completed: Boolean(data?.onboarding_completed_at), name: data?.full_name ?? null };
  });

export const saveOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    niche: z.string().trim().max(80).optional(),
    goals: z.array(z.string().trim().max(40)).max(12).optional(),
    platforms: z.array(z.string().trim().max(30)).max(12).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("profiles").update({
      onboarding: data, default_niche: data.niche || null, onboarding_completed_at: new Date().toISOString(),
    }).eq("id", context.userId);
    if (error) throw new Error("Your answers could not be saved.");
    if (data.platforms?.[0]) await context.supabase.from("user_preferences").upsert({ user_id: context.userId, default_platform: data.platforms[0] });
    return { ok: true };
  });
