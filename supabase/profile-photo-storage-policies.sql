-- Shiftor Employee profile photo storage policies
-- Run this in Supabase SQL editor for the target project.

-- Ensure the bucket exists.
insert into storage.buckets (id, name, public)
values ('company-assets', 'company-assets', false)
on conflict (id) do nothing;

-- Employees can access only their own profile photo paths:
-- 1) employees/<auth.uid()>/avatar/<file>
-- 2) companies/<company-id>/employees/<auth.uid()>/avatar/<file>

drop policy if exists "Employees can read own profile photos" on storage.objects;
create policy "Employees can read own profile photos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'company-assets'
  and (
    (
      (storage.foldername(name))[1] = 'employees'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
    or
    (
      (storage.foldername(name))[1] = 'companies'
      and (storage.foldername(name))[3] = 'employees'
      and (storage.foldername(name))[4] = auth.uid()::text
    )
  )
);

drop policy if exists "Employees can upload own profile photos" on storage.objects;
create policy "Employees can upload own profile photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'company-assets'
  and (
    (
      (storage.foldername(name))[1] = 'employees'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
    or
    (
      (storage.foldername(name))[1] = 'companies'
      and (storage.foldername(name))[3] = 'employees'
      and (storage.foldername(name))[4] = auth.uid()::text
    )
  )
);

drop policy if exists "Employees can update own profile photos" on storage.objects;
create policy "Employees can update own profile photos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'company-assets'
  and (
    (
      (storage.foldername(name))[1] = 'employees'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
    or
    (
      (storage.foldername(name))[1] = 'companies'
      and (storage.foldername(name))[3] = 'employees'
      and (storage.foldername(name))[4] = auth.uid()::text
    )
  )
)
with check (
  bucket_id = 'company-assets'
  and (
    (
      (storage.foldername(name))[1] = 'employees'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
    or
    (
      (storage.foldername(name))[1] = 'companies'
      and (storage.foldername(name))[3] = 'employees'
      and (storage.foldername(name))[4] = auth.uid()::text
    )
  )
);

drop policy if exists "Employees can delete own profile photos" on storage.objects;
create policy "Employees can delete own profile photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'company-assets'
  and (
    (
      (storage.foldername(name))[1] = 'employees'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
    or
    (
      (storage.foldername(name))[1] = 'companies'
      and (storage.foldername(name))[3] = 'employees'
      and (storage.foldername(name))[4] = auth.uid()::text
    )
  )
);
