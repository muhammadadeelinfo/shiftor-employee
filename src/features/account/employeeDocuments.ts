import { supabase, supabaseStorageBucket } from '@lib/supabaseClient';
import { getEmployeeApiBaseUrl } from './monthlyHours';

export type EmployeeDocumentType =
  | 'certificate-of-sickness'
  | 'id-passport'
  | 'contract'
  | 'proof-of-address'
  | 'other';

export type EmployeeDocumentTypeOption = {
  slug: EmployeeDocumentType;
  labelKey:
    | 'employeeDocumentsTypeCertificateOfSickness'
    | 'employeeDocumentsTypeIdPassport'
    | 'employeeDocumentsTypeContract'
    | 'employeeDocumentsTypeProofOfAddress'
    | 'employeeDocumentsTypeOther';
};

export const EMPLOYEE_DOCUMENT_TYPES: EmployeeDocumentTypeOption[] = [
  {
    slug: 'certificate-of-sickness',
    labelKey: 'employeeDocumentsTypeCertificateOfSickness',
  },
  {
    slug: 'id-passport',
    labelKey: 'employeeDocumentsTypeIdPassport',
  },
  {
    slug: 'contract',
    labelKey: 'employeeDocumentsTypeContract',
  },
  {
    slug: 'proof-of-address',
    labelKey: 'employeeDocumentsTypeProofOfAddress',
  },
  {
    slug: 'other',
    labelKey: 'employeeDocumentsTypeOther',
  },
];

export type EmployeeDocumentRecord = {
  id: string;
  companyId: string;
  employeeId: string;
  slug: string;
  fileName: string;
  storagePath: string;
  contentType: string | null;
  sizeBytes: number | null;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeDocumentContext = {
  id: string;
  companyId: string;
  firstName: string | null;
  lastName: string | null;
};

type Translate = (key: any, params?: Record<string, string | number>) => string;

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

const ensureClient = () => {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }
  return supabase;
};

const sanitizeFileName = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '');

const ensureApiBaseUrl = () => {
  const apiBaseUrl = getEmployeeApiBaseUrl();
  if (!apiBaseUrl) {
    throw new Error('Employee API base URL is not configured.');
  }
  return apiBaseUrl;
};

const isUnsupportedDocumentSlugError = (value: string) =>
  /unsupported document slug|unsupported slug|not supported/i.test(value);

export const getEmployeeDocumentType = (slug: string): EmployeeDocumentType => {
  const match = EMPLOYEE_DOCUMENT_TYPES.find((entry) => entry.slug === slug);
  return match?.slug ?? 'other';
};

export const getEmployeeDocumentTypeLabelKey = (slug: string): EmployeeDocumentTypeOption['labelKey'] => {
  const match = EMPLOYEE_DOCUMENT_TYPES.find((entry) => entry.slug === slug);
  return match?.labelKey ?? 'employeeDocumentsTypeOther';
};

export const formatEmployeeDocumentDateTime = (value: string, language: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
};

export const formatEmployeeDocumentFileSize = (value?: number | null) => {
  if (!value || value <= 0) return '-';
  if (value < 1024) return `${value} B`;
  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

export const validateEmployeeDocumentAsset = (
  asset: {
    name?: string | null;
    mimeType?: string | null;
    size?: number | null;
  } | null,
  t: Translate
) => {
  if (!asset?.name?.trim()) {
    return t('certificateOfSicknessInvalidFile');
  }
  const normalizedSize = typeof asset.size === 'number' && Number.isFinite(asset.size) ? asset.size : 0;
  if (normalizedSize > MAX_FILE_SIZE_BYTES) {
    return t('certificateOfSicknessFileTooLarge');
  }
  if (asset.mimeType && !ALLOWED_CONTENT_TYPES.has(asset.mimeType)) {
    return t('certificateOfSicknessUnsupportedType');
  }
  return null;
};

export const fetchEmployeeDocumentsContext = async (
  employeeId: string
): Promise<EmployeeDocumentContext | null> => {
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

  return data ? (data as EmployeeDocumentContext) : null;
};

const fetchDocumentsBySlug = async ({
  employeeId,
  accessToken,
  slug,
}: {
  employeeId: string;
  accessToken: string;
  slug: EmployeeDocumentType;
}) => {
  const apiBaseUrl = ensureApiBaseUrl();
  const response = await fetch(
    `${apiBaseUrl}/api/employees/documents/list?employeeId=${encodeURIComponent(employeeId)}&slug=${encodeURIComponent(slug)}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const payload = (await response.json()) as
    | { documents?: EmployeeDocumentRecord[]; error?: string }
    | undefined;

  if (!response.ok || !Array.isArray(payload?.documents)) {
    if (isUnsupportedDocumentSlugError(payload?.error || '')) {
      return [];
    }
    throw new Error(payload?.error || 'Unable to load employee documents.');
  }

  return payload.documents.filter((item) => item.uploadedBy === employeeId);
};

export const fetchEmployeeDocuments = async ({
  employeeId,
  accessToken,
}: {
  employeeId: string;
  accessToken: string;
}) => {
  const groups = await Promise.all(
    EMPLOYEE_DOCUMENT_TYPES.map((option) =>
      fetchDocumentsBySlug({
        employeeId,
        accessToken,
        slug: option.slug,
      })
    )
  );

  return groups
    .flat()
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
};

export const fetchEmployeeDocumentDownloadUrl = async ({
  accessToken,
  documentId,
}: {
  accessToken: string;
  documentId: string;
}) => {
  const apiBaseUrl = ensureApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/employees/documents/download`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ documentId }),
  });

  const payload = (await response.json()) as { signedUrl?: string; error?: string };
  if (!response.ok || !payload.signedUrl) {
    if (/not found/i.test(payload.error || '')) {
      return null;
    }
    throw new Error(payload.error || 'Unable to download document.');
  }

  return payload.signedUrl;
};

export const submitEmployeeDocument = async ({
  accessToken,
  companyId,
  employeeId,
  documentType,
  asset,
}: {
  accessToken: string;
  companyId: string;
  employeeId: string;
  documentType: EmployeeDocumentType;
  asset: {
    uri: string;
    name: string;
    mimeType?: string | null;
    size?: number | null;
  };
}) => {
  const client = ensureClient();
  const apiBaseUrl = ensureApiBaseUrl();
  const safeName = sanitizeFileName(asset.name) || `document-${Date.now()}.bin`;
  const storagePath = `companies/${companyId}/employees/${employeeId}/documents/${documentType}/${Date.now()}-${safeName}`;

  const fileResponse = await fetch(asset.uri);
  if (!fileResponse.ok) {
    throw new Error('Could not read the selected document file.');
  }
  const fileBlob = await fileResponse.blob();

  const { data: uploadData, error: uploadError } = await client.storage
    .from(supabaseStorageBucket)
    .upload(storagePath, fileBlob, {
      contentType: asset.mimeType || 'application/octet-stream',
      upsert: false,
    });

  if (uploadError || !uploadData?.path) {
    throw uploadError || new Error('Could not upload document file.');
  }

  const registerResponse = await fetch(`${apiBaseUrl}/api/employees/documents/register`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      employeeId,
      slug: documentType,
      fileName: asset.name,
      storagePath: uploadData.path,
      contentType: asset.mimeType || null,
      sizeBytes:
        typeof asset.size === 'number' && Number.isFinite(asset.size)
          ? Math.max(0, Math.trunc(asset.size))
          : null,
    }),
  });

  const registerPayload = (await registerResponse.json()) as { success?: boolean; error?: string };

  if (!registerResponse.ok || !registerPayload.success) {
    await client.storage.from(supabaseStorageBucket).remove([uploadData.path]).catch(() => null);
    if (isUnsupportedDocumentSlugError(registerPayload.error || '')) {
      throw new Error('DOCUMENT_TYPE_UNAVAILABLE');
    }
    throw new Error(registerPayload.error || 'Could not register document file.');
  }
};
