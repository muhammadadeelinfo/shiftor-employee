-- Allow authenticated employees to confirm only their own shift assignments.
-- Run this in the Supabase SQL editor for the same project used by the employee app.

alter table public.shift_assignments enable row level security;

drop policy if exists "Employees can view own shift assignments" on public.shift_assignments;
create policy "Employees can view own shift assignments"
  on public.shift_assignments
  for select
  using ("employeeId" = auth.uid());

drop policy if exists "Employees can confirm own shift assignments" on public.shift_assignments;
create policy "Employees can confirm own shift assignments"
  on public.shift_assignments
  for update
  using ("employeeId" = auth.uid())
  with check ("employeeId" = auth.uid());

comment on policy "Employees can confirm own shift assignments" on public.shift_assignments is
  'Allows an authenticated employee to update confirmationStatus/confirmedAt on their own shift assignment rows.';
