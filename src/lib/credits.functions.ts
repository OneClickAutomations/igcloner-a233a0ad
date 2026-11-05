import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { REASON_LABELS, type LedgerReason } from "@/lib/credits";

// ── Credit balance & history (read paths; writes happen only inside the
// research server functions via the atomic RPCs) ──────────────────────

export const getCreditBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [total, plan, purchased] = await Promise.all([
      supabaseAdmin.rpc("credit_balance", { p_user_id: context.userId }),
      supabaseAdmin.rpc("credit_balance", { p_user_id: context.userId, p_kind: "plan" }),
      supabaseAdmin.rpc("credit_balance", { p_user_id: context.userId, p_kind: "purchased" }),
    ]);
    return {
      balance: Number(total.data ?? 0),
      planBalance: Number(plan.data ?? 0),
      purchasedBalance: Number(purchased.data ?? 0),
    };
  });

export const getCreditHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("credit_ledger")
      .select("id, delta, reason, related_entity_type, related_entity_id, credit_kind, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    // Resolve report subjects so history reads "Research report — @handle".
    const reportIds = [...new Set(
      (rows ?? [])
        .filter((r) => r.related_entity_type === "research_report" && r.related_entity_id)
        .map((r) => r.related_entity_id as string),
    )];
    const subjects = new Map<string, string>();
    if (reportIds.length) {
      const { data: reports } = await context.supabase
        .from("research_reports")
        .select("id, subject")
        .in("id", reportIds);
      for (const r of reports ?? []) subjects.set(r.id, r.subject);
    }

    return {
      entries: (rows ?? []).map((r) => ({
        id: r.id,
        delta: r.delta,
        label: REASON_LABELS[r.reason as LedgerReason] ?? r.reason,
        creditKind: r.credit_kind,
        createdAt: r.created_at,
        subject:
          r.related_entity_type === "research_report" && r.related_entity_id
            ? (subjects.get(r.related_entity_id) ?? null)
            : null,
      })),
    };
  });
