CREATE TABLE public.calendar_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  niche TEXT,
  scheduled_for DATE NOT NULL,
  post_type TEXT,
  hook TEXT,
  caption TEXT,
  visual_idea TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_items TO authenticated;
GRANT ALL ON public.calendar_items TO service_role;

ALTER TABLE public.calendar_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own calendar items"
  ON public.calendar_items
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role manages all calendar items"
  ON public.calendar_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_calendar_items_updated_at
  BEFORE UPDATE ON public.calendar_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX calendar_items_user_date_idx ON public.calendar_items (user_id, scheduled_for);