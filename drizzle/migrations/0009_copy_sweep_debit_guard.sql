CREATE OR REPLACE FUNCTION public.sweep_stale_copy_runs() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.copy_runs; n integer:=0; charged integer; BEGIN
 FOR r IN SELECT * FROM public.copy_runs WHERE status='processing' AND updated_at < now()-interval '15 minutes' FOR UPDATE SKIP LOCKED LOOP
 UPDATE public.copy_runs SET status='failed',error_message='Writing interrupted; any charged credits refunded.',updated_at=now() WHERE id=r.id;
 SELECT COALESCE(-sum(delta),0)::integer INTO charged FROM public.credit_ledger WHERE user_id=r.user_id AND related_entity_type='copy_run' AND related_entity_id=r.id AND attempt_id=r.attempt_id AND delta<0;
 IF charged>0 THEN PERFORM public.refund_credits(r.user_id,charged,'copy_run',r.id,r.attempt_id); END IF; n:=n+1;
 END LOOP; RETURN n; END $$;
REVOKE ALL ON FUNCTION public.sweep_stale_copy_runs() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_stale_copy_runs() TO service_role;