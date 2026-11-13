ALTER TABLE public.storyboard_scenes ADD COLUMN IF NOT EXISTS end_still_path text;
ALTER TABLE public.scene_attempts ADD COLUMN IF NOT EXISTS frame text NOT NULL DEFAULT 'first';
ALTER TABLE public.scene_attempts ADD COLUMN IF NOT EXISTS outfit_fallback boolean NOT NULL DEFAULT false;