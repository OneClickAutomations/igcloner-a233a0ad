CREATE OR REPLACE FUNCTION public.check_inspiration_owner() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ DECLARE owner_id uuid; BEGIN
 SELECT user_id INTO owner_id FROM public.video_inspiration_projects WHERE id=NEW.project_id;
 IF NEW.project_id IS NOT NULL AND (owner_id IS NULL OR owner_id<>NEW.user_id) THEN RAISE EXCEPTION 'Project ownership mismatch'; END IF;
 IF TG_TABLE_NAME='scene_attempts' THEN
 IF NOT EXISTS(SELECT 1 FROM public.storyboard_scenes WHERE id=NEW.scene_id AND user_id=NEW.user_id AND project_id=NEW.project_id) THEN RAISE EXCEPTION 'Scene ownership mismatch'; END IF;
 END IF;
 RETURN NEW; END $$;