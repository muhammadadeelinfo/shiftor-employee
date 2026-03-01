type GenericRecord = Record<string, unknown>;

export type CompanyDisplaySnapshot = {
  linkedCompanyId: string | null;
  name: string;
  address: string;
  logoUrl?: string;
};

const getStringField = (source?: GenericRecord | null, key?: string) => {
  if (!source || !key) return undefined;
  const value = source[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const getNestedString = (source: unknown, path: string[]): string | undefined => {
  let cursor: unknown = source;
  for (const key of path) {
    if (!cursor || typeof cursor !== 'object' || !(key in (cursor as GenericRecord))) {
      return undefined;
    }
    cursor = (cursor as GenericRecord)[key];
  }
  return typeof cursor === 'string' && cursor.trim() ? cursor.trim() : undefined;
};

export const getLinkedCompanyIdFromSources = (profile?: GenericRecord | null, metadata?: GenericRecord) =>
  getStringField(profile ?? undefined, 'companyId') ??
  getStringField(profile ?? undefined, 'company_id') ??
  getStringField(metadata, 'companyId') ??
  getStringField(metadata, 'company_id') ??
  getNestedString(metadata, ['currentCompany', 'id']) ??
  getNestedString(metadata, ['company', 'id']);

const getCompanyNameFromMetadata = (metadata?: GenericRecord) =>
  getStringField(metadata, 'companyName') ??
  getStringField(metadata, 'company_name') ??
  getStringField(metadata, 'companyDisplayName') ??
  getStringField(metadata, 'company_display_name') ??
  getNestedString(metadata, ['company', 'name']) ??
  getNestedString(metadata, ['company', 'companyName']) ??
  getNestedString(metadata, ['company', 'company_name']) ??
  getNestedString(metadata, ['company', 'displayName']) ??
  getNestedString(metadata, ['company', 'display_name']) ??
  getNestedString(metadata, ['currentCompany', 'name']) ??
  getNestedString(metadata, ['currentCompany', 'companyName']) ??
  getNestedString(metadata, ['currentCompany', 'company_name']) ??
  getNestedString(metadata, ['currentCompany', 'displayName']) ??
  getNestedString(metadata, ['currentCompany', 'display_name']);

const getCompanyAddress = (source?: GenericRecord | null) => {
  if (!source) return undefined;
  const direct = [
    'address',
    'full_address',
    'fullAddress',
    'street_address',
    'streetAddress',
    'location',
  ]
    .map((key) => getStringField(source, key))
    .find(Boolean);
  if (direct) return direct;

  const composed = [
    'line1',
    'line2',
    'street',
    'city',
    'state',
    'postal_code',
    'postalCode',
    'country',
  ]
    .map((key) => getStringField(source, key))
    .filter((part): part is string => Boolean(part));
  return composed.length ? composed.join(', ') : undefined;
};

const getEmployeeCompanyAddress = (source?: GenericRecord | null) => {
  if (!source) return undefined;

  const direct = [
    'companyAddress',
    'company_address',
    'companyFullAddress',
    'company_full_address',
    'companyStreetAddress',
    'company_street_address',
    'companyLocation',
    'company_location',
  ]
    .map((key) => getStringField(source, key))
    .find(Boolean);
  if (direct) return direct;

  const composed = [
    'companyLine1',
    'company_line1',
    'companyLine2',
    'company_line2',
    'companyStreet',
    'company_street',
    'companyCity',
    'company_city',
    'companyState',
    'company_state',
    'companyPostalCode',
    'company_postal_code',
    'companyCountry',
    'company_country',
  ]
    .map((key) => getStringField(source, key))
    .filter((part): part is string => Boolean(part));

  return composed.length ? composed.join(', ') : undefined;
};

const getCompanyAddressFromMetadata = (metadata?: GenericRecord) =>
  getStringField(metadata, 'companyAddress') ??
  getStringField(metadata, 'company_address') ??
  getStringField(metadata, 'companyFullAddress') ??
  getStringField(metadata, 'company_full_address') ??
  getStringField(metadata, 'companyStreetAddress') ??
  getStringField(metadata, 'company_street_address') ??
  getNestedString(metadata, ['company', 'address']) ??
  getNestedString(metadata, ['company', 'fullAddress']) ??
  getNestedString(metadata, ['company', 'full_address']) ??
  getNestedString(metadata, ['company', 'streetAddress']) ??
  getNestedString(metadata, ['company', 'street_address']) ??
  getNestedString(metadata, ['currentCompany', 'address']) ??
  getNestedString(metadata, ['currentCompany', 'fullAddress']) ??
  getNestedString(metadata, ['currentCompany', 'full_address']) ??
  getNestedString(metadata, ['currentCompany', 'streetAddress']) ??
  getNestedString(metadata, ['currentCompany', 'street_address']);

export const resolveCompanyDisplaySnapshot = (params: {
  companySummary?: GenericRecord | null;
  employeeRecord?: GenericRecord | null;
  metadata?: GenericRecord;
  fallbackName: string;
  fallbackAddress: string;
}): CompanyDisplaySnapshot => {
  const { companySummary, employeeRecord, metadata, fallbackName, fallbackAddress } = params;
  const linkedCompanyId = getLinkedCompanyIdFromSources(employeeRecord, metadata);
  const name =
    getStringField(companySummary ?? undefined, 'name') ??
    getStringField(companySummary ?? undefined, 'companyName') ??
    getStringField(companySummary ?? undefined, 'company_name') ??
    getStringField(companySummary ?? undefined, 'displayName') ??
    getStringField(companySummary ?? undefined, 'display_name') ??
    getStringField(employeeRecord ?? undefined, 'companyName') ??
    getStringField(employeeRecord ?? undefined, 'company_name') ??
    getStringField(employeeRecord ?? undefined, 'companyDisplayName') ??
    getStringField(employeeRecord ?? undefined, 'company_display_name') ??
    getCompanyNameFromMetadata(metadata) ??
    fallbackName;
  const address =
    getCompanyAddress(companySummary ?? undefined) ??
    getEmployeeCompanyAddress(employeeRecord ?? undefined) ??
    getCompanyAddressFromMetadata(metadata) ??
    fallbackAddress;
  const logoUrl =
    getStringField(companySummary ?? undefined, 'logo_url') ??
    getStringField(companySummary ?? undefined, 'logoUrl') ??
    getStringField(companySummary ?? undefined, 'logo') ??
    getStringField(employeeRecord ?? undefined, 'companyLogoUrl') ??
    getStringField(employeeRecord ?? undefined, 'company_logo_url') ??
    getStringField(employeeRecord ?? undefined, 'companyLogo') ??
    getStringField(employeeRecord ?? undefined, 'company_logo');

  return {
    linkedCompanyId: linkedCompanyId ?? null,
    name,
    address,
    logoUrl: logoUrl ?? undefined,
  };
};
