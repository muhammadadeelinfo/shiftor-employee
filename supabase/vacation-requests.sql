-- Vacation request flow for employee app users and admin review.
-- Run this in Supabase SQL editor before releasing the app update.

create extension if not exists pgcrypto;

create table if not exists public.vacation_requests (
  id uuid primary key default gen_random_uuid(),
  "companyId" uuid not null references public.companies(id) on delete cascade,
  "employeeId" uuid not null references public.employees(id) on delete cascade,
  "startDate" date not null,
  "endDate" date not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  "reviewedAt" timestamptz,
  "reviewedBy" uuid,
  "createdAt" timestamptz not null default now(),
  constraint vacation_requests_date_order check ("startDate" <= "endDate")
);

create index if not exists vacation_requests_employee_created_idx
  on public.vacation_requests ("employeeId", "createdAt" desc);

create index if not exists vacation_requests_company_created_idx
  on public.vacation_requests ("companyId", "createdAt" desc);

create index if not exists vacation_requests_company_employee_status_idx
  on public.vacation_requests ("companyId", "employeeId", status);

alter table public.vacation_requests enable row level security;

drop policy if exists "vacation_requests_select" on public.vacation_requests;
create policy "vacation_requests_select" on public.vacation_requests
  for select
  using ("companyId" in (select public.get_company_ids_for_user()));

drop policy if exists "vacation_requests_employee_insert" on public.vacation_requests;
create policy "vacation_requests_employee_insert" on public.vacation_requests
  for insert
  with check (
    "employeeId" = auth.uid()
    and status = 'pending'
    and "reviewedAt" is null
    and "reviewedBy" is null
    and exists (
      select 1
      from public.employees e
      where e.id = auth.uid()
        and e."companyId" = "companyId"
    )
  );

drop policy if exists "vacation_requests_owner_update" on public.vacation_requests;
create policy "vacation_requests_owner_update" on public.vacation_requests
  for update
  using (
    exists (
      select 1
      from public.companies c
      where c.id = "companyId"
        and c."ownerId" = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.companies c
      where c.id = "companyId"
        and c."ownerId" = auth.uid()
    )
  );

drop policy if exists "vacation_requests_owner_delete" on public.vacation_requests;
create policy "vacation_requests_owner_delete" on public.vacation_requests
  for delete
  using (
    exists (
      select 1
      from public.companies c
      where c.id = "companyId"
        and c."ownerId" = auth.uid()
    )
  );
