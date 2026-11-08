CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Users may no longer change their own role, plan or limits.
REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (full_name, avatar_url, default_niche, workspace_name, timezone, country, language, last_login_at, updated_at) ON public.profiles TO authenticated;

ALTER TABLE public.video_credit_ledger DROP CONSTRAINT IF EXISTS video_credit_ledger_reason_check;
ALTER TABLE public.video_credit_ledger ADD CONSTRAINT video_credit_ledger_reason_check CHECK (reason = ANY (ARRAY['pack_grant','debit','refund_failed','trial_grant','admin_grant']));

ALTER TABLE public.credit_ledger DROP CONSTRAINT IF EXISTS credit_ledger_reason_check;
ALTER TABLE public.credit_ledger ADD CONSTRAINT credit_ledger_reason_check CHECK (reason = ANY (ARRAY['plan_grant','topup','debit_report','debit_ideas','debit_premium','debit_retry','debit_analysis','debit_versions','debit_image','debit_hooks','debit_caption','debit_sharpen','refund_failed','trial_grant','debit_storyboard']));

-- Idempotent keyed grant: the same key can only ever credit an account once.
CREATE OR REPLACE FUNCTION public.grant_video_credits_keyed(p_user uuid, p_amount integer, p_reason text, p_key text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF p_amount <= 0 OR length(coalesce(p_key,'')) < 1 OR p_reason NOT IN ('trial_grant','admin_grant') THEN RAISE EXCEPTION 'Invalid video grant'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('video:'||p_user::text,0));
  INSERT INTO public.video_credit_ledger(user_id,delta,reason,idempotency_key) VALUES(p_user,p_amount,p_reason,p_key)
  ON CONFLICT(user_id,idempotency_key) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END $$;
REVOKE ALL ON FUNCTION public.grant_video_credits_keyed(uuid,integer,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_video_credits_keyed(uuid,integer,text,text) TO service_role;