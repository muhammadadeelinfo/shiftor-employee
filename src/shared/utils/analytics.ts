import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';
import { supabase } from '@lib/supabaseClient';
import {
  sanitizeAnalyticsProperties,
  type AnalyticsProperties,
  type AppEventName,
} from './analyticsUtils';

export const trackAppEvent = async (
  eventName: AppEventName,
  properties: AnalyticsProperties = {}
): Promise<void> => {
  const safeProperties = sanitizeAnalyticsProperties(properties);
  Sentry.addBreadcrumb({ category: 'app-event', message: eventName, data: safeProperties, level: 'info' });

  const enabled = Constants.expoConfig?.extra?.analyticsEnabled === true;
  if (!enabled || !supabase) return;

  const { error } = await supabase.rpc('track_employee_app_event', {
    event_name: eventName,
    event_properties: safeProperties,
  });
  if (error && __DEV__) {
    console.warn('Analytics event was not recorded', eventName, error.message);
  }
};
