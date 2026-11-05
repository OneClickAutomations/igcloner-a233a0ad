// Server-only credit ledger helpers. The ledger RPCs are executable by
// service_role only, so these go through supabaseAdmin. Call them only from
// handlers that have already authenticated and authorized the caller.
import { ACTION_COSTS, InsufficientCreditsError, type LedgerReason } from "@/lib/credits";

export interface DebitResult {
  ok: boolean;
  balance: number;
  required: number;
}

/**
 * Atomically debit credits for a user. The Postgres function takes an
 * advisory lock on the user, recomputes the balance inside the transaction,
 * spends expiring plan credits before purchased credits, and inserts the
 * debit row(s) only if the balance covers the amount.
 * Throws InsufficientCreditsError when the balance is too low.
 * amount = 0 (cache hit) is a no-op that succeeds without writing a row.
 */
export async function debitCredits(
  userId: string,
  amount: number,
  reason: LedgerReason,
  entityType?: string,
  entityId?: string,
): Promise<DebitResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("debit_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
      p_entity_type: entityType ?? undefined,
      p_entity_id: entityId ?? undefined,
  });
  if (error) throw new Error(`Credit debit failed: ${error.message}`);
  const result = data as unknown as DebitResult;
  if (!result?.ok) {
    throw new InsufficientCreditsError({ required: amount, available: result?.balance ?? 0 });
  }
  return result;
}

/**
 * Refund a failed action. Idempotent: a second refund for the same entity is
 * rejected by the database function, so retry storms cannot mint credits.
 */
export async function refundCredits(
  userId: string,
  amount: number,
  entityType: string,
  entityId: string,
): Promise<void> {
  if (amount <= 0) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.rpc("refund_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_entity_type: entityType,
    p_entity_id: entityId,
  });
  if (error) console.error("[credits] refund failed", { userId, entityType, entityId, error: error.message });
}

export { ACTION_COSTS };
