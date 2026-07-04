export type EmployeeProfile = Record<string, unknown>;

type AccountUser = {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
};

export const normalizeContactString = (value?: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

export const capitalizeFirstLetter = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return value;
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
};

export const getProfilePhotoCacheKey = (userId: string) => `employee-profile-photo:${userId}`;

export const getCanonicalPublicStorageUrl = (baseUrl: string, bucket: string, path: string) =>
  `${baseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${encodeURIComponent(bucket)}/${path
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')}`;

export const deriveStoragePathFromUrl = (url: string | null | undefined, bucket: string) => {
  if (!url) return null;
  try {
    const path = new URL(url).pathname;
    const markers = [
      `/storage/v1/object/public/${bucket}/`,
      `/storage/v1/object/sign/${bucket}/`,
      `/storage/v1/render/image/public/${bucket}/`,
    ];
    const marker = markers.find((candidate) => path.includes(candidate));
    return marker ? decodeURIComponent(path.split(marker)[1] || '').trim() || null : null;
  } catch {
    return null;
  }
};

export const getStringField = (source?: Record<string, unknown>, key?: string) => {
  if (!source || !key) return undefined;
  const value = source[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const formatAddressParts = (parts: {
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city?: string;
  state?: string;
  country?: string;
}) => {
  const streetLine = [parts.street, parts.houseNumber].filter(Boolean).join(' ').trim();
  const cityLine = [parts.postalCode, parts.city].filter(Boolean).join(' ').trim();
  return [streetLine, cityLine, parts.state, parts.country].filter(Boolean).join(', ');
};

const getNestedString = (source: unknown, path: string[]): string | undefined => {
  let cursor: unknown = source;
  for (const key of path) {
    if (!cursor || typeof cursor !== 'object' || !(key in (cursor as Record<string, unknown>))) return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return typeof cursor === 'string' && cursor.trim() ? cursor.trim() : undefined;
};

const formatMetadataAddress = (metadata?: Record<string, unknown>) => {
  if (!metadata) return undefined;
  const addressCandidate = metadata.address;
  if (typeof addressCandidate === 'string' && addressCandidate.trim()) return addressCandidate.trim();
  if (addressCandidate && typeof addressCandidate === 'object') {
    const address = addressCandidate as Record<string, unknown>;
    const structured = formatAddressParts({
      street: getStringField(address, 'street') ?? getStringField(address, 'line1') ?? getStringField(address, 'addressLine1'),
      houseNumber: getStringField(address, 'house_number') ?? getStringField(address, 'houseNumber'),
      postalCode: getStringField(address, 'postal_code') ?? getStringField(address, 'postalCode'),
      city: getStringField(address, 'city'),
      state: getStringField(address, 'state'),
      country: getStringField(address, 'country'),
    });
    if (structured) return structured;
  }
  return formatAddressParts({
    street: getStringField(metadata, 'street'),
    houseNumber: getStringField(metadata, 'house_number') ?? getStringField(metadata, 'houseNumber'),
    postalCode: getStringField(metadata, 'postal_code') ?? getStringField(metadata, 'postalCode'),
    city: getStringField(metadata, 'city'),
    state: getStringField(metadata, 'state'),
    country: getStringField(metadata, 'country'),
  }) || getStringField(metadata, 'location');
};

export const getProfilePhone = (profile?: EmployeeProfile | null) =>
  profile
    ? ['mobile', 'phone', 'phone_number', 'phoneNumber', 'telephone', 'contact_phone', 'contactPhone']
        .map((key) => getStringField(profile, key))
        .find(Boolean)
    : undefined;

export const getProfileAddress = (profile?: EmployeeProfile | null) => {
  if (!profile) return undefined;
  const direct = ['address', 'full_address', 'fullAddress', 'location', 'street_address', 'streetAddress']
    .map((key) => getStringField(profile, key))
    .find(Boolean);
  return direct || formatAddressParts({
    street: getStringField(profile, 'street') ?? getStringField(profile, 'line1') ?? getStringField(profile, 'addressLine1'),
    houseNumber: getStringField(profile, 'house_number') ?? getStringField(profile, 'houseNumber'),
    postalCode: getStringField(profile, 'postal_code') ?? getStringField(profile, 'postalCode'),
    city: getStringField(profile, 'city'),
    state: getStringField(profile, 'state'),
    country: getStringField(profile, 'country'),
  });
};

export const getMetadataPhoneDeep = (metadata?: Record<string, unknown>) =>
  getStringField(metadata, 'phone') ?? getStringField(metadata, 'phone_number') ??
  getStringField(metadata, 'mobile') ?? getStringField(metadata, 'phoneNumber') ??
  getNestedString(metadata, ['contact', 'phone']) ?? getNestedString(metadata, ['contact', 'mobile']) ??
  getNestedString(metadata, ['profile', 'phone']) ?? getNestedString(metadata, ['profile', 'mobile']);

export const getMetadataAddressDeep = (metadata?: Record<string, unknown>) =>
  formatMetadataAddress(metadata) ?? getNestedString(metadata, ['contact', 'address']) ??
  getNestedString(metadata, ['profile', 'address']) ?? getNestedString(metadata, ['address', 'formatted']);

export const profileName = (user: AccountUser | null) => {
  if (!user) return 'Guest';
  const metadataName = user.user_metadata?.full_name;
  return capitalizeFirstLetter(
    typeof metadataName === 'string' && metadataName.trim()
      ? metadataName
      : user.email?.split('@')[0] ?? 'Employee'
  );
};

export const shiftStatus = (metadata?: Record<string, unknown> | null) => {
  const value = metadata?.status;
  return typeof value === 'string' && value.trim() ? value : 'Active';
};
