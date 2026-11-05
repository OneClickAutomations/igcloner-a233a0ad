ALTER TABLE public.research_reports ADD COLUMN IF NOT EXISTS last_progress_at timestamptz NOT NULL DEFAULT now();
UPDATE public.research_reports SET last_progress_at = COALESCE(updated_at, created_at);
CREATE INDEX IF NOT EXISTS research_reports_inflight_idx ON public.research_reports (user_id, last_progress_at) WHERE status IN ('scraping','analyzing');

-- Marks in-flight reports whose heartbeat is stale as failed and refunds the
-- latest debit for each via the existing idempotent refund_credits.
-- p_user_id NULL = all users (scheduled); otherwise scoped to that user (lazy).
CREATE OR REPLACE FUNCTION public.sweep_stale_research_reports(p_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record; v_amount integer; v_count integer := 0; v_refunded integer := 0; v_res jsonb;
BEGIN
  FOR r IN
    UPDATE public.research_reports
       SET status = 'failed',
           error_message = CASE WHEN status = 'scraping'
             THEN 'This run stopped responding while collecting posts and was cancelled. Your credits were refunded.'
             ELSE 'This run stopped responding during analysis and was cancelled. Your credits were refunded — if posts were collected, you can retry the analysis.' END,
           last_progress_at = now()
     WHERE (p_user_id IS NULL OR user_id = p_user_id)
       AND ((status = 'scraping' AND last_progress_at < now() - interval '10 minutes')
         OR (status = 'analyzing' AND last_progress_at < now() - interval '15 minutes'))
    RETURNING id, user_id
  LOOP
    v_count := v_count + 1;
    SELECT COALESCE(-SUM(delta), 0) INTO v_amount FROM public.credit_ledger
     WHERE user_id = r.user_id AND related_entity_type = 'research_report' AND related_entity_id = r.id
       AND reason IN ('debit_report','debit_retry')
       AND created_at = (SELECT MAX(created_at) FROM public.credit_ledger
                          WHERE user_id = r.user_id AND related_entity_type = 'research_report'
                            AND related_entity_id = r.id AND reason IN ('debit_report','debit_retry'));
    IF v_amount > 0 THEN
      v_res := public.refund_credits(r.user_id, v_amount, 'research_report', r.id);
      IF (v_res->>'ok')::boolean THEN v_refunded := v_refunded + 1; END IF;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('swept', v_count, 'refunded', v_refunded);
END; $$;
REVOKE ALL ON FUNCTION public.sweep_stale_research_reports(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_stale_research_reports(uuid) TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;