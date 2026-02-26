-- Company linking flow for public self-signup users.
-- Run this in Supabase SQL editor after confirming the `companies` table exists.

create extension if not exists pgcrypto;

create table if not exists public.company_join_codes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  code text not null unique,
  is_active boolean not null default true,
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  use_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.company_join_codes
  add column if not exists expires_at timestamptz;
alter table public.company_join_codes
  add column if not exists max_uses integer;
alter table public.company_join_codes
  add column if not exists use_count integer not null default 0;
alter table public.company_join_codes
  drop constraint if exists company_join_codes_max_uses_check;
alter table public.company_join_codes
  add constraint company_join_codes_max_uses_check check (max_uses is null or max_uses > 0);

comment on table public.company_join_codes is
  'Company-issued join codes that employees can enter during self-signup.';

create table if not exists public.employee_company_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active', 'rejected')),
  requested_code text not null,
  requested_full_name text,
  requested_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, company_id)
);

create unique index if not exists employee_company_links_user_active_unique
  on public.employee_company_links (user_id)
  where status = 'active';

comment on table public.employee_company_links is
  'Tracks company association requests from self-signup users.';

create table if not exists public.company_link_audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete set null,
  actor_user_id uuid references auth.users (id) on delete set null,
  link_id uuid references public.employee_company_links (id) on delete set null,
  code_id uuid references public.company_join_codes (id) on delete set null,
  action text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table public.company_link_audit_logs
  alter column company_id drop not null;

comment on table public.company_link_audit_logs is
  'Audit trail for employee-company linking lifecycle events.';

create index if not exists company_link_audit_logs_company_created_idx
  on public.company_link_audit_logs (company_id, created_at desc);
create index if not exists company_link_audit_logs_actor_created_idx
  on public.company_link_audit_logs (actor_user_id, created_at desc);

alter table public.company_join_codes enable row level security;
alter table public.employee_company_links enable row level security;
alter table public.company_link_audit_logs enable row level security;

drop policy if exists "Users can view own company links" on public.employee_company_links;
create policy "Users can view own company links"
  on public.employee_company_links
  for select
  using (user_id = auth.uid());

drop function if exists public.request_employee_company_link(text, text);
create or replace function public.request_employee_company_link(join_code text, full_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  normalized_code text := upper(trim(join_code));
  code_record public.company_join_codes%rowtype;
  target_company_id uuid;
  current_active_company_id uuid;
  requested_action text := 'join';
  resolved_email text;
  recent_attempt_count integer := 0;
  existing_link_id uuid;
  resolved_status text;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  select count(*)
  into recent_attempt_count
  from public.company_link_audit_logs
  where actor_user_id = caller_id
    and action in (
      'request_submitted',
      'request_invalid_code',
      'request_code_expired',
      'request_code_exhausted',
      'request_rate_limited'
    )
    and created_at >= now() - interval '10 minutes';

  if recent_attempt_count >= 20 then
    insert into public.company_link_audit_logs (company_id, actor_user_id, action, metadata)
    values (null, caller_id, 'request_rate_limited', jsonb_build_object('code', normalized_code));
    return jsonb_build_object('ok', false, 'status', 'rate_limited');
  end if;

  if normalized_code is null or normalized_code = '' then
    insert into public.company_link_audit_logs (company_id, actor_user_id, action, metadata)
    values (null, caller_id, 'request_invalid_code', jsonb_build_object('reason', 'empty'));
    return jsonb_build_object('ok', false, 'status', 'invalid_code');
  end if;

  select cjc.*
  into code_record
  from public.company_join_codes cjc
  where upper(cjc.code) = normalized_code
    and cjc.is_active = true
  limit 1;

  if code_record.id is null then
    insert into public.company_link_audit_logs (company_id, actor_user_id, action, metadata)
    values (null, caller_id, 'request_invalid_code', jsonb_build_object('code', normalized_code));
    return jsonb_build_object('ok', false, 'status', 'invalid_code');
  end if;

  target_company_id := code_record.company_id;

  if code_record.expires_at is not null and code_record.expires_at <= now() then
    insert into public.company_link_audit_logs (company_id, actor_user_id, action, code_id, metadata)
    values (
      target_company_id,
      caller_id,
      'request_code_expired',
      code_record.id,
      jsonb_build_object('code', normalized_code)
    );
    return jsonb_build_object('ok', false, 'status', 'code_expired');
  end if;

  if code_record.max_uses is not null and code_record.use_count >= code_record.max_uses then
    insert into public.company_link_audit_logs (company_id, actor_user_id, action, code_id, metadata)
    values (
      target_company_id,
      caller_id,
      'request_code_exhausted',
      code_record.id,
      jsonb_build_object('code', normalized_code)
    );
    return jsonb_build_object('ok', false, 'status', 'code_exhausted');
  end if;

  select company_id
  into current_active_company_id
  from public.employee_company_links
  where user_id = caller_id
    and status = 'active'
  order by updated_at desc
  limit 1;

  if current_active_company_id is not null and current_active_company_id <> target_company_id then
    requested_action := 'switch';
  end if;

  select id
  into existing_link_id
  from public.employee_company_links
  where user_id = caller_id
    and company_id = target_company_id
  limit 1;

  if existing_link_id is null then
    update public.company_join_codes
    set use_count = use_count + 1,
        updated_at = now()
    where id = code_record.id;
  end if;

  select email
  into resolved_email
  from auth.users
  where id = caller_id;

  insert into public.employee_company_links (
    user_id,
    company_id,
    status,
    requested_code,
    requested_full_name,
    requested_email
  )
  values (
    caller_id,
    target_company_id,
    'pending',
    normalized_code,
    nullif(trim(full_name), ''),
    resolved_email
  )
  on conflict (user_id, company_id)
  do update set
    requested_code = excluded.requested_code,
    requested_full_name = coalesce(excluded.requested_full_name, employee_company_links.requested_full_name),
    requested_email = excluded.requested_email,
    status = case
      when employee_company_links.status = 'active' then 'active'
      else 'pending'
    end,
    updated_at = now()
  returning status into resolved_status;

  insert into public.company_link_audit_logs (
    company_id,
    actor_user_id,
    code_id,
    action,
    metadata
  )
  values (
    target_company_id,
    caller_id,
    code_record.id,
    'request_submitted',
    jsonb_build_object(
      'code', normalized_code,
      'status', resolved_status,
      'hadExistingLink', existing_link_id is not null,
      'requestedAction', requested_action,
      'currentActiveCompanyId', current_active_company_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'status', resolved_status,
    'companyId', target_company_id,
    'requestedAction', requested_action,
    'previousCompanyId', current_active_company_id
  );
end;
$$;

revoke all on function public.request_employee_company_link(text, text) from public;
grant execute on function public.request_employee_company_link(text, text) to authenticated;

drop function if exists public.approve_employee_company_link(uuid);
create or replace function public.approve_employee_company_link(link_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  link_record public.employee_company_links%rowtype;
  old_active_company_ids uuid[] := '{}'::uuid[];
  user_col text;
  user_col_type text;
  company_col text;
  company_col_type text;
  email_col text;
  full_name_col text;
  status_col text;
  user_email text;
  user_full_name text;
  set_parts text[] := array[]::text[];
  insert_cols text[] := array[]::text[];
  insert_vals text[] := array[]::text[];
  where_user text;
  where_company text;
  rows_affected integer := 0;
begin
  if link_id is null then
    raise exception 'link_id is required';
  end if;

  select *
  into link_record
  from public.employee_company_links
  where id = link_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'status', 'not_found');
  end if;

  if link_record.status = 'active' then
    insert into public.company_link_audit_logs (company_id, actor_user_id, link_id, action, metadata)
    values (
      link_record.company_id,
      auth.uid(),
      link_record.id,
      'approve_skipped_already_active',
      jsonb_build_object('userId', link_record.user_id)
    );
    return jsonb_build_object(
      'ok', true,
      'status', 'already_active',
      'companyId', link_record.company_id,
      'userId', link_record.user_id
    );
  end if;

  select coalesce(array_agg(company_id), '{}'::uuid[])
  into old_active_company_ids
  from public.employee_company_links
  where user_id = link_record.user_id
    and status = 'active'
    and company_id <> link_record.company_id;

  update public.employee_company_links
  set status = 'rejected', updated_at = now()
  where user_id = link_record.user_id
    and status = 'active'
    and company_id <> link_record.company_id;

  select column_name, data_type
  into user_col, user_col_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'employees'
    and column_name in ('auth_user_id', 'user_id', 'userId', 'employee_id', 'employeeId', 'id')
  order by case column_name
    when 'auth_user_id' then 1
    when 'user_id' then 2
    when 'userId' then 3
    when 'employee_id' then 4
    when 'employeeId' then 5
    when 'id' then 6
    else 999
  end
  limit 1;

  select column_name, data_type
  into company_col, company_col_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'employees'
    and column_name in ('company_id', 'companyId')
  order by case column_name
    when 'company_id' then 1
    when 'companyId' then 2
    else 999
  end
  limit 1;

  if user_col is null or company_col is null then
    return jsonb_build_object(
      'ok', false,
      'status', 'missing_required_columns',
      'detail', 'employees table requires one user id column and one company id column'
    );
  end if;

  select column_name
  into email_col
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'employees'
    and column_name = 'email'
  limit 1;

  select column_name
  into full_name_col
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'employees'
    and column_name in ('full_name', 'name')
  order by case column_name
    when 'full_name' then 1
    when 'name' then 2
    else 999
  end
  limit 1;

  select column_name
  into status_col
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'employees'
    and column_name = 'status'
  limit 1;

  select
    au.email,
    coalesce(
      nullif(trim(au.raw_user_meta_data ->> 'full_name'), ''),
      link_record.requested_full_name
    )
  into user_email, user_full_name
  from auth.users au
  where au.id = link_record.user_id;

  where_user := case when user_col_type = 'uuid' then '$4::uuid' else '$5' end;
  where_company := case when company_col_type = 'uuid' then '$1::uuid' else '$6' end;

  set_parts := array_append(set_parts, format('%I = %s', company_col, where_company));
  if email_col is not null then
    set_parts := array_append(set_parts, format('%I = coalesce(%I, $2)', email_col, email_col));
  end if;
  if full_name_col is not null then
    set_parts := array_append(set_parts, format('%I = coalesce(%I, $3)', full_name_col, full_name_col));
  end if;
  if status_col is not null then
    set_parts := array_append(set_parts, format('%I = %L', status_col, 'active'));
  end if;

  execute format(
    'update public.employees set %s where %I = %s',
    array_to_string(set_parts, ', '),
    user_col,
    where_user
  )
  using
    link_record.company_id,
    user_email,
    user_full_name,
    link_record.user_id,
    link_record.user_id::text,
    link_record.company_id::text;

  get diagnostics rows_affected = row_count;

  if rows_affected = 0 then
    insert_cols := array_append(insert_cols, format('%I', user_col));
    insert_vals := array_append(insert_vals, where_user);
    insert_cols := array_append(insert_cols, format('%I', company_col));
    insert_vals := array_append(insert_vals, where_company);
    if email_col is not null then
      insert_cols := array_append(insert_cols, format('%I', email_col));
      insert_vals := array_append(insert_vals, '$2');
    end if;
    if full_name_col is not null then
      insert_cols := array_append(insert_cols, format('%I', full_name_col));
      insert_vals := array_append(insert_vals, '$3');
    end if;
    if status_col is not null then
      insert_cols := array_append(insert_cols, format('%I', status_col));
      insert_vals := array_append(insert_vals, quote_literal('active'));
    end if;

    execute format(
      'insert into public.employees (%s) values (%s)',
      array_to_string(insert_cols, ', '),
      array_to_string(insert_vals, ', ')
    )
    using
      link_record.company_id,
      user_email,
      user_full_name,
      link_record.user_id,
      link_record.user_id::text,
      link_record.company_id::text;
  end if;

  update public.employee_company_links
  set status = 'active', updated_at = now()
  where id = link_record.id;

  insert into public.company_link_audit_logs (company_id, actor_user_id, link_id, action, metadata)
  values (
    link_record.company_id,
    auth.uid(),
    link_record.id,
    'approved',
    jsonb_build_object(
      'userId', link_record.user_id,
      'previousActiveCompanyIds', old_active_company_ids
    )
  );

  return jsonb_build_object(
    'ok', true,
    'status', 'approved',
    'companyId', link_record.company_id,
    'userId', link_record.user_id,
    'previousCompanyIds', old_active_company_ids
  );
end;
$$;

revoke all on function public.approve_employee_company_link(uuid) from public;
revoke all on function public.approve_employee_company_link(uuid) from authenticated;
grant execute on function public.approve_employee_company_link(uuid) to service_role;

drop function if exists public.reject_employee_company_link(uuid, text);
create or replace function public.reject_employee_company_link(link_id uuid, reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  link_record public.employee_company_links%rowtype;
begin
  if link_id is null then
    raise exception 'link_id is required';
  end if;

  select *
  into link_record
  from public.employee_company_links
  where id = link_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'status', 'not_found');
  end if;

  if link_record.status <> 'pending' then
    return jsonb_build_object('ok', false, 'status', 'not_pending');
  end if;

  update public.employee_company_links
  set status = 'rejected', updated_at = now()
  where id = link_record.id;

  insert into public.company_link_audit_logs (company_id, actor_user_id, link_id, action, metadata)
  values (
    link_record.company_id,
    auth.uid(),
    link_record.id,
    'rejected',
    jsonb_build_object('reason', nullif(trim(reason), ''))
  );

  return jsonb_build_object(
    'ok', true,
    'status', 'rejected',
    'companyId', link_record.company_id,
    'userId', link_record.user_id
  );
end;
$$;

revoke all on function public.reject_employee_company_link(uuid, text) from public;
revoke all on function public.reject_employee_company_link(uuid, text) from authenticated;
grant execute on function public.reject_employee_company_link(uuid, text) to service_role;

drop function if exists public.get_employee_current_company_profile(uuid);
create or replace function public.get_employee_current_company_profile(target_company_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  resolved_company_id uuid;
  result jsonb;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  if target_company_id is not null then
    select ecl.company_id
    into resolved_company_id
    from public.employee_company_links ecl
    where ecl.user_id = caller_id
      and ecl.company_id = target_company_id
      and ecl.status = 'active'
    order by ecl.updated_at desc
    limit 1;
  end if;

  if resolved_company_id is null then
    select ecl.company_id
    into resolved_company_id
    from public.employee_company_links ecl
    where ecl.user_id = caller_id
      and ecl.status = 'active'
    order by ecl.updated_at desc
    limit 1;
  end if;

  if resolved_company_id is null then
    return null;
  end if;

  select to_jsonb(c)
  into result
  from public.companies c
  where c.id = resolved_company_id
  limit 1;

  return result;
end;
$$;

revoke all on function public.get_employee_current_company_profile(uuid) from public;
grant execute on function public.get_employee_current_company_profile(uuid) to authenticated;
