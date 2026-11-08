CREATE OR REPLACE FUNCTION public.fail_claimed_assembly_job(p_job uuid,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j public.assembly_jobs; BEGIN
 SELECT * INTO j FROM public.assembly_jobs WHERE id=p_job FOR UPDATE;
 IF NOT FOUND OR j.status IS DISTINCT FROM 'claimed' THEN RETURN; END IF;
 PERFORM public.fail_assembly_job(p_job,p_reason);
END $$;
REVOKE ALL ON FUNCTION public.fail_claimed_assembly_job(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fail_claimed_assembly_job(uuid,text) TO service_role;