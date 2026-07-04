export type AppEventName =
  | 'login_succeeded'
  | 'shift_viewed'
  | 'qr_completed'
  | 'document_uploaded'
  | 'vacation_submitted'
  | 'notification_opened'
  | 'company_link_requested'
  | 'feedback_submitted'
  | 'rating_prompt_shown';

export type AnalyticsProperties = Record<string, string | number | boolean | null>;

const SENSITIVE_KEY = /email|name|phone|address|token|password|note|message|content|document|code/i;

export const sanitizeAnalyticsProperties = (
  properties: AnalyticsProperties = {}
): AnalyticsProperties =>
  Object.fromEntries(
    Object.entries(properties)
      .filter(([key]) => !SENSITIVE_KEY.test(key))
      .slice(0, 20)
      .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 80) : value])
  );
