export type ImportedCalendar = {
  id: string;
  title: string;
  sourceName?: string;
};

const isImportedCalendar = (value: unknown): value is ImportedCalendar => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ImportedCalendar>;
  return typeof candidate.id === 'string' && typeof candidate.title === 'string';
};

export const toggleCalendarSelectionInList = (
  current: ImportedCalendar[],
  calendar: ImportedCalendar
): ImportedCalendar[] => {
  const exists = current.some((entry) => entry.id === calendar.id);
  if (exists) {
    return current.filter((entry) => entry.id !== calendar.id);
  }
  return [...current, calendar];
};

export const parseStoredCalendarSelection = (raw: string | null): ImportedCalendar[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isImportedCalendar);
  } catch {
    return [];
  }
};
