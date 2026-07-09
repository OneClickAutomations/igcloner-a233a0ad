import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

// ─────────────────────────────────────────────────────────────────────
// Content Intelligence Engine — Campaign Planner (Phase 2)
// A campaign = goal + audience + platforms + content mix + optional
// research grounding, expanded into N days of rich content items
// stored in calendar_items (keeps back-compat with the calendar view).
// ─────────────────────────────────────────────────────────────────────

function parseJsonish<T = any>(text: string): T {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.search(/[\{\[]/);
  if (start === -1) throw new Error("AI returned no JSON");
  const openChar = cleaned[start];
  const closeChar = openChar === "[" ? "]" : "}";
  const end = cleaned.lastIndexOf(closeChar);
  const candidate = end > start ? cleaned.slice(start, end + 1) : cleaned.slice(start);
  try {
    return JSON.parse(candidate);
  } catch {
    return JSON.parse(candidate.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]"));
  }
}

const ContentMix = z.object({
  reels: z.number().min(0).max(100).default(50),
  carousels: z.number().min(0).max(100).default(30),
  posts: z.number().min(0).max(100).default(15),
  stories: z.number().min(0).max(100).default(5),
});

const CreateCampaignInput = z.object({
  name: z.string().min(2).max(120),
  goal: z.string().min(2).max(400),
  business_type: z.string().min(1).max(120),
  audience: z.string().min(2).max(400),
  platforms: z.array(z.string()).min(1).max(8),
  content_mix: ContentMix,
  research_report_id: z.string().uuid().optional().nullable(),
  duration_days: z.number().int().min(7).max(60).default(30),
  start_date: z.string().optional(),
});

export const createCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateCampaignInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Pull the research DNA if the wizard linked one
    let dnaContext = "";
    let researchSubject = "";
    if (data.research_report_id) {
      const { data: report } = await supabase
        .from("research_reports")
        .select("subject, dna_report, mode")
        .eq("id", data.research_report_id)
        .single();
      if (report?.dna_report) {
        researchSubject = `${report.mode}: ${report.subject}`;
        dnaContext = `\nGround every choice in this Content DNA (verbatim insights, hooks, pillars, tone):\n${JSON.stringify(report.dna_report).slice(0, 18000)}`;
      }
    }

    // Create campaign row up front so we can attach items to it
    const startIso = (data.start_date ? new Date(data.start_date) : new Date()).toISOString().slice(0, 10);
    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .insert({
        user_id: userId,
        name: data.name,
        goal: data.goal,
        business_type: data.business_type,
        audience: data.audience,
        platforms: data.platforms,
        content_mix: data.content_mix,
        research_report_id: data.research_report_id ?? null,
        start_date: startIso,
        duration_days: data.duration_days,
        status: "active",
      })
      .select("*")
      .single();
    if (cErr || !campaign) throw new Error(cErr?.message ?? "Failed to create campaign");

    // Generate the plan
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-2.5-flash");

    const system = `You are a senior social media strategist. Produce a rigorous, non-repetitive multi-platform content campaign. Return ONLY a JSON array, no prose, no markdown fences.`;
    const shape = `[{
  "dayOffset": 0-based integer,
  "title": "punchy internal working title",
  "postType": "Reel|Carousel|Post|Story",
  "platforms": [string],
  "hook": "one-line scroll-stopper",
  "caption": "2-4 sentence caption preview",
  "visualIdea": "one-line visual direction",
  "objective": "why this post exists (awareness|engagement|save|dm|click|sale)",
  "audience": "who exactly this speaks to",
  "cta": "call to action",
  "hashtags": [string, max 10],
  "priority": "low|normal|high",
  "aiNotes": "one-line director's note",
  "confidence": 0-100
}]`;

    const mix = data.content_mix;
    const prompt = `Build a ${data.duration_days}-day content campaign.

Campaign name: ${data.name}
Goal: ${data.goal}
Business type: ${data.business_type}
Target audience: ${data.audience}
Platforms: ${data.platforms.join(", ")}
Content mix targets: Reels ${mix.reels}%, Carousels ${mix.carousels}%, Posts ${mix.posts}%, Stories ${mix.stories}%
${researchSubject ? `Research subject: ${researchSubject}` : ""}
${dnaContext}

Rules:
- Return exactly ${data.duration_days} items, dayOffset 0..${data.duration_days - 1}, no duplicates.
- Respect the content mix distribution.
- Vary hook patterns (question, contrarian, story, listicle, stat, POV, myth-bust).
- Each item's platforms must be a subset of the campaign platforms.
- Cluster themes into weekly arcs but never repeat identical hooks.
- Hashtags: relevant, no banned/blocked tags.
- If a Content DNA is provided, mirror its pillars, tone, and CTA style.

Return JSON matching:
${shape}`;

    const { text } = await generateText({ model, system, prompt });
    const items = parseJsonish<any[]>(text);
    if (!Array.isArray(items) || items.length === 0) throw new Error("AI returned no campaign items");

    const start = new Date(startIso + "T00:00:00");
    const rows = items.slice(0, data.duration_days).map((it: any) => {
      const offset = Number.isFinite(it.dayOffset) ? Number(it.dayOffset) : 0;
      const d = new Date(start);
      d.setDate(d.getDate() + offset);
      return {
        user_id: userId,
        campaign_id: campaign.id,
        research_report_id: data.research_report_id ?? null,
        niche: data.business_type,
        scheduled_for: d.toISOString().slice(0, 10),
        post_type: it.postType ?? "Post",
        title: String(it.title ?? "").slice(0, 200) || null,
        hook: it.hook ?? null,
        caption: it.caption ?? null,
        visual_idea: it.visualIdea ?? null,
        objective: it.objective ?? null,
        audience: it.audience ?? null,
        cta: it.cta ?? null,
        platforms: Array.isArray(it.platforms) ? it.platforms.slice(0, 8) : data.platforms,
        priority: ["low", "normal", "high"].includes(it.priority) ? it.priority : "normal",
        ai_notes: it.aiNotes ?? null,
        confidence: Number(it.confidence) || 0,
        hashtags: Array.isArray(it.hashtags) ? it.hashtags.slice(0, 20) : [],
        status: "planned",
      };
    });

    const { error: iErr } = await supabase.from("calendar_items").insert(rows);
    if (iErr) {
      await supabase.from("campaigns").delete().eq("id", campaign.id);
      throw new Error(iErr.message);
    }

    return { campaign_id: campaign.id, count: rows.length };
  });

export const listCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: campaigns, error } = await context.supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // counts per campaign
    const ids = (campaigns ?? []).map((c: any) => c.id);
    let counts: Record<string, { total: number; posted: number; scheduled: number }> = {};
    if (ids.length) {
      const { data: items } = await context.supabase
        .from("calendar_items")
        .select("campaign_id,status")
        .in("campaign_id", ids);
      for (const it of items ?? []) {
        const k = (it as any).campaign_id as string;
        if (!k) continue;
        counts[k] ||= { total: 0, posted: 0, scheduled: 0 };
        counts[k].total++;
        if ((it as any).status === "posted") counts[k].posted++;
        if ((it as any).status === "scheduled") counts[k].scheduled++;
      }
    }
    return { campaigns: campaigns ?? [], counts };
  });

const IdInput = z.object({ id: z.string().uuid() });

export const getCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: campaign, error } = await context.supabase
      .from("campaigns")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const { data: items } = await context.supabase
      .from("calendar_items")
      .select("*")
      .eq("campaign_id", data.id)
      .order("scheduled_for", { ascending: true });
    return { campaign, items: items ?? [] };
  });

export const deleteCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("campaigns").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// AI Content Director — rewrite a single item along a stylistic axis
const DirectInput = z.object({
  item_id: z.string().uuid(),
  variant: z.enum([
    "rewrite",
    "more_viral",
    "more_professional",
    "more_emotional",
    "more_educational",
    "luxury",
    "shorter",
    "longer",
  ]),
});

export const directContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DirectInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: item, error } = await supabase
      .from("calendar_items")
      .select("*")
      .eq("id", data.item_id)
      .single();
    if (error || !item) throw new Error("Item not found");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-2.5-flash");

    const axis: Record<string, string> = {
      rewrite: "Rewrite fresh while keeping the core message.",
      more_viral: "Sharper hook, curiosity gap, punchier pacing.",
      more_professional: "Authoritative, credibility-forward, precise.",
      more_emotional: "Vulnerable, human, story-driven language.",
      more_educational: "Teach clearly, add specifics, add mini-framework.",
      luxury: "Aspirational, restrained, premium vocabulary.",
      shorter: "Tighten by ~40% without losing intent.",
      longer: "Expand with an example and a stronger CTA.",
    };

    const prompt = `Rewrite this content item along the axis: "${axis[data.variant]}"
Return ONLY JSON: { "title": string, "hook": string, "caption": string, "cta": string, "hashtags": [string], "aiNotes": string }

Current:
${JSON.stringify({
  title: item.title, hook: item.hook, caption: item.caption,
  cta: item.cta, hashtags: item.hashtags, platforms: item.platforms,
  audience: item.audience, objective: item.objective,
}, null, 2)}`;

    const { text } = await generateText({ model, prompt });
    const patch = parseJsonish<any>(text);
    const update = {
      title: patch.title ?? item.title,
      hook: patch.hook ?? item.hook,
      caption: patch.caption ?? item.caption,
      cta: patch.cta ?? item.cta,
      hashtags: Array.isArray(patch.hashtags) ? patch.hashtags.slice(0, 20) : item.hashtags,
      ai_notes: patch.aiNotes ?? item.ai_notes,
    };
    await supabase.from("calendar_items").update(update).eq("id", data.item_id);
    return { item: { ...item, ...update } };
  });