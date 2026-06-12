ALTER TABLE public.analyses ADD COLUMN IF NOT EXISTS viral_score INTEGER;
ALTER TABLE public.analyses ADD COLUMN IF NOT EXISTS viral_band TEXT;
ALTER TABLE public.analyses ADD COLUMN IF NOT EXISTS viral_factors JSONB;