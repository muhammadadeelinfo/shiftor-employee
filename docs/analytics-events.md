# Privacy-Safe App Events

Analytics is opt-in at build time with `ANALYTICS_ENABLED=true` and requires `supabase/app-analytics.sql`. Events use the authenticated server-side user only; the client does not send user identifiers as properties.

Allowed events: login success, shift viewed, QR completion, document upload, vacation submission, notification open, company-link request, feedback submission, and rating-prompt display.

Never include free text, document names/content, contact details, company codes, tokens, exact addresses, precise location, or raw backend errors. `sanitizeAnalyticsProperties` enforces the client-side boundary and the SQL function enforces the event-name allowlist.
