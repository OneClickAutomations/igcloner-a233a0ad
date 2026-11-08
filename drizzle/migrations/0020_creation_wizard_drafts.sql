CREATE TABLE public.creation_drafts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 title text NOT NULL DEFAULT 'Untitled project',
 step integer NOT NULL DEFAULT 0 CHECK (step BETWEEN 0 AND 5),
 state jsonb NOT NULL DEFAULT '{}'::jsonb,
 completed boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creation_drafts TO authenticated;
GRANT ALL ON public.creation_drafts TO service_role;
ALTER TABLE public.creation_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY creation_drafts_owner ON public.creation_drafts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());