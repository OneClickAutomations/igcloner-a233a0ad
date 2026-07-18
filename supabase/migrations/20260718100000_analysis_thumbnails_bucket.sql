-- Public bucket for cached IG post thumbnails (IG CDN URLs expire).
insert into storage.buckets (id, name, public)
values ('analysis-thumbnails', 'analysis-thumbnails', true)
on conflict (id) do update set public = true;

drop policy if exists "analysis-thumbnails public read" on storage.objects;
create policy "analysis-thumbnails public read"
  on storage.objects for select
  using (bucket_id = 'analysis-thumbnails');
