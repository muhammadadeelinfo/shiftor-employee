-- Privacy-safe employee-app events. Event payloads must never contain document
-- content, free text, contact details, join codes, auth tokens, or precise location.
create table if not exists public.employee_app_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  event_name text not null check (event_name in (
    'login_succeeded', 'shift_viewed', 'qr_completed', 'document_uploaded',
    'vacation_submitted', 'notification_opened', 'company_link_requested',
    'feedback_submitted', 'rating_prompt_shown'
  )),
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.employee_app_events enable row level security;

create index if not exists employee_app_events_name_created_idx
  on public.employee_app_events (event_name, created_at desc);

create or replace function public.track_employee_app_event(
  event_name text,
  event_properties jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  if event_name not in (
    'login_succeeded', 'shift_viewed', 'qr_completed', 'document_uploaded',
    'vacation_submitted', 'notification_opened', 'company_link_requested',
    'feedback_submitted', 'rating_prompt_shown'
  ) then
    raise exception 'Unsupported analytics event';
  end if;
  if jsonb_object_length(coalesce(event_properties, '{}'::jsonb)) > 20 then
    raise exception 'Too many analytics properties';
  end if;
  insert into public.employee_app_events (user_id, event_name, properties)
  values (auth.uid(), event_name, coalesce(event_properties, '{}'::jsonb));
end;
$$;

revoke all on function public.track_employee_app_event(text, jsonb) from public;
grant execute on function public.track_employee_app_event(text, jsonb) to authenticated;
