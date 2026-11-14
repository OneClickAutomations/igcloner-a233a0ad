ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding jsonb, ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

CREATE OR REPLACE FUNCTION public.ensure_plan_trial(p_user uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('plan_trial:' || p_user::text));
  IF EXISTS (SELECT 1 FROM public.credit_ledger WHERE user_id = p_user AND reason = 'trial_grant' AND credit_kind = 'plan') THEN
    RETURN false;
  END IF;
  INSERT INTO public.credit_ledger (user_id, delta, reason, credit_kind) VALUES (p_user, 40, 'trial_grant', 'plan');
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.ensure_plan_trial(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_plan_trial(uuid) TO service_role;

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP PERFORM public.ensure_plan_trial(r.id); END LOOP;
END $$;