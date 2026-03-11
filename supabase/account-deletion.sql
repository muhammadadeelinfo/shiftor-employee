-- Account deletion request flow for employee app users.
-- Run this in Supabase SQL editor before releasing the app update.

create extension if not exists pgcrypto;

create table if not exists public.employee_account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'processed', 'rejected')),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references auth.users (id) on delete set null,
  notes text
);

create unique index if not exists employee_account_deletion_requests_pending_user_idx
  on public.employee_account_deletion_requests (user_id)
  where status = 'pending';

alter table public.employee_account_deletion_requests enable row level security;

drop policy if exists "Users can view own deletion requests" on public.employee_account_deletion_requests;
create policy "Users can view own deletion requests"
  on public.employee_account_deletion_requests
  for select
  using (user_id = auth.uid());

drop function if exists public.request_employee_account_deletion();
create or replace function public.request_employee_account_deletion()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  caller_email text;
  pending_request_id uuid;
  created_request_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  select id
  into pending_request_id
  from public.employee_account_deletion_requests
  where user_id = caller_id
    and status = 'pending'
  order by requested_at desc
  limit 1;

  if pending_request_id is not null then
    return jsonb_build_object(
      'ok', true,
      'status', 'already_pending',
      'requestId', pending_request_id
    );
  end if;

  select email
  into caller_email
  from auth.users
  where id = caller_id;

  insert into public.employee_account_deletion_requests (
    user_id,
    email,
    reason,
    status,
    requested_at
  )
  values (
    caller_id,
    caller_email,
    'Requested by employee from mobile app',
    'pending',
    now()
  )
  returning id into created_request_id;

  return jsonb_build_object(
    'ok', true,
    'status', 'requested',
    'requestId', created_request_id
  );
end;
$$;

revoke all on function public.request_employee_account_deletion() from public;
grant execute on function public.request_employee_account_deletion() to authenticated;
