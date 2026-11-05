ALTER TABLE public.content_ideas
  ADD COLUMN IF NOT EXISTS predicted_virality_basis INTEGER;