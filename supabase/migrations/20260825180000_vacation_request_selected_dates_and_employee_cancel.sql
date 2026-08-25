ALTER TABLE public.vacation_requests
  ADD COLUMN IF NOT EXISTS "selectedDates" jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vacation_requests_selected_dates_array'
      AND conrelid = 'public.vacation_requests'::regclass
  ) THEN
    ALTER TABLE public.vacation_requests
      ADD CONSTRAINT vacation_requests_selected_dates_array
      CHECK (jsonb_typeof("selectedDates") = 'array');
  END IF;
END $$;

DROP POLICY IF EXISTS "vacation_requests_employee_cancel" ON public.vacation_requests;
CREATE POLICY "vacation_requests_employee_cancel" ON public.vacation_requests
  FOR UPDATE
  USING (
    "employeeId" = auth.uid()
    AND status = 'pending'
  )
  WITH CHECK (
    "employeeId" = auth.uid()
    AND status = 'cancelled'
    AND "reviewedAt" IS NULL
    AND "reviewedBy" IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = auth.uid()
        AND e."companyId" = "companyId"
    )
  );
