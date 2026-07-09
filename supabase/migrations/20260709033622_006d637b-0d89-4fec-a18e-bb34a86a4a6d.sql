
-- research_reports
CREATE TABLE public.research_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('niche','competitor','topic')),
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','scraping','analyzing','ready','failed')),
  raw_data JSONB,
  dna_report JSONB,
  opportunity_score INTEGER,
  error_message TEXT,
  is_saved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_reports TO authenticated;
GRANT ALL ON public.research_reports TO service_role;
ALTER TABLE public.research_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own research_reports" ON public.research_reports FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX research_reports_user_idx ON public.research_reports(user_id, created_at DESC);

-- content_ideas
CREATE TABLE public.content_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  research_report_id UUID REFERENCES public.research_reports(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  hook TEXT,
  description TEXT,
  format TEXT,
  platform TEXT,
  cta TEXT,
  hashtags JSONB,
  virality_score INTEGER,
  difficulty_score INTEGER,
  competition_score INTEGER,
  business_value_score INTEGER,
  audience_interest_score INTEGER,
  production_time_score INTEGER,
  confidence_score INTEGER,
  saved_to_planner BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_ideas TO authenticated;
GRANT ALL ON public.content_ideas TO service_role;
ALTER TABLE public.content_ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own content_ideas" ON public.content_ideas FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX content_ideas_user_idx ON public.content_ideas(user_id, created_at DESC);
CREATE INDEX content_ideas_report_idx ON public.content_ideas(research_report_id);

-- competitor_watchlist
CREATE TABLE public.competitor_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  handle TEXT NOT NULL,
  display_name TEXT,
  platform TEXT NOT NULL DEFAULT 'instagram',
  last_report_id UUID REFERENCES public.research_reports(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform, handle)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitor_watchlist TO authenticated;
GRANT ALL ON public.competitor_watchlist TO service_role;
ALTER TABLE public.competitor_watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own competitor_watchlist" ON public.competitor_watchlist FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- updated_at triggers (reuse existing function)
CREATE TRIGGER research_reports_updated_at BEFORE UPDATE ON public.research_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER content_ideas_updated_at BEFORE UPDATE ON public.content_ideas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER competitor_watchlist_updated_at BEFORE UPDATE ON public.competitor_watchlist FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
