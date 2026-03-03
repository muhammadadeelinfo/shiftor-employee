import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type StartupJob = {
  id: string;
  companyId: string;
  companyName?: string | null;
  companyNameSnapshot?: string | null;
  companyLogoUrlSnapshot?: string | null;
  title: string;
  summary: string | null;
  description: string | null;
  location: string | null;
  employmentType: string | null;
  salaryText: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  isActive: boolean;
  publishAt: string | null;
  expiresAt: string | null;
  priority: number;
  createdAt: string;
  updatedAt: string;
};

export type StartupJobsResponse = {
  jobs?: StartupJob[];
};

type StartupJobsRequestOptions = {
  limit?: number;
  jobId?: string | null;
};

const normalizeSearchText = (value?: string | null): string =>
  (value ?? '')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const isLikelyDemoJob = (job: StartupJob): boolean => {
  const title = normalizeSearchText(job.title);
  const summary = normalizeSearchText(job.summary);
  const description = normalizeSearchText(job.description);
  const employmentType = normalizeSearchText(job.employmentType);
  const location = normalizeSearchText(job.location);

  const titleLooksSynthetic =
    title.includes('(test)') ||
    title.includes('(demo)') ||
    title.startsWith('test job');

  const contentLooksSynthetic =
    summary.includes('system demonstration') ||
    summary.includes('qa purposes') ||
    description.includes('dummy listing') ||
    description.includes('test data') ||
    description.includes('not a real job opening');

  const metadataLooksSynthetic =
    employmentType.includes('(test)') || location.includes('(test location)');

  return titleLooksSynthetic || contentLooksSynthetic || metadataLooksSynthetic;
};

const isLocalhostHost = (host: string): boolean => {
  const normalized = host.trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
};

const extractHostFromHostUri = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withoutProtocol = trimmed.replace(/^[a-z]+:\/\//i, '');
  const [host] = withoutProtocol.split('/');
  if (!host) return null;
  return host.split(':')[0] ?? null;
};

const resolveExpoDevHost = (): string | null => {
  const candidates = [
    Constants.expoConfig?.hostUri,
    (Constants as unknown as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } }).manifest2?.extra
      ?.expoGo?.debuggerHost,
    (Constants as unknown as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost,
  ];

  for (const candidate of candidates) {
    const host = extractHostFromHostUri(candidate);
    if (host && !isLocalhostHost(host)) {
      return host;
    }
  }

  return null;
};

const resolveApiOriginForDevice = (value: string): string => {
  if (Platform.OS === 'web') {
    return value;
  }

  try {
    const parsed = new URL(value);
    if (!isLocalhostHost(parsed.hostname)) {
      return value;
    }

    const resolvedHost = resolveExpoDevHost();
    if (!resolvedHost) {
      return value;
    }

    parsed.hostname = resolvedHost;
    return parsed.origin;
  } catch {
    return value;
  }
};

export const getApiOrigin = (): string | null => {
  const explicitBaseUrl = (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined)?.trim();
  if (explicitBaseUrl) {
    return resolveApiOriginForDevice(explicitBaseUrl.replace(/\/+$/, ''));
  }

  const redirectUrl = (Constants.expoConfig?.extra?.authRedirectUrl as string | undefined)?.trim();
  if (!redirectUrl) {
    return Platform.OS === 'web' ? '' : null;
  }

  try {
    const parsed = new URL(redirectUrl);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.origin;
    }
  } catch {
    // Ignore malformed URL and fallback below.
  }

  return Platform.OS === 'web' ? '' : null;
};

export const buildStartupJobsEndpoint = (
  options: StartupJobsRequestOptions = {}
): string | null => {
  const origin = getApiOrigin();
  if (origin === null) {
    return null;
  }

  const params = new URLSearchParams();
  params.set('startup', 'true');

  if (typeof options.limit === 'number' && Number.isFinite(options.limit) && options.limit > 0) {
    params.set('limit', String(Math.floor(options.limit)));
  }

  if (options.jobId?.trim()) {
    params.set('jobId', options.jobId.trim());
  }

  return `${origin}/api/jobs/list?${params.toString()}`;
};

export const buildStartupJobApplyEndpoint = (): string | null => {
  const origin = getApiOrigin();
  if (origin === null) {
    return null;
  }

  return `${origin}/api/jobs/apply`;
};

export const normalizeStartupJobs = (payload: StartupJobsResponse): StartupJob[] => {
  if (!Array.isArray(payload.jobs)) {
    return [];
  }

  // Hide seeded demo/test jobs from the public jobs surfaces.
  return payload.jobs
    .map((job) => ({
      ...job,
      companyName: job.companyName ?? job.companyNameSnapshot ?? null,
    }))
    .filter((job) => !isLikelyDemoJob(job));
};

export const resolveStartupJobCtaUrl = (rawUrl?: string | null): string | null => {
  if (!rawUrl) return null;
  const value = rawUrl.trim();
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith('//')) {
    return `https:${value}`;
  }

  const origin = getApiOrigin();
  if (value.startsWith('/')) {
    if (!origin) return null;
    return `${origin}${value}`;
  }

  return `https://${value}`;
};

export const serializeStartupJob = (job: StartupJob): string => encodeURIComponent(JSON.stringify(job));

export const deserializeStartupJob = (value?: string | string[] | null): StartupJob | null => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (!rawValue) return null;

  try {
    return JSON.parse(decodeURIComponent(rawValue)) as StartupJob;
  } catch {
    return null;
  }
};
