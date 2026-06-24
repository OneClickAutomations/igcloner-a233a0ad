-- ════════════════════════════════════════════════════════════════════════
-- UPLOAD-POST PUBLISHING ENGINE
-- Multi-tenant social publishing on top of the Upload-Post API.
-- Each IGCloner user maps 1:1 to an Upload-Post profile keyed by their
-- Supabase auth user id. We never store platform OAuth tokens — Upload-Post
-- owns those. We store only connection status, selectors, and job/result state.
-- ════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────
-- UPLOAD-POST USER PROFILES — the 1:1 mapping + JWT lifecycle state
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.upload_post_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  upload_post_username TEXT NOT NULL UNIQUE,        -- always = user_id::text
  profile_created_at_provider TIMESTAMPTZ,
  last_jwt_generated_at TIMESTAMPTZ,
  last_jwt_expires_at TIMESTAMPTZ,
  connect_page_visited BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.upload_post_profiles TO authenticated;
GRANT ALL ON public.upload_post_profiles TO service_role;
ALTER TABLE public.upload_post_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own upload-post profile"
  ON public.upload_post_profiles
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role manages upload-post profiles"
  ON public.upload_post_profiles
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────────────
-- SOCIAL ACCOUNTS — connection STATUS + selectors only, never tokens
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.social_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN (
    'instagram','tiktok','facebook','linkedin','x','threads',
    'pinterest','bluesky','youtube','discord','telegram','reddit'
  )),
  upload_post_username TEXT NOT NULL,                -- = user_id::text, stable mapping
  profile_display_name TEXT,                          -- human-readable name shown in UI
  connection_method TEXT NOT NULL DEFAULT 'oauth'
    CHECK (connection_method IN ('oauth', 'manual_credentials')),
  is_connected BOOLEAN DEFAULT false,
  facebook_page_id TEXT,
  facebook_page_name TEXT,
  linkedin_org_urn TEXT,
  linkedin_org_name TEXT,
  pinterest_default_board_id TEXT,
  pinterest_default_board_name TEXT,
  last_validated_at TIMESTAMPTZ,
  last_validation_status TEXT
    CHECK (last_validation_status IN ('valid','expired','revoked','unknown')),
  connected_at TIMESTAMPTZ DEFAULT now(),
  disconnected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, platform)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_accounts TO authenticated;
GRANT ALL ON public.social_accounts TO service_role;
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own social accounts"
  ON public.social_accounts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role manages social accounts"
  ON public.social_accounts
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_social_accounts_user ON public.social_accounts(user_id);

-- ────────────────────────────────────────────────────────────────────────
-- PUBLISHING JOBS — the queue / orchestration layer
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.publishing_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  content_type TEXT NOT NULL
    CHECK (content_type IN ('text','image','carousel','video','reel')),
  title TEXT,
  caption_per_platform JSONB NOT NULL DEFAULT '{}',   -- { "instagram": "...", ... }
  hashtags_per_platform JSONB DEFAULT '{}',
  media_urls TEXT[] DEFAULT '{}',                      -- public URLs fetched by Upload-Post
  platforms TEXT[] NOT NULL,                           -- ['instagram','linkedin','x']
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','queued','uploading','processing','published',
    'partially_published','failed','scheduled','cancelled'
  )),
  scheduled_at TIMESTAMPTZ,                            -- null = publish immediately
  upload_post_request_id TEXT,
  upload_post_job_id TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 2,
  last_error_message TEXT,
  facebook_page_id TEXT,                               -- snapshot at publish time
  linkedin_org_urn TEXT,
  pinterest_board_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.publishing_jobs TO authenticated;
GRANT ALL ON public.publishing_jobs TO service_role;
ALTER TABLE public.publishing_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own publishing jobs"
  ON public.publishing_jobs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role manages publishing jobs"
  ON public.publishing_jobs
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_publishing_jobs_user
  ON public.publishing_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_publishing_jobs_status
  ON public.publishing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_publishing_jobs_scheduled
  ON public.publishing_jobs(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_publishing_jobs_request
  ON public.publishing_jobs(upload_post_request_id);

-- ────────────────────────────────────────────────────────────────────────
-- PUBLISHING RESULTS — per-platform outcome of each job
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.publishing_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.publishing_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','uploading','processing','published','failed'
  )),
  post_url TEXT,
  platform_post_id TEXT,
  error_code TEXT,
  error_message TEXT,
  error_is_retryable BOOLEAN DEFAULT true,
  attempted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(job_id, platform)
);

GRANT SELECT ON public.publishing_results TO authenticated;
GRANT ALL ON public.publishing_results TO service_role;
ALTER TABLE public.publishing_results ENABLE ROW LEVEL SECURITY;

-- Users can only READ their own results — writes are service-role / owner-job only.
CREATE POLICY "Users view own publishing results"
  ON public.publishing_results
  FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Service role manages publishing results"
  ON public.publishing_results
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_publishing_results_job
  ON public.publishing_results(job_id);
CREATE INDEX IF NOT EXISTS idx_publishing_results_user
  ON public.publishing_results(user_id);

-- ────────────────────────────────────────────────────────────────────────
-- ANALYTICS SNAPSHOTS — cached daily account analytics
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.analytics_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  snapshot_date DATE NOT NULL DEFAULT current_date,
  followers_count INTEGER,
  impressions INTEGER,
  reach INTEGER,
  profile_views INTEGER,
  raw_response JSONB,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, platform, snapshot_date)
);

GRANT SELECT ON public.analytics_snapshots TO authenticated;
GRANT ALL ON public.analytics_snapshots TO service_role;
ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own analytics"
  ON public.analytics_snapshots
  FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Service role manages analytics snapshots"
  ON public.analytics_snapshots
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_analytics_user_platform
  ON public.analytics_snapshots(user_id, platform, snapshot_date DESC);

-- ────────────────────────────────────────────────────────────────────────
-- POST ANALYTICS — per-post performance, linked to publishing_results
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.post_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  publishing_result_id UUID REFERENCES public.publishing_results(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  platform_post_id TEXT,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  engagement_rate NUMERIC(5,2),
  last_fetched_at TIMESTAMPTZ DEFAULT now(),
  raw_response JSONB
);

GRANT SELECT ON public.post_analytics TO authenticated;
GRANT ALL ON public.post_analytics TO service_role;
ALTER TABLE public.post_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own post analytics"
  ON public.post_analytics
  FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Service role manages post analytics"
  ON public.post_analytics
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_post_analytics_user
  ON public.post_analytics(user_id, last_fetched_at DESC);

-- ────────────────────────────────────────────────────────────────────────
-- WEBHOOK EVENTS LOG — audit trail + idempotency guard
-- (no RLS exposure to clients — service-role only)
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_event_id TEXT UNIQUE,
  event_type TEXT NOT NULL,
  job_id UUID REFERENCES public.publishing_jobs(id) ON DELETE SET NULL,
  raw_payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  received_at TIMESTAMPTZ DEFAULT now()
);

GRANT ALL ON public.webhook_events TO service_role;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
-- No authenticated policy: clients can never read the webhook log.
CREATE POLICY "Service role manages webhook events"
  ON public.webhook_events
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_webhook_events_unprocessed
  ON public.webhook_events(processed) WHERE processed = false;

-- ────────────────────────────────────────────────────────────────────────
-- updated_at maintenance trigger (shared)
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_upload_post_profiles_updated ON public.upload_post_profiles;
CREATE TRIGGER trg_upload_post_profiles_updated
  BEFORE UPDATE ON public.upload_post_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_social_accounts_updated ON public.social_accounts;
CREATE TRIGGER trg_social_accounts_updated
  BEFORE UPDATE ON public.social_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_publishing_jobs_updated ON public.publishing_jobs;
CREATE TRIGGER trg_publishing_jobs_updated
  BEFORE UPDATE ON public.publishing_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
