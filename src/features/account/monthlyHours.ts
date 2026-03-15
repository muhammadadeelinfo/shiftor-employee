import Constants from 'expo-constants';

export type MonthlyHoursSummary = {
  month: string;
  plannedMinutes: number;
  workedMinutes: number;
  deltaMinutes: number;
  shiftsCount: number;
  completeCount: number;
  openCount: number;
  missingCount: number;
  scheduledCount: number;
};

export type MonthlyHoursResponse = {
  employee: {
    id: string;
    companyId: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  };
  summary: MonthlyHoursSummary;
  objectTotals: Array<unknown>;
};

type Translate = (key: any, params?: Record<string, string | number>) => string;

export const formatMonthKey = (value: Date) =>
  `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;

export const getEmployeeApiBaseUrl = () => {
  const value = (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined)?.trim();
  return value ? value.replace(/\/+$/, '') : '';
};

export const formatMinutesLabel = (totalMinutes: number, t: Translate) => {
  const absoluteMinutes = Math.max(0, Math.round(Math.abs(totalMinutes)));
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;
  if (hours <= 0) {
    return t('qrClockOutWorkedMinutes', { minutes: absoluteMinutes });
  }
  if (minutes === 0) {
    return t('qrClockOutWorkedHours', { hours });
  }
  return t('qrClockOutWorkedHoursMinutes', { hours, minutes });
};

export const formatSignedMinutesLabel = (totalMinutes: number, t: Translate) => {
  if (totalMinutes === 0) {
    return t('accountMonthlyHoursOnTrack');
  }
  const prefix = totalMinutes > 0 ? '+' : '-';
  return `${prefix}${formatMinutesLabel(totalMinutes, t)}`;
};

export const formatMonthlyHoursMonthLabel = (
  monthKey: string,
  language: string
) => {
  const [yearRaw, monthRaw] = monthKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return monthKey;
  }
  return new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
};

export const fetchMonthlyHours = async ({
  apiBaseUrl,
  accessToken,
  month,
  t,
}: {
  apiBaseUrl: string;
  accessToken?: string | null;
  month: string;
  t: Translate;
}): Promise<MonthlyHoursResponse> => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  const response = await fetch(
    `${apiBaseUrl}/api/employee/monthly-hours?month=${encodeURIComponent(month)}`,
    {
      method: 'GET',
      headers,
    }
  );
  if (!response.ok) {
    throw new Error(t('accountMonthlyHoursLoadFailed'));
  }
  return (await response.json()) as MonthlyHoursResponse;
};
