-- Persist employee self-profile updates (including profile photo URL/path)
-- Run in Supabase SQL editor.

drop function if exists public.update_employee_self_profile(text, text, text, text, text, text, text, text);
create or replace function public.update_employee_self_profile(
  first_name text default null,
  last_name text default null,
  full_name text default null,
  mobile_number text default null,
  address_text text default null,
  birth_date text default null,
  profile_photo_url text default null,
  profile_photo_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  caller_email text;
  target_employee_id uuid;
  target_email text;
  lookup_column text;
  update_column text;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  select email into caller_email from auth.users where id = caller_id;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employees'
      and column_name = 'id'
  ) then
    execute 'select id, email from public.employees where id = $1 order by id limit 1'
      into target_employee_id, target_email
      using caller_id;
  end if;

  if target_employee_id is null then
    select column_name
    into lookup_column
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employees'
      and column_name = any (array['user_id','userId','auth_user_id','authUserId'])
    order by array_position(array['user_id','userId','auth_user_id','authUserId'], column_name)
    limit 1;

    if lookup_column is not null then
      execute format('select id, email from public.employees where %I = $1 order by id limit 1', lookup_column)
        into target_employee_id, target_email
        using caller_id;
    end if;
  end if;

  if target_employee_id is null and caller_email is not null and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employees'
      and column_name = 'email'
  ) then
    execute 'select id, email from public.employees where lower(email) = lower($1) order by id limit 1'
      into target_employee_id, target_email
      using caller_email;
  end if;

  if target_employee_id is null then
    return jsonb_build_object('ok', false, 'status', 'employee_not_found');
  end if;

  -- first name
  select column_name into update_column
  from information_schema.columns
  where table_schema = 'public' and table_name = 'employees'
    and column_name = any (array['first_name','firstName','name'])
  order by array_position(array['first_name','firstName','name'], column_name)
  limit 1;
  if update_column is not null and first_name is not null then
    execute format('update public.employees set %I = $1 where id = $2', update_column)
      using first_name, target_employee_id;
  end if;

  -- last name
  select column_name into update_column
  from information_schema.columns
  where table_schema = 'public' and table_name = 'employees'
    and column_name = any (array['last_name','lastName'])
  order by array_position(array['last_name','lastName'], column_name)
  limit 1;
  if update_column is not null and last_name is not null then
    execute format('update public.employees set %I = $1 where id = $2', update_column)
      using last_name, target_employee_id;
  end if;

  -- full name
  select column_name into update_column
  from information_schema.columns
  where table_schema = 'public' and table_name = 'employees'
    and column_name = any (array['name','full_name'])
  order by array_position(array['name','full_name'], column_name)
  limit 1;
  if update_column is not null and full_name is not null then
    execute format('update public.employees set %I = $1 where id = $2', update_column)
      using full_name, target_employee_id;
  end if;

  -- mobile
  select column_name into update_column
  from information_schema.columns
  where table_schema = 'public' and table_name = 'employees'
    and column_name = any (array['mobile','phone','phone_number','phoneNumber'])
  order by array_position(array['mobile','phone','phone_number','phoneNumber'], column_name)
  limit 1;
  if update_column is not null and mobile_number is not null then
    execute format('update public.employees set %I = $1 where id = $2', update_column)
      using mobile_number, target_employee_id;
  end if;

  -- address
  select column_name into update_column
  from information_schema.columns
  where table_schema = 'public' and table_name = 'employees'
    and column_name = any (array['address','full_address','fullAddress','street_address','streetAddress','location'])
  order by array_position(array['address','full_address','fullAddress','street_address','streetAddress','location'], column_name)
  limit 1;
  if update_column is not null and address_text is not null then
    execute format('update public.employees set %I = $1 where id = $2', update_column)
      using address_text, target_employee_id;
  end if;

  -- dob
  select column_name into update_column
  from information_schema.columns
  where table_schema = 'public' and table_name = 'employees'
    and column_name = any (array['dob','date_of_birth','dateOfBirth','birthDate'])
  order by array_position(array['dob','date_of_birth','dateOfBirth','birthDate'], column_name)
  limit 1;
  if update_column is not null and birth_date is not null then
    execute format('update public.employees set %I = $1 where id = $2', update_column)
      using birth_date, target_employee_id;
  end if;

  -- photo url
  select column_name into update_column
  from information_schema.columns
  where table_schema = 'public' and table_name = 'employees'
    and column_name = any (array['photo_url','photoUrl','avatar_url','avatarUrl'])
  order by array_position(array['photo_url','photoUrl','avatar_url','avatarUrl'], column_name)
  limit 1;
  if update_column is not null then
    execute format('update public.employees set %I = $1 where id = $2', update_column)
      using profile_photo_url, target_employee_id;
  end if;

  -- photo path
  select column_name into update_column
  from information_schema.columns
  where table_schema = 'public' and table_name = 'employees'
    and column_name = any (array['photo_path','photoPath','avatar_path','avatarPath'])
  order by array_position(array['photo_path','photoPath','avatar_path','avatarPath'], column_name)
  limit 1;
  if update_column is not null then
    execute format('update public.employees set %I = $1 where id = $2', update_column)
      using profile_photo_path, target_employee_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', 'updated',
    'employeeId', target_employee_id,
    'email', target_email
  );
end;
$$;

revoke all on function public.update_employee_self_profile(text, text, text, text, text, text, text, text) from public;
grant execute on function public.update_employee_self_profile(text, text, text, text, text, text, text, text) to authenticated;
