ALTER TABLE public.credit_ledger DROP CONSTRAINT credit_ledger_reason_check;
ALTER TABLE public.credit_ledger ADD CONSTRAINT credit_ledger_reason_check
  CHECK (reason IN ('plan_grant','topup','debit_report','debit_ideas','debit_premium','debit_retry','debit_analysis','debit_versions','refund_failed','trial_grant'));