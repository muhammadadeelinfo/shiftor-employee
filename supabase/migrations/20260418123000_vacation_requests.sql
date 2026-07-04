CREATE TABLE IF NOT EXISTS public.vacation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  "employeeId" uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  "startDate" date NOT NULL,
  "endDate" date NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  "reviewedAt" timestamptz,
  "reviewedBy" uuid,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vacation_requests_date_order CHECK ("startDate" <= "endDate")
);
CREATE INDEX IF NOT EXISTS vacation_requests_employee_created_idx
  ON public.vacation_requests ("employeeId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS vacation_requests_company_created_idx
  ON public.vacation_requests ("companyId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS vacation_requests_company_employee_status_idx
  ON public.vacation_requests ("companyId", "employeeId", status);
ALTER TABLE public.vacation_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vacation_requests_select" ON public.vacation_requests
  FOR SELECT
  USING ("companyId" IN (SELECT public.get_company_ids_for_user()));
CREATE POLICY "vacation_requests_employee_insert" ON public.vacation_requests
  FOR INSERT
  WITH CHECK (
    "employeeId" = auth.uid()
    AND status = 'pending'
    AND "reviewedAt" IS NULL
    AND "reviewedBy" IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = auth.uid()
        AND e."companyId" = "companyId"
    )
  );
CREATE POLICY "vacation_requests_owner_update" ON public.vacation_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE c.id = "companyId"
        AND c."ownerId" = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE c.id = "companyId"
        AND c."ownerId" = auth.uid()
    )
  );
CREATE POLICY "vacation_requests_owner_delete" ON public.vacation_requests
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE c.id = "companyId"
        AND c."ownerId" = auth.uid()
    )
  );
