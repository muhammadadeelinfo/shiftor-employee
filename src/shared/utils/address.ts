export type AddressParts = {
  label: string;
  meta: string;
};

export const splitAddressIntoLabelMeta = (displayName: string): AddressParts => {
  const parts = displayName
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) {
    return { label: displayName, meta: '' };
  }
  const mainParts = parts.slice(0, 2);
  let label = mainParts.join(', ');
  if (mainParts.length >= 2 && /^\d/.test(mainParts[0])) {
    label = `${mainParts[1]} ${mainParts[0]}`;
  }
  if (!label) {
    label = displayName;
  }
  const metaStart = Math.max(2, parts.length - 2);
  const metaParts = parts.slice(metaStart);
  const filteredMeta = metaParts.filter((part) => !mainParts.includes(part));
  const meta = filteredMeta.join(', ');
  return { label, meta };
};

export const formatAddress = (value?: string | null): AddressParts | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return splitAddressIntoLabelMeta(trimmed);
};
