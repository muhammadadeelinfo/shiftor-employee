-- Shiftor Employee: profile photo storage reset (strong, deterministic)
-- Run this whole file in Supabase SQL Editor.

-- 1) Ensure bucket exists and is PUBLIC so canonical public URLs work on all devices.
insert into storage.buckets (id, name, public)
values ('company-assets', 'company-assets', true)
on conflict (id) do update
set name = excluded.name,
    public = true;

-- 2) Remove previous profile-photo related policies (safe even if they do not exist).
drop policy if exists "Employees can read own profile photos" on storage.objects;
drop policy if exists "Authenticated can read company-assets" on storage.objects;
drop policy if exists "Employees can upload own profile photos" on storage.objects;
drop policy if exists "Employees can update own profile photos" on storage.objects;
drop policy if exists "Employees can delete own profile photos" on storage.objects;

drop policy if exists "Company assets public read" on storage.objects;
drop policy if exists "Company assets auth upload" on storage.objects;
drop policy if exists "Company assets auth update" on storage.objects;
drop policy if exists "Company assets auth delete" on storage.objects;

-- 3) Read policy for public URLs + signed URLs.
create policy "Company assets public read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'company-assets');

-- 4) Authenticated users can upload/update/delete in company-assets.
-- Keep write scope simple and reliable; app writes deterministic employee path:
-- employees/<auth.uid()>/avatar/latest.jpg
create policy "Company assets auth upload"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'company-assets');

create policy "Company assets auth update"
on storage.objects
for update
to authenticated
using (bucket_id = 'company-assets')
with check (bucket_id = 'company-assets');

create policy "Company assets auth delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'company-assets');

-- 5) Quick verification rows (should return 1 bucket row + 4 policy rows).
select id, name, public
from storage.buckets
where id = 'company-assets';

select policyname, roles, cmd
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname in (
    'Company assets public read',
    'Company assets auth upload',
    'Company assets auth update',
    'Company assets auth delete'
  )
order by policyname;
