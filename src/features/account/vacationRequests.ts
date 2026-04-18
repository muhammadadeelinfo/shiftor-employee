import { supabase, supabaseStorageBucket } from '@lib/supabaseClient';

export type VacationRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type VacationRequestRecord = {
  id: string;
  companyId: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  note: string | null;
  status: VacationRequestStatus;
  reviewedAt: string | null;
  reviewedBy: string | null;
  createdAt: string;
};

export type VacationRequestContext = {
  id: string;
  companyId: string;
  firstName: string | null;
  lastName: string | null;
};

const SUPABASE_UNAVAILABLE_MESSAGE = 'Supabase client is not configured.';
const VACATION_REQUESTS_UNAVAILABLE_MESSAGE = 'Vacation requests are not available yet.';

const ensureClient = () => {
  if (!supabase) {
    throw new Error(SUPABASE_UNAVAILABLE_MESSAGE);
  }
  return supabase;
};

export const toDateOnlyString = (value: Date) => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatVacationDate = (value: string, language: string) => {
  const parts = value.split('-').map((entry) => Number(entry));
  const parsed =
    parts.length === 3 && parts.every((entry) => Number.isFinite(entry))
      ? new Date(parts[0], parts[1] - 1, parts[2])
      : new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(parsed);
};

export const formatVacationRange = (startDate: string, endDate: string, language: string) => {
  const startLabel = formatVacationDate(startDate, language);
  const endLabel = formatVacationDate(endDate, language);
  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
};

const buildVacationApprovalDocumentFileName = (requestId: string) =>
  `vacation-approval-letter-${requestId}.pdf`;

const buildVacationApprovalDocumentStoragePath = (
  companyId: string,
  employeeId: string,
  requestId: string
) =>
  `companies/${companyId}/employees/${employeeId}/documents/vacation-requests/${buildVacationApprovalDocumentFileName(requestId)}`;

export const fetchVacationRequestContext = async (
  employeeId: string
): Promise<VacationRequestContext | null> => {
  const client = ensureClient();
  const { data, error } = await client
    .from('employees')
    .select('id,companyId,firstName,lastName')
    .eq('id', employeeId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? (data as VacationRequestContext) : null;
};

export const fetchVacationRequests = async (
  employeeId: string
): Promise<VacationRequestRecord[]> => {
  const client = ensureClient();
  const { data, error } = await client
    .from('vacation_requests')
    .select('id,companyId,employeeId,startDate,endDate,note,status,reviewedAt,reviewedBy,createdAt')
    .eq('employeeId', employeeId)
    .order('createdAt', { ascending: false });

  if (error) {
    if (/vacation_requests/i.test(error.message) && /schema cache|could not find the table/i.test(error.message)) {
      return [];
    }
    throw error;
  }

  return Array.isArray(data) ? (data as VacationRequestRecord[]) : [];
};

export const fetchVacationApprovalLetterUrl = async ({
  companyId,
  employeeId,
  requestId,
}: {
  companyId: string;
  employeeId: string;
  requestId: string;
}) => {
  const client = ensureClient();
  const storagePath = buildVacationApprovalDocumentStoragePath(companyId, employeeId, requestId);
  const { data, error } = await client.storage
    .from(supabaseStorageBucket)
    .createSignedUrl(storagePath, 60 * 10, {
      download: buildVacationApprovalDocumentFileName(requestId),
    });

  if (error) {
    if (/not found|object not found/i.test(error.message)) {
      return null;
    }
    throw error;
  }

  return data?.signedUrl ?? null;
};

export const submitVacationRequest = async ({
  companyId,
  employeeId,
  startDate,
  endDate,
  note,
}: {
  companyId: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  note?: string;
}) => {
  const client = ensureClient();
  const trimmedNote = typeof note === 'string' && note.trim() ? note.trim() : null;
  const { data, error } = await client
    .from('vacation_requests')
    .insert({
      companyId,
      employeeId,
      startDate,
      endDate,
      note: trimmedNote,
      status: 'pending',
    })
    .select('id,companyId,employeeId,startDate,endDate,note,status,reviewedAt,reviewedBy,createdAt')
    .limit(1)
    .single();

  if (error) {
    if (/vacation_requests/i.test(error.message) && /schema cache|could not find the table/i.test(error.message)) {
      throw new Error(VACATION_REQUESTS_UNAVAILABLE_MESSAGE);
    }
    throw error;
  }

  return data as VacationRequestRecord;
};
