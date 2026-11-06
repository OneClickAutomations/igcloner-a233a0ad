-- Attempt-scoped credit refunds: every charge carries a fresh attempt id so
-- multiple failed attempts on the same report/analysis can each be refunded
-- exactly once. Also adds the source-media storage policies.

ALTER TABLE public.credit_ledger ADD COLUMN IF NOT EXISTS attempt_id uuid;

ALTER TABLE public.credit_ledger DROP CONSTRAINT credit_ledger_reason_check;
ALTER TABLE public.credit_ledger ADD CONSTRAINT credit_ledger_reason_check
  CHECK (reason IN ('plan_grant','topup','debit_report','debit_ideas','debit_premium','debit_retry','debit_analysis','refund_failed','trial_grant'));

ALTER TABLE public.research_reports ADD COLUMN IF NOT EXISTS pending_attempt_id uuid;
ALTER TABLE public.research_reports ADD COLUMN IF NOT EXISTS pending_charge_amount integer;

-- debit_credits: same atomic body, now recording the attempt id on the rows.
DROP FUNCTION public.debit_credits(uuid, integer, text, text, uuid);
CREATE FUNCTION public.debit_credits(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_attempt_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_plan integer;
  v_purchased integer;
  v_total integer;
  v_plan_part integer;
  v_purchased_part integer;
BEGIN
  IF p_amount < 0 THEN
    RAISE EXCEPTION 'debit amount must be >= 0';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  v_plan := public.credit_balance(p_user_id, 'plan');
  v_purchased := public.credit_balance(p_user_id, 'purchased');
  v_total := v_plan + v_purchased;

  IF p_amount = 0 THEN
    RETURN jsonb_build_object('ok', true, 'balance', v_total, 'required', 0);
  END IF;

  IF v_total < p_amount THEN
    RETURN jsonb_build_object('ok', false, 'balance', v_total, 'required', p_amount);
  END IF;

  -- Spend expiring plan credits before purchased credits.
  v_plan_part := LEAST(p_amount, v_plan);
  v_purchased_part := p_amount - v_plan_part;

  IF v_plan_part > 0 THEN
    INSERT INTO public.credit_ledger (user_id, delta, reason, related_entity_type, related_entity_id, credit_kind, attempt_id)
    VALUES (p_user_id, -v_plan_part, p_reason, p_entity_type, p_entity_id, 'plan', p_attempt_id);
  END IF;
  IF v_purchased_part > 0 THEN
    INSERT INTO public.credit_ledger (user_id, delta, reason, related_entity_type, related_entity_id, credit_kind, attempt_id)
    VALUES (p_user_id, -v_purchased_part, p_reason, p_entity_type, p_entity_id, 'purchased', p_attempt_id);
  END IF;

  RETURN jsonb_build_object('ok', true, 'balance', v_total - p_amount, 'required', p_amount);
END;
$$;

-- refund_credits: idempotent per (entity, attempt). A second refund for the
-- same attempt is rejected; a different attempt on the same entity is not.
DROP FUNCTION public.refund_credits(uuid, integer, text, uuid);
CREATE FUNCTION public.refund_credits(
  p_user_id uuid,
  p_amount integer,
  p_entity_type text,
  p_entity_id uuid,
  p_attempt_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_balance integer;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'refund amount must be > 0';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  IF EXISTS (
    SELECT 1 FROM public.credit_ledger
    WHERE user_id = p_user_id
      AND reason = 'refund_failed'
      AND related_entity_type = p_entity_type
      AND related_entity_id = p_entity_id
      AND attempt_id IS NOT DISTINCT FROM p_attempt_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'already_refunded', true, 'balance', public.credit_balance(p_user_id));
  END IF;

  INSERT INTO public.credit_ledger (user_id, delta, reason, related_entity_type, related_entity_id, credit_kind, attempt_id)
  VALUES (p_user_id, p_amount, 'refund_failed', p_entity_type, p_entity_id, 'purchased', p_attempt_id);

  v_balance := public.credit_balance(p_user_id);
  RETURN jsonb_build_object('ok', true, 'already_refunded', false, 'balance', v_balance);
END;
$$;

REVOKE ALL ON FUNCTION public.debit_credits(uuid, integer, text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_credits(uuid, integer, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.debit_credits(uuid, integer, text, text, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_credits(uuid, integer, text, uuid, uuid) TO service_role;

-- Sweep: refund exactly the pending attempt recorded on the stale run, then
-- clear the pending markers so a later sweep cannot refund it again.
CREATE OR REPLACE FUNCTION public.sweep_stale_research_reports(p_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record; v_count integer := 0; v_refunded integer := 0; v_res jsonb;
BEGIN
  FOR r IN
    UPDATE public.research_reports
       SET status = 'failed',
           error_message = CASE WHEN status = 'scraping'
             THEN 'This run stopped responding while collecting posts and was cancelled. Your credits were refunded.'
             ELSE 'This run stopped responding during analysis and was cancelled. Your credits were refunded — if posts were collected, you can retry the analysis.' END,
           last_progress_at = now()
      WHERE (p_user_id IS NULL OR user_id = p_user_id)
       AND ((status = 'scraping' AND last_progress_at < now() - interval '10 minutes')
         OR (status = 'analyzing' AND last_progress_at < now() - interval '15 minutes'))
    RETURNING id, user_id, pending_attempt_id, pending_charge_amount
  LOOP
    v_count := v_count + 1;
    IF r.pending_attempt_id IS NOT NULL AND COALESCE(r.pending_charge_amount, 0) > 0 THEN
      v_res := public.refund_credits(r.user_id, r.pending_charge_amount, 'research_report', r.id, r.pending_attempt_id);
      IF (v_res->>'ok')::boolean THEN v_refunded := v_refunded + 1; END IF;
    END IF;
    UPDATE public.research_reports
       SET pending_attempt_id = NULL, pending_charge_amount = NULL
     WHERE id = r.id;
  END LOOP;
  RETURN jsonb_build_object('swept', v_count, 'refunded', v_refunded);
END; $$;

-- source-media bucket: users read only their own folder ({userId}/...).
-- Writes happen server-side via the service role, which bypasses RLS.
CREATE POLICY "Users read own source media"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'source-media' AND (storage.foldername(name))[1] = auth.uid()::text);