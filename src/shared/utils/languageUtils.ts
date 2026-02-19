export const languageDefinitions = [
  { code: 'en', shortLabel: 'EN', flag: '🇬🇧', labelKey: 'languageEnglish' },
  { code: 'de', shortLabel: 'DE', flag: '🇩🇪', labelKey: 'languageGerman' },
] as const;

export type LanguageCode = (typeof languageDefinitions)[number]['code'];

type TranslationVars = Record<string, string | number>;

const LANGUAGE_STORAGE_KEY_BASE = 'employee-portal-language';

export const getLanguageStorageKey = (employeeId?: string | null) =>
  employeeId ? `${LANGUAGE_STORAGE_KEY_BASE}:${employeeId}` : null;

export const isValidLanguage = (value: string | null): value is LanguageCode =>
  languageDefinitions.some((definition) => definition.code === value);

export const interpolate = (value: string, vars?: TranslationVars) => {
  if (!vars) return value;
  return Object.entries(vars).reduce(
    (text, [key, varValue]) => text.replace(`{${key}}`, String(varValue)),
    value
  );
};
