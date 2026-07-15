
ALTER TABLE public.content_ideas
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS idea_number INTEGER,
  ADD COLUMN IF NOT EXISTS caption_opener TEXT,
  ADD COLUMN IF NOT EXISTS why_it_works TEXT,
  ADD COLUMN IF NOT EXISTS viral_mechanism TEXT,
  ADD COLUMN IF NOT EXISTS production_difficulty TEXT;

ALTER TABLE public.research_reports
  ADD COLUMN IF NOT EXISTS posts_analyzed INTEGER,
  ADD COLUMN IF NOT EXISTS limited_data BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS limited_data_reason TEXT;
