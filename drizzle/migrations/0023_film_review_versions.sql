ALTER TABLE public.storyboard_scenes ADD COLUMN selected_attempt_id uuid, ADD COLUMN review_history jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.scene_attempts ADD COLUMN prompt_snapshot text;
ALTER TABLE public.video_inspiration_projects ADD COLUMN review_settings jsonb NOT NULL DEFAULT '{}';
CREATE OR REPLACE FUNCTION public.save_film_shot_review(p_user uuid,p_scene uuid,p_instruction text DEFAULT '',p_attempt uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.storyboard_scenes;
BEGIN
 SELECT * INTO s FROM public.storyboard_scenes WHERE id=p_scene AND user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Shot not found'; END IF;
 IF p_attempt IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.scene_attempts WHERE id=p_attempt AND scene_id=s.id AND user_id=p_user AND operation='animate' AND status='completed' AND scene_revision=s.revision AND result_url IS NOT NULL) THEN RAISE EXCEPTION 'Choose a completed version from this approved shot'; END IF;
 UPDATE public.storyboard_scenes SET selected_attempt_id=COALESCE(p_attempt,selected_attempt_id),review_history=CASE WHEN length(trim(p_instruction))>0 THEN review_history||jsonb_build_array(jsonb_build_object('instruction',left(p_instruction,1500),'savedAt',now(),'revision',s.revision)) ELSE review_history END WHERE id=s.id;
END $$;
REVOKE ALL ON FUNCTION public.save_film_shot_review(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_film_shot_review(uuid,uuid,text,uuid) TO service_role;