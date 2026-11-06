ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS analysis_status text NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS analysis_stage text,
  ADD COLUMN IF NOT EXISTS last_progress_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS blueprint jsonb,
  ADD COLUMN IF NOT EXISTS evidence jsonb,
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS transcript_segments jsonb,
  ADD COLUMN IF NOT EXISTS analysis_confidence integer,
  ADD COLUMN IF NOT EXISTS model_used text,
  ADD COLUMN IF NOT EXISTS pending_attempt_id uuid,
  ADD COLUMN IF NOT EXISTS pending_charge_amount integer;

ALTER TABLE public.analyses ADD CONSTRAINT analyses_status_check
  CHECK (analysis_status IN ('processing','ready','failed'));

CREATE INDEX IF NOT EXISTS analyses_inflight_idx
  ON public.analyses (user_id, last_progress_at) WHERE analysis_status = 'processing';

-- Stale analysis jobs: no heartbeat for 15 minutes -> failed + refund exactly
-- the pending attempt, then clear the markers so a re-sweep is a no-op.
CREATE OR REPLACE FUNCTION public.sweep_stale_analyses(p_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_count integer := 0; v_refunded integer := 0; v_res jsonb;
BEGIN
  FOR r IN
    UPDATE public.analyses
       SET analysis_status = 'failed',
           error_message = 'This analysis stopped responding and was cancelled. Your credits were refunded.',
           last_progress_at = now()
     WHERE (p_user_id IS NULL OR user_id = p_user_id)
       AND analysis_status = 'processing'
       AND last_progress_at < now() - interval '15 minutes'
    RETURNING id, user_id, pending_attempt_id, pending_charge_amount
  LOOP
    v_count := v_count + 1;
    IF r.pending_attempt_id IS NOT NULL AND COALESCE(r.pending_charge_amount, 0) > 0 THEN
      v_res := public.refund_credits(r.user_id, r.pending_charge_amount, 'analysis', r.pending_attempt_id, r.pending_attempt_id);
      IF (v_res->>'ok')::boolean THEN v_refunded := v_refunded + 1; END IF;
    END IF;
    UPDATE public.analyses SET pending_attempt_id = NULL, pending_charge_amount = NULL WHERE id = r.id;
  END LOOP;
  RETURN jsonb_build_object('swept', v_count, 'refunded', v_refunded);
END; $$;

REVOKE ALL ON FUNCTION public.sweep_stale_analyses(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_stale_analyses(uuid) TO service_role;

SELECT cron.schedule('sweep-stale-analyses', '5 * * * *', 'SELECT public.sweep_stale_analyses(NULL);');