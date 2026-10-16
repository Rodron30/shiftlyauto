-- 0046_bcautoloan_storage_bucket.sql
-- Create Supabase Storage bucket for BCAutoLoan application PDFs

-- Note: This migration uses Supabase Storage management functions
-- These may need to be executed via Supabase dashboard or with appropriate permissions

-- Create the storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bcautoloan-applications',
  'bcautoloan-applications',
  false, -- private bucket, accessed via signed URLs or server-side
  5242880, -- 5MB limit per file
  ARRAY['application/pdf']
)
on conflict (id) do nothing;

-- Create RLS policies for the bucket
-- Only service role can upload
do $$
begin
  if not exists (
    select 1 from pg_policies
    where policyname = 'Service role can upload'
    and schemaname = 'storage'
    and tablename = 'objects'
  ) then
    create policy "Service role can upload" on storage.objects
    for insert
    with check (bucket_id = 'bcautoloan-applications');
  end if;
end $$;

-- Service role can read
do $$
begin
  if not exists (
    select 1 from pg_policies
    where policyname = 'Service role can read'
    and schemaname = 'storage'
    and tablename = 'objects'
  ) then
    create policy "Service role can read" on storage.objects
    for select
    using (bucket_id = 'bcautoloan-applications');
  end if;
end $$;

-- Service role can delete
do $$
begin
  if not exists (
    select 1 from pg_policies
    where policyname = 'Service role can delete'
    and schemaname = 'storage'
    and tablename = 'objects'
  ) then
    create policy "Service role can delete" on storage.objects
    for delete
    using (bucket_id = 'bcautoloan-applications');
  end if;
end $$;

-- No public access - all access is server-side via service role
