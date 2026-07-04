-- Push notification token and preference storage for Shiftor Employee.
-- Apply this before enabling server-side Expo push delivery.

create extension if not exists pgcrypto;

create table if not exists public.employee_push_tokens (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references auth.users (id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android', 'web', 'macos', 'windows')),
  device_name text,
  app_version text,
  preferences jsonb not null default jsonb_build_object(
    'shiftUpdates', true,
    'shiftReminders', true,
    'vacationDocuments', true
  ),
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, expo_push_token)
);

comment on table public.employee_push_tokens is
  'Expo push tokens registered by Shiftor Employee devices, including employee notification preferences.';

create index if not exists employee_push_tokens_employee_idx
  on public.employee_push_tokens (employee_id);

create index if not exists employee_push_tokens_active_idx
  on public.employee_push_tokens (employee_id, disabled_at)
  where disabled_at is null;

alter table public.employee_push_tokens enable row level security;

drop policy if exists "Users can view own push tokens" on public.employee_push_tokens;
create policy "Users can view own push tokens"
  on public.employee_push_tokens
  for select
  using (employee_id = auth.uid());

drop policy if exists "Users can register own push tokens" on public.employee_push_tokens;
create policy "Users can register own push tokens"
  on public.employee_push_tokens
  for insert
  with check (employee_id = auth.uid());

drop policy if exists "Users can update own push tokens" on public.employee_push_tokens;
create policy "Users can update own push tokens"
  on public.employee_push_tokens
  for update
  using (employee_id = auth.uid())
  with check (employee_id = auth.uid());

-- Server-side senders should use the service role key to read active tokens.
-- Expected Expo push payload data keys:
--   target: '/notifications' | '/vacation-requests' | '/employee-documents'
--   shiftId: '<shift uuid>' for shift detail deep links
--   deepLink: any route understood by the mobile app
