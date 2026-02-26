# Company Linking Setup

This setup enables public self-signup while still linking users to client companies.

## 1. Apply SQL

Run:

- [supabase/company-linking.sql](/Users/adeel/Documents/shiftor-employee/supabase/company-linking.sql)

in the Supabase SQL editor for your production project.

## 2. Add company join codes

Each client company needs at least one join code:

```sql
insert into public.company_join_codes (company_id, code, is_active)
values ('<company-uuid>', 'SHIFTOR-ACME', true);
```

Codes are case-insensitive in the RPC.

## 3. User flow

1. User self-signs up in app and enters optional company code.
2. App stores that code in Supabase user metadata.
3. On first login, app calls `request_employee_company_link(join_code, full_name)`.
4. A row is created in `employee_company_links` with `status = 'pending'`.

## 4. Approve links (admin workflow)

Review pending requests:

```sql
select id, user_id, company_id, status, requested_code, requested_email, created_at
from public.employee_company_links
where status = 'pending'
order by created_at asc;
```

Approve and provision employee row automatically:

```sql
select public.approve_employee_company_link('<link-id-uuid>');
```

This function:

- marks `employee_company_links.status = 'active'`
- creates or updates a matching row in `public.employees`
- maps user/company columns dynamically (`auth_user_id` / `user_id` / `employee_id` / `id`, and `company_id` / `companyId`)
- fills `email`, `full_name` or `name`, and `status` when those columns exist

To reject a request manually:

```sql
update public.employee_company_links
set status = 'rejected', updated_at = now()
where id = '<link-id-uuid>';
```
