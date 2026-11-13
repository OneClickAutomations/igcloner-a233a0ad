ALTER TABLE public.reference_assets DROP CONSTRAINT IF EXISTS reference_assets_kind_check;
ALTER TABLE public.reference_assets ADD CONSTRAINT reference_assets_kind_check CHECK (kind IN ('character_face','character_body','character_back','product','logo','setting'));
CREATE OR REPLACE FUNCTION public.prefill_inspiration_storyboard(p_user uuid, p_project uuid, p_scenes jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  PERFORM id FROM public.video_inspiration_projects WHERE id = p_project AND user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found'; END IF;
  SELECT count(*) INTO n FROM public.storyboard_scenes WHERE project_id = p_project;
  IF n > 0 THEN RETURN n; END IF;
  IF jsonb_typeof(p_scenes) <> 'array' OR jsonb_array_length(p_scenes) = 0 THEN RAISE EXCEPTION 'No storyboard scenes supplied'; END IF;
  INSERT INTO public.storyboard_scenes (project_id,user_id,scene_order,duration,still_prompt,motion_prompt,action_objects,scene_input,object_checks)
  SELECT p_project,p_user,(x.ordinality-1)::integer,(x.value->>'duration')::integer,x.value->>'still_prompt',x.value->>'motion_prompt',x.value->'action_objects',x.value->'scene_input','[]'::jsonb FROM jsonb_array_elements(p_scenes) WITH ORDINALITY AS x(value,ordinality);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.prefill_inspiration_storyboard(uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prefill_inspiration_storyboard(uuid,uuid,jsonb) TO service_role;