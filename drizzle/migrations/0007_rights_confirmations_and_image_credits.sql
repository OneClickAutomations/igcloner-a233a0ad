CREATE TABLE public.rights_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  analysis_id uuid NOT NULL,
  source_url text,
  source_account text,
  mode text NOT NULL,
  statement_version text NOT NULL,
  statement_text text NOT NULL,
  ip text,
  confirmed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.rights_confirmations TO authenticated;
GRANT ALL ON public.rights_confirmations TO service_role;
ALTER TABLE public.rights_confirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own rights confirmations" ON public.rights_confirmations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own rights confirmations" ON public.rights_confirmations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX rights_confirmations_lookup_idx ON public.rights_confirmations (user_id, analysis_id, mode);

ALTER TABLE public.credit_ledger DROP CONSTRAINT credit_ledger_reason_check;
ALTER TABLE public.credit_ledger ADD CONSTRAINT credit_ledger_reason_check
  CHECK (reason IN ('plan_grant','topup','debit_report','debit_ideas','debit_premium','debit_retry','debit_analysis','debit_versions','debit_image','refund_failed','trial_grant'));