import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

export const languageDefinitions = [
  { code: 'en', shortLabel: 'EN', flag: '🇬🇧', labelKey: 'languageEnglish' },
  { code: 'de', shortLabel: 'DE', flag: '🇩🇪', labelKey: 'languageGerman' },
] as const;
export type LanguageCode = (typeof languageDefinitions)[number]['code'];

type TranslationVars = Record<string, string | number>;

const translations = {
  en: {
    languageLabel: 'Language',
    languageEnglish: 'English',
    languageGerman: 'Deutsch',
    upcomingShifts: 'Upcoming Shifts',
    enableLocationHint: 'Enable location to see nearby shifts',
    locationCoordinates: 'Location: {coords}',
    locationUnknown: 'Location data unavailable',
    listView: 'List view',
    calendarView: 'Calendar view',
    shiftOverview: 'Shift overview',
    shiftPlanningSubtitle: 'Shift planning & updates',
    stageLabel: 'Stage',
    countdownLabel: 'Countdown',
    timingSnapshot: 'Timing snapshot',
    dayLabel: 'Day',
    prepLabel: 'Prep',
    focusPointsLabel: 'Focus points',
    whereLabel: "Where you'll be",
    openInMaps: 'Open in maps',
    whatYoullDoLabel: 'What you’ll do',
    noDescription:
      'No description was provided. Touch base with operations if you need the rundown.',
    needAHand: 'Need a hand?',
    reachOutCopy:
      'Reach out to {contact} if anything changes or if you need a quick refresher before clocking in.',
    callLabel: 'Call',
    emailLabel: 'Email',
    cta: 'Clock in with QR',
    arriveTip: 'Arrive 10 minutes early',
    badgeTip: 'Wear badge and mask',
    reviewTip: 'Review guest list',
    headToLocation: 'Head to location',
    prepGear: 'Prep gear',
    liveNow: 'Live now',
    startingSoon: 'Starting soon',
    upcoming: 'Upcoming',
    heroStatsStart: 'Start',
    heroStatsEnd: 'End',
    heroStatsDuration: 'Duration',
    shiftSyncFailedTitle: 'Shift sync failed',
    shiftSyncFailedMessage:
      'We could not load your assignments right now. Retry or contact support if the issue persists.',
    retrySync: 'Retry sync',
    listEmptyTitle: 'No shifts scheduled for {month}.',
    listEmptySubtitle: 'Check back soon or refresh to see new assignments that match your availability.',
    refreshShifts: 'Refresh shifts',
    shiftWindowLabel: 'Shift window',
    locationTbd: 'Location TBD',
    beOnTime: 'Be on time',
    confirmed: 'Confirmed',
    confirmShift: 'Confirm shift',
    phasePast: 'Past shift',
    phaseLive: 'Live now',
    phaseUpcoming: 'Upcoming',
    profileGreeting: 'Hello, {name}!',
    profileSettingsSync: 'Profile settings are synced across web and Expo.',
    memberSince: 'Member since {date}',
    memberSinceLabel: 'Member since',
    providerLabel: 'Provider',
    emailVerifiedLabel: 'Email verified',
    yes: 'Yes',
    pending: 'Pending',
    no: 'No',
    security: 'Security',
    appearance: 'Appearance',
    lightMode: 'Light mode',
    darkMode: 'Dark mode',
    signOut: 'Sign out',
    switchAccount: 'Need to switch accounts? Log in again',
    keepSignedIn: 'Keep me signed in',
    statusActive: 'Active',
    loginTitle: 'Employee Portal',
    loginCreateTitle: 'Create your account',
    loginSignInSubtitle: 'Sign in with your company credentials.',
    loginEmailPlaceholder: 'you@company.com',
    loginPasswordPlaceholder: 'Password',
    loginCreateButton: 'Create account',
    loginSignInButton: 'Sign in',
    loginAlreadyHaveAccount: 'Already have an account? Sign in',
    loginNeedAccount: 'Need a new account? Sign up',
    authEmailPasswordRequiredTitle: 'Email and password required',
    authEmailPasswordRequiredBody: 'Please enter both email and password.',
    authConfigurationMissingTitle: 'Configuration missing',
    authConfigurationMissingBody: 'Set SUPABASE_URL and SUPABASE_ANON_KEY before logging in.',
    authVerifyEmailTitle: 'Verify your email',
    authVerifyEmailBody: 'We sent a verification link to activate your account.',
    authFailedTitle: 'Authentication failed',
    authUnableSignIn: 'Unable to sign in',
    requestingCameraPermission: 'Requesting camera permission...',
    cameraPermissionRequired: 'Camera permission is required to scan a QR.',
    grantCameraAccess: 'Grant camera access',
    qrInstructions: 'Point the camera at the QR / barcode provided by your manager.',
    lastScanLabel: 'Last scan',
    scanAnotherBadge: 'Scan another badge',
    qrDetectedTitle: 'QR detected',
    qrDetectedMessage: 'Last scanned code: {code}',
    shiftNotFound: 'Shift not found. Pull to retry.',
    retry: 'Retry',
  },
  de: {
    languageLabel: 'Sprache',
    languageEnglish: 'Englisch',
    languageGerman: 'Deutsch',
    upcomingShifts: 'Kommende Schichten',
    enableLocationHint: 'Standort freigeben, um Schichten in deiner Nähe zu sehen',
    locationCoordinates: 'Standort: {coords}',
    locationUnknown: 'Standortdaten nicht verfügbar',
    listView: 'Listenansicht',
    calendarView: 'Kalenderansicht',
    shiftOverview: 'Schichtübersicht',
    shiftPlanningSubtitle: 'Schichtplanung & Updates',
    stageLabel: 'Phase',
    countdownLabel: 'Countdown',
    timingSnapshot: 'Zeitübersicht',
    dayLabel: 'Tag',
    prepLabel: 'Vorbereitung',
    focusPointsLabel: 'Wichtige Punkte',
    whereLabel: 'Einsatzort',
    openInMaps: 'In Karten öffnen',
    whatYoullDoLabel: 'Was du tun wirst',
    noDescription:
      'Keine Beschreibung hinterlegt. Kontaktiere das Einsatzteam, wenn du eine kurze Zusammenfassung brauchst.',
    needAHand: 'Brauchst du Hilfe?',
    reachOutCopy:
      'Kontaktiere {contact}, wenn sich etwas ändert oder du vor dem Einchecken noch einmal kurz den Ablauf durchgehen möchtest.',
    callLabel: 'Anruf',
    emailLabel: 'E-Mail',
    cta: 'Mit QR einchecken',
    arriveTip: '10 Minuten vorher da sein',
    badgeTip: 'Badge und Maske tragen',
    reviewTip: 'Gästeliste prüfen',
    headToLocation: 'Zum Einsatzort aufbrechen',
    prepGear: 'Arbeitsmaterialien vorbereiten',
    liveNow: 'Jetzt live',
    startingSoon: 'Startet bald',
    upcoming: 'Kommend',
    heroStatsStart: 'Beginn',
    heroStatsEnd: 'Ende',
    heroStatsDuration: 'Dauer',
    shiftSyncFailedTitle: 'Schicht synchronisierung fehlgeschlagen',
    shiftSyncFailedMessage:
      'Wir konnten deine Einsätze gerade nicht laden. Bitte erneut versuchen oder das Support-Team kontaktieren.',
    retrySync: 'Erneut versuchen',
    listEmptyTitle: 'Für {month} sind aktuell keine Schichten geplant.',
    listEmptySubtitle: 'Sieh später noch einmal nach oder lade neu, um neue Einsätze zu sehen.',
    refreshShifts: 'Schichten aktualisieren',
    shiftWindowLabel: 'Schichtfenster',
    locationTbd: 'Ort unbekannt',
    beOnTime: 'Sei pünktlich',
    confirmed: 'Bestätigt',
    confirmShift: 'Schicht bestätigen',
    phasePast: 'Vergangene Schicht',
    phaseLive: 'Jetzt live',
    phaseUpcoming: 'Kommend',
    profileGreeting: 'Hallo, {name}!',
    profileSettingsSync: 'Profil-Einstellungen werden zwischen Web und Expo synchronisiert.',
    memberSince: 'Mitglied seit {date}',
    memberSinceLabel: 'Mitglied seit',
    providerLabel: 'Anbieter',
    emailVerifiedLabel: 'E-Mail bestätigt',
    yes: 'Ja',
    pending: 'Ausstehend',
    no: 'Nein',
    security: 'Sicherheit',
    appearance: 'Erscheinungsbild',
    lightMode: 'Hell-Modus',
    darkMode: 'Dunkel-Modus',
    signOut: 'Abmelden',
    switchAccount: 'Benutzer wechseln? Erneut anmelden',
    keepSignedIn: 'Angemeldet bleiben',
    statusActive: 'Aktiv',
    loginTitle: 'Employee Portal',
    loginCreateTitle: 'Konto erstellen',
    loginSignInSubtitle: 'Mit deinen Firmen-Zugangsdaten anmelden.',
    loginEmailPlaceholder: 'du@firma.de',
    loginPasswordPlaceholder: 'Passwort',
    loginCreateButton: 'Konto erstellen',
    loginSignInButton: 'Anmelden',
    loginAlreadyHaveAccount: 'Du hast schon ein Konto? Anmelden',
    loginNeedAccount: 'Noch kein Konto? Registrieren',
    authEmailPasswordRequiredTitle: 'E-Mail und Passwort erforderlich',
    authEmailPasswordRequiredBody: 'Bitte gib sowohl E-Mail als auch Passwort ein.',
    authConfigurationMissingTitle: 'Konfiguration fehlt',
    authConfigurationMissingBody: 'Setze SUPABASE_URL und SUPABASE_ANON_KEY, bevor du dich einloggst.',
    authVerifyEmailTitle: 'E-Mail bestätigen',
    authVerifyEmailBody: 'Wir haben einen Link zur Aktivierung deines Kontos geschickt.',
    authFailedTitle: 'Authentifizierung fehlgeschlagen',
    authUnableSignIn: 'Anmeldung nicht möglich',
    requestingCameraPermission: 'Kameraberechtigung wird angefordert...',
    cameraPermissionRequired: 'Kameraberechtigung ist erforderlich, um einen QR zu scannen.',
    grantCameraAccess: 'Kamerazugriff erlauben',
    qrInstructions: 'Richte die Kamera auf den QR-/Barcode aus, den dir deine Leitung gegeben hat.',
    lastScanLabel: 'Zuletzt gescannt',
    scanAnotherBadge: 'Weiteren Badge scannen',
    qrDetectedTitle: 'QR erkannt',
    qrDetectedMessage: 'Zuletzt gescannter Code: {code}',
    shiftNotFound: 'Schicht nicht gefunden. Zieh nach unten, um es erneut zu laden.',
    retry: 'Erneut versuchen',
  },
} as const;

type TranslationKey = keyof typeof translations['en'];

type LanguageContextValue = {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  t: (key: TranslationKey, vars?: TranslationVars) => string;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

type Props = {
  children: ReactNode;
};

const interpolate = (value: string, vars?: TranslationVars) => {
  if (!vars) return value;
  return Object.entries(vars).reduce(
    (text, [key, varValue]) => text.replace(`{${key}}`, String(varValue)),
    value
  );
};

export const LanguageProvider = ({ children }: Props) => {
  const [language, setLanguage] = useState<LanguageCode>('en');
  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key, vars) => interpolate(translations[language][key], vars),
    }),
    [language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export type { TranslationKey };
