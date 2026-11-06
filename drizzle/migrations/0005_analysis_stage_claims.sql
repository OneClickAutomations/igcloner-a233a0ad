ALTER TABLE public.analyses ADD COLUMN IF NOT EXISTS stage_claimed_until timestamptz;
ALTER TABLE public.clones ADD COLUMN IF NOT EXISTS attempt_id uuid;