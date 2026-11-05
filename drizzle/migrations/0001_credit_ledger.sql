ALTER TYPE public.plan_type ADD VALUE IF NOT EXISTS 'agency';
ALTER TYPE public.plan_type ADD VALUE IF NOT EXISTS 'trial';

CREATE TABLE public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  delta integer NOT NULL CHECK (delta <> 0),
  reason text NOT NULL CHECK (reason IN ('plan_grant','topup','debit_report','debit_ideas','debit_premium','debit_retry','refund_failed','trial_grant')),
  related_entity_type text,
  related_entity_id uuid,
  credit_kind text NOT NULL CHECK (credit_kind IN ('plan','purchased')),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.credit_ledger TO authenticated;
GRANT ALL ON public.credit_ledger TO service_role;

ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own ledger"
  ON public.credit_ledger FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX credit_ledger_user_idx ON public.credit_ledger (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.credit_balance(p_user_id uuid, p_kind text DEFAULT NULL)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(SUM(delta), 0)::integer
  FROM public.credit_ledger
  WHERE user_id = p_user_id
    AND (p_kind IS NULL OR credit_kind = p_kind)
    AND (expires_at IS NULL OR expires_at > now());
$$;

CREATE OR REPLACE FUNCTION public.debit_credits(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL
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
    INSERT INTO public.credit_ledger (user_id, delta, reason, related_entity_type, related_entity_id, credit_kind)
    VALUES (p_user_id, -v_plan_part, p_reason, p_entity_type, p_entity_id, 'plan');
  END IF;
  IF v_purchased_part > 0 THEN
    INSERT INTO public.credit_ledger (user_id, delta, reason, related_entity_type, related_entity_id, credit_kind)
    VALUES (p_user_id, -v_purchased_part, p_reason, p_entity_type, p_entity_id, 'purchased');
  END IF;

  RETURN jsonb_build_object('ok', true, 'balance', v_total - p_amount, 'required', p_amount);
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_credits(
  p_user_id uuid,
  p_amount integer,
  p_entity_type text,
  p_entity_id uuid
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
  ) THEN
    RETURN jsonb_build_object('ok', false, 'already_refunded', true, 'balance', public.credit_balance(p_user_id));
  END IF;

  INSERT INTO public.credit_ledger (user_id, delta, reason, related_entity_type, related_entity_id, credit_kind)
  VALUES (p_user_id, p_amount, 'refund_failed', p_entity_type, p_entity_id, 'purchased');

  v_balance := public.credit_balance(p_user_id);
  RETURN jsonb_build_object('ok', true, 'already_refunded', false, 'balance', v_balance);
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_credits(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_kind text,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'grant amount must be > 0';
  END IF;
  IF p_reason NOT IN ('plan_grant','topup','trial_grant') THEN
    RAISE EXCEPTION 'invalid grant reason: %', p_reason;
  END IF;
  IF p_kind NOT IN ('plan','purchased') THEN
    RAISE EXCEPTION 'invalid credit kind: %', p_kind;
  END IF;

  INSERT INTO public.credit_ledger (user_id, delta, reason, credit_kind, expires_at)
  VALUES (p_user_id, p_amount, p_reason, p_kind, p_expires_at)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.credit_balance(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.debit_credits(uuid, integer, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_credits(uuid, integer, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_credits(uuid, integer, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_balance(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.debit_credits(uuid, integer, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_credits(uuid, integer, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_credits(uuid, integer, text, text, timestamptz) TO service_role;