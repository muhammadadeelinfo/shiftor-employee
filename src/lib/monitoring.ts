import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';
import { initializeMissingTranslationMonitoring } from '@shared/utils/i18nUtils';

let monitoringInitialized = false;
let sentryEnabled = false;

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const AUTH_TOKEN_PATTERN = /\b(?:bearer|token)\s+[a-z0-9._-]+\b/gi;

const sanitizeText = (value: string) =>
  value.replace(EMAIL_PATTERN, '[redacted-email]').replace(AUTH_TOKEN_PATTERN, '[redacted-token]');

const sanitizeRecord = (value: unknown): unknown => {
  if (typeof value === 'string') return sanitizeText(value);
  if (Array.isArray(value)) return value.map((entry) => sanitizeRecord(entry));
  if (value && typeof value === 'object') {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(input)) {
      if (/email|token|authorization|cookie|password|phone|address|name/i.test(key)) {
        output[key] = '[redacted]';
        continue;
      }
      output[key] = sanitizeRecord(entry);
    }
    return output;
  }
  return value;
};

const sanitizeEvent = (event: Record<string, unknown>) => {
  const cloned = sanitizeRecord(event) as Record<string, unknown>;
  delete cloned.user;
  delete cloned.request;
  return cloned;
};

const captureUnknownError = (reason: unknown) => {
  if (!sentryEnabled) return;
  if (reason instanceof Error) {
    Sentry.captureException(reason);
    return;
  }
  Sentry.captureMessage(`Unhandled rejection: ${String(reason)}`, 'error');
};

const registerUnhandledPromiseTracking = () => {
  try {
    // React Native ships this helper for unhandled promise rejection hooks.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tracking = require('promise/setimmediate/rejection-tracking');
    tracking.enable({
      allRejections: true,
      onUnhandled: (_id: unknown, error: unknown) => {
        console.error('Unhandled promise rejection', error);
        captureUnknownError(error);
      },
      onHandled: () => {},
    });
  } catch (error) {
    console.warn('Failed to enable promise rejection tracking', error);
  }
};

const registerGlobalJsHandler = () => {
  const errorUtils = (globalThis as { ErrorUtils?: any }).ErrorUtils;
  if (!errorUtils?.setGlobalHandler || !errorUtils?.getGlobalHandler) {
    return;
  }

  const defaultHandler = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    console.error('Unhandled global JS error', error);
    captureUnknownError(error);
    if (typeof defaultHandler === 'function') {
      defaultHandler(error, isFatal);
    }
  });
};

export const initializeMonitoring = () => {
  if (monitoringInitialized) return;
  monitoringInitialized = true;

  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const dsn = typeof extra.sentryDsn === 'string' ? extra.sentryDsn.trim() : '';
  const enabledFlag = extra.sentryEnabled === true;
  const environment = typeof extra.expoStage === 'string' ? extra.expoStage : 'development';

  registerUnhandledPromiseTracking();
  registerGlobalJsHandler();
  initializeMissingTranslationMonitoring((message) => console.warn(message));

  if (!dsn || !enabledFlag) {
    if (!__DEV__) {
      console.warn('Sentry disabled or DSN missing. Monitoring runs in console-only mode.');
    }
    return;
  }

  sentryEnabled = true;
  Sentry.init({
    dsn,
    environment,
    enableAutoSessionTracking: true,
    sendDefaultPii: false,
    attachStacktrace: true,
    tracesSampleRate: environment === 'production' ? 0.05 : 0,
    beforeSend(event) {
      return sanitizeEvent(event as unknown as Record<string, unknown>) as any;
    },
  });
};

export const captureAppException = (error: Error, context?: Record<string, unknown>) => {
  if (!sentryEnabled) return;
  Sentry.captureException(error, {
    extra: sanitizeRecord(context) as Record<string, unknown>,
  });
};
