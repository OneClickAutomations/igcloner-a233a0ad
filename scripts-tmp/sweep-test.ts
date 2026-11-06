import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
const U = "50e6cc7d-4b16-4d80-bebc-f1b738d5648f", A = crypto.randomUUID(), ID = crypto.randomUUID();
const bal = async () => (await db.rpc("credit_balance" as any, { p_user_id: U } as any)).data;
const before = await bal();
console.log("debit", (await db.rpc("debit_credits" as any, { p_user_id: U, p_amount: 3, p_reason: "debit_analysis", p_entity_type: "analysis", p_entity_id: A, p_attempt_id: A } as any)).data);
await db.from("analyses").insert({ id: ID, user_id: U, instagram_url: "https://www.instagram.com/p/SWEEPTEST/", analysis_status: "processing", analysis_stage: "reading_slides", last_progress_at: new Date(Date.now() - 20 * 60000).toISOString(), pending_attempt_id: A, pending_charge_amount: 3 } as any);
// A fresh (non-stale) job must NOT be swept.
const FRESH = crypto.randomUUID();
await db.from("analyses").insert({ id: FRESH, user_id: U, instagram_url: "https://www.instagram.com/p/FRESHTEST/", analysis_status: "processing", last_progress_at: new Date().toISOString() } as any);
console.log("sweep1", (await db.rpc("sweep_stale_analyses" as any, { p_user_id: U } as any)).data);
console.log("sweep2", (await db.rpc("sweep_stale_analyses" as any, { p_user_id: U } as any)).data);
console.log("ledger", (await db.from("credit_ledger").select("delta,reason").eq("attempt_id", A)).data);
console.log("row", (await db.from("analyses").select("analysis_status,pending_attempt_id,error_message").eq("id", ID).single()).data);
console.log("fresh", (await db.from("analyses").select("analysis_status").eq("id", FRESH).single()).data);
// Race guard: late finish after sweep must not flip to ready.
const { data: late } = await db.from("analyses").update({ analysis_status: "ready" } as any).eq("id", ID).eq("analysis_status", "processing").select("id");
console.log("late finish matched rows:", late?.length);
console.log("balance before/after", before, await bal());
await db.from("analyses").delete().in("id", [ID, FRESH]);
