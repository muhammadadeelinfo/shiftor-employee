create table if not exists public.app_update_policy (
  platform text primary key check (platform in ('ios', 'android', 'web')),
  latest_version text not null,
  minimum_supported_version text not null,
  latest_build text,
  minimum_supported_build text,
  update_url text,
  update_reason text,
  release_notes text,
  soft_update_message text,
  force_update_message text,
  maintenance_enabled boolean not null default false,
  maintenance_message text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_update_policy enable row level security;

drop policy if exists "app_update_policy_read_enabled" on public.app_update_policy;
create policy "app_update_policy_read_enabled"
on public.app_update_policy
for select
to anon, authenticated
using (enabled = true);

insert into public.app_update_policy (
  platform,
  latest_version,
  minimum_supported_version,
  latest_build,
  minimum_supported_build,
  update_url,
  update_reason,
  release_notes,
  soft_update_message,
  force_update_message,
  maintenance_enabled,
  maintenance_message
)
values
  (
    'ios',
    '1.1.0',
    '1.1.0',
    '19',
    '19',
    null,
    'This update keeps Shiftor Employee reliable with the latest fixes.',
    'Includes reliability improvements and bug fixes.',
    'A newer version of Shiftor Employee is available.',
    'Please update Shiftor Employee to continue. This version includes important fixes.',
    false,
    'Shiftor Employee is undergoing maintenance. Please try again soon.'
  ),
  (
    'android',
    '1.1.0',
    '1.1.0',
    null,
    null,
    null,
    'This update keeps Shiftor Employee reliable with the latest fixes.',
    'Includes reliability improvements and bug fixes.',
    'A newer version of Shiftor Employee is available.',
    'Please update Shiftor Employee to continue. This version includes important fixes.',
    false,
    'Shiftor Employee is undergoing maintenance. Please try again soon.'
  )
on conflict (platform) do nothing;
