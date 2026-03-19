export const SUPPORT_EMAIL = 'support@goilabs.com';
export const SUPPORT_FALLBACK_URL = 'https://goilabs.com';

export const buildSupportMailto = (subject: string, body?: string) => {
  const query = new URLSearchParams();
  query.set('subject', subject);
  if (body) {
    query.set('body', body);
  }
  const suffix = query.toString();
  return `mailto:${SUPPORT_EMAIL}${suffix ? `?${suffix}` : ''}`;
};
