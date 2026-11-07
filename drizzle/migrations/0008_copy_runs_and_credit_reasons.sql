CREATE TABLE public.copy_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, analysis_id uuid REFERENCES public.analyses(id), project_id uuid REFERENCES public.projects(id), action text NOT NULL, cache_key text NOT NULL, status text NOT NULL DEFAULT 'processing', attempt_id uuid NOT NULL DEFAULT gen_random_uuid(), output jsonb, usage jsonb, error_message text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id, cache_key)
);
GRANT SELECT ON public.copy_runs TO authenticated;
GRANT ALL ON public.copy_runs TO service_role;
ALTER TABLE public.copy_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own copy history" ON public.copy_runs FOR SELECT TO authenticated USING (auth.uid() = user_id);
ALTER TABLE public.credit_ledger DROP CONSTRAINT credit_ledger_reason_check;
ALTER TABLE public.credit_ledger ADD CONSTRAINT credit_ledger_reason_check CHECK (reason IN ('plan_grant','topup','debit_report','debit_ideas','debit_premium','debit_retry','debit_analysis','debit_versions','debit_image','debit_hooks','debit_caption','debit_sharpen','refund_failed','trial_grant'));
CREATE OR REPLACE FUNCTION public.claim_copy_run(p_user_id uuid, p_cache_key text, p_action text, p_analysis_id uuid DEFAULT NULL, p_project_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.copy_runs; BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || p_cache_key,0));
 SELECT * INTO r FROM public.copy_runs WHERE user_id=p_user_id AND cache_key=p_cache_key FOR UPDATE;
 IF FOUND AND r.status='ready' THEN RETURN jsonb_build_object('cached',true,'row',to_jsonb(r)); END IF;
 IF FOUND AND r.status='processing' THEN RETURN jsonb_build_object('busy',true,'row',to_jsonb(r)); END IF;
 IF FOUND THEN UPDATE public.copy_runs SET status='processing',attempt_id=gen_random_uuid(),error_message=NULL,updated_at=now() WHERE id=r.id RETURNING * INTO r;
 ELSE INSERT INTO public.copy_runs(user_id,cache_key,action,analysis_id,project_id) VALUES(p_user_id,p_cache_key,p_action,p_analysis_id,p_project_id) RETURNING * INTO r; END IF;
 RETURN jsonb_build_object('claimed',true,'row',to_jsonb(r)); END $$;
REVOKE ALL ON FUNCTION public.claim_copy_run(uuid,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_copy_run(uuid,text,text,uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.sweep_stale_copy_runs() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.copy_runs; n integer:=0; BEGIN
 FOR r IN SELECT * FROM public.copy_runs WHERE status='processing' AND updated_at < now()-interval '15 minutes' FOR UPDATE SKIP LOCKED LOOP
 UPDATE public.copy_runs SET status='failed',error_message='Writing interrupted; credits refunded.',updated_at=now() WHERE id=r.id;
 PERFORM public.refund_credits(r.user_id,CASE r.action WHEN 'hooks' THEN 2 WHEN 'sharpen' THEN 2 WHEN 'caption' THEN 1 ELSE 0 END,'copy_run',r.id::text,r.attempt_id::text); n:=n+1;
 END LOOP; RETURN n; END $$;
REVOKE ALL ON FUNCTION public.sweep_stale_copy_runs() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_stale_copy_runs() TO service_role;