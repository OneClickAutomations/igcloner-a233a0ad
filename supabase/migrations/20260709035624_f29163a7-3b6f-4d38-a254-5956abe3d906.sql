
-- Campaigns table
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal TEXT,
  business_type TEXT,
  audience TEXT,
  platforms TEXT[] NOT NULL DEFAULT '{}',
  content_mix JSONB NOT NULL DEFAULT '{}'::jsonb,
  research_report_id UUID REFERENCES public.research_reports(id) ON DELETE SET NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_days INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'active',
  ai_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own campaigns" ON public.campaigns FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_campaigns_user ON public.campaigns(user_id, created_at DESC);

-- Extend calendar_items with campaign intelligence
ALTER TABLE public.calendar_items
  ADD COLUMN campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  ADD COLUMN research_report_id UUID REFERENCES public.research_reports(id) ON DELETE SET NULL,
  ADD COLUMN title TEXT,
  ADD COLUMN objective TEXT,
  ADD COLUMN audience TEXT,
  ADD COLUMN cta TEXT,
  ADD COLUMN platforms TEXT[] DEFAULT '{}',
  ADD COLUMN priority TEXT DEFAULT 'normal',
  ADD COLUMN ai_notes TEXT,
  ADD COLUMN confidence NUMERIC DEFAULT 0,
  ADD COLUMN hashtags TEXT[] DEFAULT '{}';

CREATE INDEX idx_calendar_items_campaign ON public.calendar_items(campaign_id, scheduled_for);
