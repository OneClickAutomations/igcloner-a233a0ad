CREATE OR REPLACE FUNCTION public.replace_inspiration_storyboard(p_user uuid, p_project uuid, p_scenes jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE x record; n integer := 0; existing uuid;
BEGIN
  PERFORM id FROM public.video_inspiration_projects WHERE id = p_project AND user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found'; END IF;
  IF jsonb_typeof(p_scenes) <> 'array' OR jsonb_array_length(p_scenes) = 0 THEN RAISE EXCEPTION 'No storyboard scenes supplied'; END IF;
  IF EXISTS (SELECT 1 FROM public.scene_attempts a JOIN public.storyboard_scenes s ON s.id=a.scene_id WHERE s.project_id=p_project AND a.status IN ('claimed','in_progress','submitting','submitted','submission_unknown')) THEN
    RAISE EXCEPTION 'A scene is still generating. Wait for it to finish, then replace the storyboard.';
  END IF;
  FOR x IN SELECT value, (ordinality-1)::integer AS idx FROM jsonb_array_elements(p_scenes) WITH ORDINALITY LOOP
    existing := NULL;
    SELECT id INTO existing FROM public.storyboard_scenes WHERE project_id=p_project AND scene_order=x.idx;
    IF existing IS NOT NULL THEN
      UPDATE public.storyboard_scenes SET duration=(x.value->>'duration')::integer, still_prompt=x.value->>'still_prompt', motion_prompt=x.value->>'motion_prompt',
        action_objects=x.value->'action_objects', scene_input=x.value->'scene_input', object_checks='[]'::jsonb, still_path=NULL, approved_at=NULL, approved_revision=NULL,
        selected_attempt_id=NULL, status='draft', revision=revision+1, updated_at=now() WHERE id=existing;
    ELSE
      INSERT INTO public.storyboard_scenes (project_id,user_id,scene_order,duration,still_prompt,motion_prompt,action_objects,scene_input,object_checks)
      VALUES (p_project,p_user,x.idx,(x.value->>'duration')::integer,x.value->>'still_prompt',x.value->>'motion_prompt',x.value->'action_objects',x.value->'scene_input','[]'::jsonb);
    END IF;
    n := n + 1;
  END LOOP;
  DELETE FROM public.storyboard_scenes s WHERE s.project_id=p_project AND s.scene_order>=n AND NOT EXISTS (SELECT 1 FROM public.scene_attempts a WHERE a.scene_id=s.id);
  RETURN n;
END; $$;
REVOKE ALL ON FUNCTION public.replace_inspiration_storyboard(uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_inspiration_storyboard(uuid,uuid,jsonb) TO service_role;