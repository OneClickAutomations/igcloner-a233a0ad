
-- Profile extended fields
alter table public.profiles add column if not exists workspace_name text;
alter table public.profiles add column if not exists timezone text default 'America/New_York';
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists language text default 'en';
alter table public.profiles add column if not exists last_login_at timestamptz;

-- Third-party API keys
create table if not exists public.user_api_keys (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  provider text not null check (provider in ('upload_post','elevenlabs','openai','anthropic','nano_banana','apify')),
  encrypted_key text not null,
  key_last_four text,
  status text not null default 'unvalidated' check (status in ('unvalidated','valid','invalid','expired','rate_limited')),
  last_validated_at timestamptz,
  last_validation_error text,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, provider)
);
grant select on public.user_api_keys to authenticated;
grant all on public.user_api_keys to service_role;
alter table public.user_api_keys enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='user_api_keys' and policyname='Users view own key metadata') then
    create policy "Users view own key metadata" on public.user_api_keys for select using (auth.uid() = user_id);
  end if;
end $$;

-- User preferences
create table if not exists public.user_preferences (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  theme text default 'system' check (theme in ('light','dark','system')),
  default_reel_style text,
  default_voice_id text,
  default_caption_style text,
  default_platform text,
  default_language text default 'en',
  updated_at timestamptz default now()
);
grant select, insert, update, delete on public.user_preferences to authenticated;
grant all on public.user_preferences to service_role;
alter table public.user_preferences enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='user_preferences' and policyname='Users manage own preferences') then
    create policy "Users manage own preferences" on public.user_preferences for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
  end if;
end $$;

-- Publishing defaults
create table if not exists public.publishing_settings (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  default_platforms text[] default '{}',
  default_scheduling_mode text default 'manual' check (default_scheduling_mode in ('manual','auto_optimal_time')),
  caption_preference text default 'platform_adapted' check (caption_preference in ('platform_adapted','identical_everywhere')),
  hashtag_preference text default 'ai_suggested' check (hashtag_preference in ('ai_suggested','manual_only','none')),
  default_cta text,
  default_post_times jsonb default '[]',
  auto_publish_enabled boolean default false,
  updated_at timestamptz default now()
);
grant select, insert, update, delete on public.publishing_settings to authenticated;
grant all on public.publishing_settings to service_role;
alter table public.publishing_settings enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='publishing_settings' and policyname='Users manage own publishing settings') then
    create policy "Users manage own publishing settings" on public.publishing_settings for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
  end if;
end $$;

-- Publishing templates
create table if not exists public.publishing_templates (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  caption_template text,
  hashtag_set text[],
  platforms text[],
  created_at timestamptz default now()
);
grant select, insert, update, delete on public.publishing_templates to authenticated;
grant all on public.publishing_templates to service_role;
alter table public.publishing_templates enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='publishing_templates' and policyname='Users manage own templates') then
    create policy "Users manage own templates" on public.publishing_templates for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
  end if;
end $$;

-- Affiliate click tracking
create table if not exists public.affiliate_link_clicks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  provider text not null,
  source_location text,
  clicked_at timestamptz default now()
);
grant select, insert on public.affiliate_link_clicks to authenticated;
grant all on public.affiliate_link_clicks to service_role;
alter table public.affiliate_link_clicks enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='affiliate_link_clicks' and policyname='Authenticated users insert own clicks') then
    create policy "Authenticated users insert own clicks" on public.affiliate_link_clicks for insert with check (auth.uid()=user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='affiliate_link_clicks' and policyname='Users view own clicks') then
    create policy "Users view own clicks" on public.affiliate_link_clicks for select using (auth.uid()=user_id);
  end if;
end $$;

-- updated_at trigger
create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname='set_user_api_keys_updated_at') then
    create trigger set_user_api_keys_updated_at before update on public.user_api_keys for each row execute function public.update_updated_at_column();
  end if;
  if not exists (select 1 from pg_trigger where tgname='set_user_preferences_updated_at') then
    create trigger set_user_preferences_updated_at before update on public.user_preferences for each row execute function public.update_updated_at_column();
  end if;
  if not exists (select 1 from pg_trigger where tgname='set_publishing_settings_updated_at') then
    create trigger set_publishing_settings_updated_at before update on public.publishing_settings for each row execute function public.update_updated_at_column();
  end if;
end $$;
