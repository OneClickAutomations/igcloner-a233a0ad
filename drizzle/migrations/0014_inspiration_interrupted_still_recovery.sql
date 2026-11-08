CREATE OR REPLACE FUNCTION public.sweep_inspiration_stills(p_user uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE a record; n integer:=0; BEGIN
 FOR a IN SELECT id FROM public.scene_attempts WHERE user_id=p_user AND operation='still' AND status IN ('claimed','in_progress') AND gateway_job_id IS NULL AND created_at<now()-interval '15 minutes' FOR UPDATE SKIP LOCKED LOOP
 PERFORM public.fail_inspiration_attempt(a.id,'Still generation was interrupted before saving. Credits refunded; start a fresh request.'); n:=n+1;
 END LOOP; RETURN n; END $$;
REVOKE ALL ON FUNCTION public.sweep_inspiration_stills(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_inspiration_stills(uuid) TO service_role;