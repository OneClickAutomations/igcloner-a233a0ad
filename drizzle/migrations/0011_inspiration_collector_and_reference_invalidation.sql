CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE TABLE public.inspiration_collector_control (id boolean PRIMARY KEY DEFAULT true CHECK(id), token_hash text, lease_until timestamptz);
GRANT ALL ON public.inspiration_collector_control TO service_role;
ALTER TABLE public.inspiration_collector_control ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.arm_inspiration_collector() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$ DECLARE token text; command text; BEGIN
 IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='inspiration-clip-collector') THEN RETURN; END IF;
 token:=encode(gen_random_bytes(32),'hex');
 INSERT INTO public.inspiration_collector_control(id,token_hash) VALUES(true,encode(digest(token,'sha256'),'hex')) ON CONFLICT(id) DO UPDATE SET token_hash=excluded.token_hash;
 command:=format('select net.http_post(url:=%L,headers:=jsonb_build_object(''Content-Type'',''application/json'',''Authorization'',%L),body:=''{}''::jsonb) WHERE EXISTS(SELECT 1 FROM public.scene_attempts WHERE status IN (''queued'',''in_progress'',''collecting'') AND gateway_job_id IS NOT NULL)', 'https://project--7f1656ba-5a1d-4863-84f5-59ed5adf1849.lovable.app/api/public/inspiration-collect','Bearer '||token);
 PERFORM cron.schedule('inspiration-clip-collector','0 * * * *',command);
 END $$;
REVOKE ALL ON FUNCTION public.arm_inspiration_collector() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.arm_inspiration_collector() TO service_role;
CREATE OR REPLACE FUNCTION public.claim_inspiration_collector(p_token text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$ DECLARE won boolean; BEGIN
 UPDATE public.inspiration_collector_control SET lease_until=now()+interval '4 minutes' WHERE id AND token_hash=encode(digest(p_token,'sha256'),'hex') AND (lease_until IS NULL OR lease_until<now()) RETURNING true INTO won; RETURN COALESCE(won,false); END $$;
REVOKE ALL ON FUNCTION public.claim_inspiration_collector(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_inspiration_collector(text) TO service_role;
CREATE OR REPLACE FUNCTION public.finish_inspiration_collector() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE jid bigint; a record; BEGIN
 UPDATE public.inspiration_collector_control SET lease_until=NULL WHERE id;
 FOR a IN SELECT id FROM public.scene_attempts WHERE status IN ('claimed','submitting','in_progress') AND gateway_job_id IS NULL AND created_at<now()-interval '15 minutes' LOOP PERFORM public.fail_inspiration_attempt(a.id,'Interrupted before a recoverable result was saved. Credits refunded. No paid retry was started.'); END LOOP;
 IF NOT EXISTS(SELECT 1 FROM public.scene_attempts WHERE status IN ('queued','in_progress','collecting') AND gateway_job_id IS NOT NULL) THEN SELECT jobid INTO jid FROM cron.job WHERE jobname='inspiration-clip-collector'; IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF; END IF; END $$;
REVOKE ALL ON FUNCTION public.finish_inspiration_collector() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_inspiration_collector() TO service_role;
CREATE OR REPLACE FUNCTION public.invalidate_reference_scenes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE uid uuid; BEGIN
 uid:=COALESCE(NEW.user_id,OLD.user_id);
 IF EXISTS(SELECT 1 FROM public.scene_attempts WHERE user_id=uid AND status IN ('claimed','submitting','queued','in_progress','collecting')) THEN RAISE EXCEPTION 'Wait until generation finishes before changing references'; END IF;
 UPDATE public.storyboard_scenes SET revision=revision+1,approved_at=NULL,approved_revision=NULL,object_checks='[]',status=CASE WHEN still_path IS NULL THEN 'draft' ELSE 'still_ready' END WHERE user_id=uid;
 RETURN COALESCE(NEW,OLD); END $$;
CREATE TRIGGER inspiration_reference_revision AFTER INSERT OR UPDATE OR DELETE ON public.reference_assets FOR EACH ROW EXECUTE FUNCTION public.invalidate_reference_scenes();