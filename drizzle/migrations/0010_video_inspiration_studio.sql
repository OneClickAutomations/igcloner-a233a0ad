CREATE TABLE public.video_inspiration_projects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, analysis_id uuid REFERENCES public.analyses(id), title text NOT NULL DEFAULT 'Untitled film', aspect_ratio text NOT NULL DEFAULT '9:16' CHECK(aspect_ratio='9:16'), visual_observations jsonb NOT NULL DEFAULT '[]', audio_observations jsonb NOT NULL DEFAULT '{}', observation_notes jsonb NOT NULL DEFAULT '[]', status text NOT NULL DEFAULT 'storyboard', pause_reason text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.video_inspiration_projects TO authenticated;
GRANT ALL ON public.video_inspiration_projects TO service_role;
ALTER TABLE public.video_inspiration_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads inspiration projects" ON public.video_inspiration_projects FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE TABLE public.reference_assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, project_id uuid REFERENCES public.video_inspiration_projects(id) ON DELETE CASCADE, kind text NOT NULL CHECK(kind IN ('character_face','character_body','character_back','product','logo')), filename text NOT NULL, storage_path text NOT NULL, enabled boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reference_assets TO authenticated;
GRANT ALL ON public.reference_assets TO service_role;
ALTER TABLE public.reference_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads inspiration references" ON public.reference_assets FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE TABLE public.storyboard_scenes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES public.video_inspiration_projects(id) ON DELETE CASCADE, user_id uuid NOT NULL, scene_order integer NOT NULL CHECK(scene_order>=0), duration integer NOT NULL DEFAULT 8 CHECK(duration IN (4,6,8)), still_prompt text NOT NULL, motion_prompt text NOT NULL, action_objects jsonb NOT NULL DEFAULT '[]', scene_input jsonb NOT NULL DEFAULT '{}', object_checks jsonb NOT NULL DEFAULT '[]', still_path text, status text NOT NULL DEFAULT 'draft', revision integer NOT NULL DEFAULT 1, approved_revision integer, approved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(project_id,scene_order)
);
GRANT SELECT ON public.storyboard_scenes TO authenticated;
GRANT ALL ON public.storyboard_scenes TO service_role;
ALTER TABLE public.storyboard_scenes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads storyboard" ON public.storyboard_scenes FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE TABLE public.scene_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES public.video_inspiration_projects(id) ON DELETE CASCADE, scene_id uuid NOT NULL REFERENCES public.storyboard_scenes(id) ON DELETE CASCADE, user_id uuid NOT NULL, operation text NOT NULL CHECK(operation IN ('still','animate')), model text NOT NULL, seconds integer NOT NULL DEFAULT 0, billed integer NOT NULL DEFAULT 0, workspace_quote numeric, workspace_billed numeric, usage jsonb, request_key uuid NOT NULL, scene_revision integer NOT NULL, reference_ids uuid[] NOT NULL DEFAULT '{}', status text NOT NULL DEFAULT 'claimed', gateway_job_id text UNIQUE, result_url text, failure_reason text, refunded_at timestamptz, lease_until timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,request_key)
);
GRANT SELECT ON public.scene_attempts TO authenticated;
GRANT ALL ON public.scene_attempts TO service_role;
ALTER TABLE public.scene_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads scene attempts" ON public.scene_attempts FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE UNIQUE INDEX inspiration_one_active_project ON public.scene_attempts(project_id) WHERE status IN ('claimed','submitting','queued','in_progress','collecting');
CREATE TABLE public.assembly_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES public.video_inspiration_projects(id) ON DELETE CASCADE, user_id uuid NOT NULL, request_key uuid NOT NULL UNIQUE, bridge_job_id text, status text NOT NULL DEFAULT 'not_configured', billed integer NOT NULL DEFAULT 0, result_path text, failure_reason text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.assembly_jobs TO authenticated;
GRANT ALL ON public.assembly_jobs TO service_role;
ALTER TABLE public.assembly_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads assembly jobs" ON public.assembly_jobs FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY "Owner reads inspiration media" ON storage.objects FOR SELECT TO authenticated USING(bucket_id='video-inspiration' AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE OR REPLACE FUNCTION public.invalidate_inspiration_approval() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF ROW(NEW.still_prompt,NEW.motion_prompt,NEW.action_objects,NEW.duration,NEW.still_path) IS DISTINCT FROM ROW(OLD.still_prompt,OLD.motion_prompt,OLD.action_objects,OLD.duration,OLD.still_path) THEN
 IF EXISTS(SELECT 1 FROM public.scene_attempts WHERE scene_id=OLD.id AND status IN ('claimed','submitting','queued','in_progress','collecting')) THEN RAISE EXCEPTION 'Scene generation is active; wait before editing'; END IF;
 NEW.revision:=OLD.revision+1; NEW.approved_at:=NULL; NEW.approved_revision:=NULL; NEW.status:=CASE WHEN NEW.still_path IS NULL THEN 'draft' ELSE 'still_ready' END;
 END IF; NEW.updated_at:=now(); RETURN NEW; END $$;
CREATE TRIGGER inspiration_approval_revision BEFORE UPDATE ON public.storyboard_scenes FOR EACH ROW EXECUTE FUNCTION public.invalidate_inspiration_approval();
CREATE OR REPLACE FUNCTION public.claim_inspiration_attempt(p_user uuid,p_scene uuid,p_request uuid,p_operation text,p_model text,p_billed integer,p_workspace numeric,p_references uuid[] DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.storyboard_scenes; a public.scene_attempts; d jsonb; BEGIN
 PERFORM pg_advisory_xact_lock(hashtext(p_user::text));
 SELECT * INTO a FROM public.scene_attempts WHERE user_id=p_user AND request_key=p_request; IF FOUND THEN RETURN jsonb_build_object('existing',true,'attempt',to_jsonb(a)); END IF;
 SELECT * INTO s FROM public.storyboard_scenes WHERE id=p_scene AND user_id=p_user FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Scene not found'; END IF;
 IF EXISTS(SELECT 1 FROM public.video_inspiration_projects WHERE id=s.project_id AND pause_reason IS NOT NULL) THEN RAISE EXCEPTION 'Project paused; start a fresh request after restoring access'; END IF;
 IF EXISTS(SELECT 1 FROM public.scene_attempts WHERE project_id=s.project_id AND status IN ('claimed','submitting','queued','in_progress','collecting')) THEN RETURN jsonb_build_object('busy',true); END IF;
 IF p_operation='animate' AND (s.still_path IS NULL OR s.approved_at IS NULL OR s.approved_revision IS DISTINCT FROM s.revision OR EXISTS(SELECT 1 FROM jsonb_array_elements(s.action_objects) o WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s.object_checks) c WHERE c->>'name'=o->>'name' AND c->>'state'=o->>'state' AND c->>'present'='true'))) THEN RAISE EXCEPTION 'Approve the still and verify all action objects'; END IF;
 IF p_billed<0 THEN RAISE EXCEPTION 'Invalid price'; END IF;
 IF EXISTS(SELECT 1 FROM public.reference_assets WHERE id=ANY(p_references) AND user_id<>p_user) THEN RAISE EXCEPTION 'Reference not owned'; END IF;
 INSERT INTO public.scene_attempts(user_id,project_id,scene_id,operation,model,seconds,billed,workspace_quote,request_key,scene_revision,reference_ids,lease_until) VALUES(p_user,s.project_id,s.id,p_operation,p_model,CASE WHEN p_operation='animate' THEN s.duration ELSE 0 END,p_billed,p_workspace,p_request,s.revision,p_references,now()+interval '5 minutes') RETURNING * INTO a;
 d:=public.debit_credits(p_user,p_billed,'debit_image','inspiration_attempt',a.id,a.id); IF NOT (d->>'ok')::boolean THEN RAISE EXCEPTION 'Insufficient credits: required %, available %',p_billed,d->>'balance'; END IF;
 RETURN jsonb_build_object('claimed',true,'attempt',to_jsonb(a)); END $$;
REVOKE ALL ON FUNCTION public.claim_inspiration_attempt(uuid,uuid,uuid,text,text,integer,numeric,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_inspiration_attempt(uuid,uuid,uuid,text,text,integer,numeric,uuid[]) TO service_role;
CREATE OR REPLACE FUNCTION public.fail_inspiration_attempt(p_attempt uuid,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE a public.scene_attempts; BEGIN
 SELECT * INTO a FROM public.scene_attempts WHERE id=p_attempt FOR UPDATE; IF NOT FOUND OR a.status='completed' THEN RETURN; END IF;
 IF a.billed>0 AND a.refunded_at IS NULL AND EXISTS(SELECT 1 FROM public.credit_ledger WHERE user_id=a.user_id AND attempt_id=a.id AND delta<0) THEN PERFORM public.refund_credits(a.user_id,a.billed,'inspiration_attempt',a.id,a.id); END IF;
 UPDATE public.scene_attempts SET status='failed',failure_reason=p_reason,refunded_at=COALESCE(refunded_at,now()),lease_until=NULL,updated_at=now() WHERE id=a.id;
 UPDATE public.storyboard_scenes SET status='failed' WHERE id=a.scene_id;
 END $$;
REVOKE ALL ON FUNCTION public.fail_inspiration_attempt(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fail_inspiration_attempt(uuid,text) TO service_role;