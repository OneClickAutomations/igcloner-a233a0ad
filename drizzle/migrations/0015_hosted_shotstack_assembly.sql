ALTER TABLE public.assembly_jobs ADD COLUMN provider text NOT NULL DEFAULT 'shotstack', ADD COLUMN provider_job_id text, ADD COLUMN environment text NOT NULL DEFAULT 'v1', ADD COLUMN input jsonb NOT NULL DEFAULT '{}', ADD COLUMN clip_snapshot jsonb NOT NULL DEFAULT '[]', ADD COLUMN duration_seconds numeric NOT NULL DEFAULT 0, ADD COLUMN render_quote_usd numeric NOT NULL DEFAULT 0, ADD COLUMN refunded_at timestamptz, ADD COLUMN lease_until timestamptz, ADD COLUMN callback_token_hash text;
COMMENT ON COLUMN public.assembly_jobs.bridge_job_id IS 'DEPRECATED: AWS bridge retired; provider_job_id stores hosted Shotstack render ID';
CREATE UNIQUE INDEX assembly_provider_id_unique ON public.assembly_jobs(provider_job_id) WHERE provider_job_id IS NOT NULL;
CREATE UNIQUE INDEX assembly_one_active_project ON public.assembly_jobs(project_id) WHERE status IN ('claimed','submitting','submission_unknown','queued','fetching','rendering','saving');
CREATE OR REPLACE FUNCTION public.claim_assembly_job(p_user uuid,p_project uuid,p_request uuid,p_input jsonb,p_snapshot jsonb,p_billed integer,p_usd numeric,p_environment text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j public.assembly_jobs; s public.storyboard_scenes; c jsonb; d jsonb; seconds numeric:=0; BEGIN
 PERFORM pg_advisory_xact_lock(hashtext(p_user::text));
 SELECT * INTO j FROM public.assembly_jobs WHERE user_id=p_user AND request_key=p_request;
 IF FOUND THEN IF j.project_id<>p_project OR j.input<>p_input OR j.clip_snapshot<>p_snapshot THEN RAISE EXCEPTION 'Request changed; confirm a new quote'; END IF; RETURN jsonb_build_object('existing',true,'job',to_jsonb(j)); END IF;
 PERFORM 1 FROM public.video_inspiration_projects WHERE id=p_project AND user_id=p_user FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Project not found'; END IF;
 IF EXISTS(SELECT 1 FROM public.assembly_jobs WHERE project_id=p_project AND status IN ('claimed','submitting','submission_unknown','queued','fetching','rendering','saving')) THEN RAISE EXCEPTION 'Assembly is already active; no duplicate render started'; END IF;
 IF p_environment NOT IN ('v1','stage') OR p_billed<0 OR p_usd<0 THEN RAISE EXCEPTION 'Invalid assembly quote'; END IF;
 IF jsonb_array_length(p_snapshot)=0 OR jsonb_array_length(p_snapshot)<>(SELECT count(*) FROM public.storyboard_scenes WHERE project_id=p_project) THEN RAISE EXCEPTION 'Every scene needs an approved completed clip'; END IF;
 FOR s IN SELECT * FROM public.storyboard_scenes WHERE project_id=p_project ORDER BY scene_order FOR UPDATE LOOP
 c:=NULL; SELECT value INTO c FROM jsonb_array_elements(p_snapshot) WHERE value->>'sceneId'=s.id::text;
 IF c IS NULL OR s.approved_at IS NULL OR s.approved_revision IS DISTINCT FROM s.revision OR NOT EXISTS(SELECT 1 FROM public.scene_attempts a WHERE a.id=(c->>'attemptId')::uuid AND a.scene_id=s.id AND a.user_id=p_user AND a.operation='animate' AND a.status='completed' AND a.scene_revision=s.revision AND a.result_url=c->>'path') THEN RAISE EXCEPTION 'Clip approval changed; review the storyboard and quote again'; END IF;
 seconds:=seconds+s.duration;
 END LOOP;
 INSERT INTO public.assembly_jobs(user_id,project_id,request_key,status,input,clip_snapshot,billed,render_quote_usd,environment,duration_seconds,lease_until) VALUES(p_user,p_project,p_request,'claimed',p_input,p_snapshot,p_billed,p_usd,p_environment,seconds,now()+interval '5 minutes') RETURNING * INTO j;
 IF p_billed>0 THEN d:=public.debit_credits(p_user,p_billed,'debit_video','assembly',j.id,j.id); IF NOT (d->>'ok')::boolean THEN RAISE EXCEPTION 'Insufficient credits: required %, available %',p_billed,d->>'balance'; END IF; END IF;
 RETURN jsonb_build_object('job',to_jsonb(j),'existing',false);
END $$;
REVOKE ALL ON FUNCTION public.claim_assembly_job(uuid,uuid,uuid,jsonb,jsonb,integer,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_assembly_job(uuid,uuid,uuid,jsonb,jsonb,integer,numeric,text) TO service_role;
CREATE OR REPLACE FUNCTION public.fail_assembly_job(p_job uuid,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j public.assembly_jobs; BEGIN
 SELECT * INTO j FROM public.assembly_jobs WHERE id=p_job FOR UPDATE; IF NOT FOUND OR j.status='completed' THEN RETURN; END IF;
 IF j.billed>0 AND j.refunded_at IS NULL AND EXISTS(SELECT 1 FROM public.credit_ledger WHERE user_id=j.user_id AND attempt_id=j.id AND delta<0) THEN PERFORM public.refund_credits(j.user_id,j.billed,'assembly',j.id,j.id); END IF;
 UPDATE public.assembly_jobs SET status='failed',failure_reason=p_reason,refunded_at=COALESCE(refunded_at,now()),lease_until=NULL,updated_at=now() WHERE id=j.id;
END $$;
REVOKE ALL ON FUNCTION public.fail_assembly_job(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fail_assembly_job(uuid,text) TO service_role;