# Release Candidate QA Matrix

Record build identifier, device/OS, locale, tester, date, and evidence link for each run.

| Surface | iOS small | iOS current | Android small | Android current | Tablet | EN | DE |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Fresh install/onboarding | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Login/logout/session restore | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Home/shifts/detail/confirmation | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Calendar/day/external calendar | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| QR permission/valid/invalid/offline | Pending | Pending | Pending | Pending | N/A | Pending | Pending |
| Notifications/deep links/preferences | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Documents upload/download/failure | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Vacation submit/status/letter | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Monthly hours/PDF/unavailable | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Company link request/status | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Account deletion/privacy/support | Pending | Pending | Pending | Pending | Pending | Pending | Pending |

Automated baseline: `npm run quality`, `npm run release:check`, and `maestro test .maestro/guest-smoke.yaml` on an installed release candidate. Physical-device cells cannot be marked passed from simulator evidence.
