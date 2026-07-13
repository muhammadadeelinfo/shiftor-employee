export type EmployeeAvailabilityRecord = {
  id: string;
  companyId: string;
  employeeId: string;
  month: string;
  availableDates: string[];
  unavailableDates: string[];
  note: string | null;
  status: 'draft' | 'submitted' | 'reviewed';
  submittedAt: string | null;
};

export type EmployeeAvailabilityResponse = {
  employee?: {
    id: string;
    companyId: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  };
  availability: EmployeeAvailabilityRecord | null;
  monthDates: string[];
  setupRequired?: boolean;
};

export type ShiftSwapRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'cancelled';

export type ShiftSwapRequestRecord = {
  id: string;
  companyId: string;
  shiftId: string;
  assignmentId: string | null;
  sourceEmployeeId: string;
  preferredEmployeeId: string | null;
  reason: string | null;
  status: ShiftSwapRequestStatus;
  reviewNote: string | null;
  createdAt: string;
};

type Translate = (key: any, params?: Record<string, string | number>) => string;

const buildEmployeeApiUrl = (apiBaseUrl: string, path: string) => {
  const base = apiBaseUrl.trim().replace(/\/+$/, '');
  if (!base) {
    throw new Error('Missing API base URL.');
  }
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
};

const parseJson = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const getErrorMessage = (payload: unknown, fallback: string) => {
  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    typeof (payload as { error?: unknown }).error === 'string' &&
    (payload as { error: string }).error.trim()
  ) {
    return (payload as { error: string }).error.trim();
  }
  return fallback;
};

export const fetchEmployeeAvailability = async ({
  apiBaseUrl,
  accessToken,
  month,
  t,
}: {
  apiBaseUrl: string;
  accessToken?: string | null;
  month: string;
  t: Translate;
}): Promise<EmployeeAvailabilityResponse> => {
  const response = await fetch(
    buildEmployeeApiUrl(apiBaseUrl, `/api/employee/availability?month=${encodeURIComponent(month)}`),
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    }
  );
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(getErrorMessage(payload, t('availabilityLoadFailed')));
  }
  return payload as EmployeeAvailabilityResponse;
};

export const submitEmployeeAvailability = async ({
  apiBaseUrl,
  accessToken,
  month,
  availableDates,
  unavailableDates,
  note,
  t,
}: {
  apiBaseUrl: string;
  accessToken?: string | null;
  month: string;
  availableDates: string[];
  unavailableDates: string[];
  note?: string;
  t: Translate;
}): Promise<EmployeeAvailabilityRecord> => {
  const response = await fetch(buildEmployeeApiUrl(apiBaseUrl, '/api/employee/availability'), {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({
      month,
      availableDates,
      unavailableDates,
      note,
    }),
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(getErrorMessage(payload, t('availabilitySubmitFailed')));
  }
  return (payload as { availability: EmployeeAvailabilityRecord }).availability;
};

export const submitShiftSwapRequest = async ({
  apiBaseUrl,
  accessToken,
  shiftId,
  assignmentId,
  reason,
  t,
}: {
  apiBaseUrl: string;
  accessToken?: string | null;
  shiftId: string;
  assignmentId?: string | null;
  reason?: string;
  t: Translate;
}): Promise<ShiftSwapRequestRecord> => {
  const response = await fetch(buildEmployeeApiUrl(apiBaseUrl, '/api/employee/swap-requests'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({
      shiftId,
      assignmentId,
      reason,
    }),
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(getErrorMessage(payload, t('swapRequestSubmitFailed')));
  }
  return (payload as { request: ShiftSwapRequestRecord }).request;
};
