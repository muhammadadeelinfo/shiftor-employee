# App Privacy Draft (Shiftor Employee)

Use this as a draft while completing App Store Connect -> App Privacy.
Final answers must match actual production behavior and legal policy.

## Data categories likely used

- Contact Info:
  - Email Address (account/auth)
- Identifiers:
  - User ID / employee ID (service-side identity)
- Diagnostics:
  - Crash/performance data (if Sentry enabled)
- Location:
  - Approximate/precise location only if location feature is enabled and used

## Data not currently required by default

- Health/Fitness
- Financial info
- Browsing history
- Purchases (in-app purchases are not configured)

## Tracking

- Tracking for third-party advertising: `No` (expected)
- Uses IDFA: `No` (expected)

## Purpose mapping draft

- App functionality:
  - account/session
  - notifications
  - shift/schedule display
- Analytics (optional):
  - crash and performance monitoring

## Encryption / export compliance

- `ITSAppUsesNonExemptEncryption` is set to `false` in config.
- During upload, answer export compliance consistently with this setting.

## Required follow-up before submission

- Confirm legal privacy policy URL is live and matches behavior.
- Confirm exact final data categories with your backend/auth implementation.
- Confirm whether push notification tokens are collected and documented.
- If `SENTRY_ENABLED=true`, confirm App Privacy "Diagnostics" answers include crash data collection.
- Confirm monitoring payloads avoid sensitive PII (email/phone/address/auth tokens).
