# Shiftor Employee Master PRD

Last updated: 2026-07-04

## 1. Purpose

This document is the master product record for the Shiftor Employee mobile app. It should track what has already been developed, what depends on backend or admin-side support, and what is planned next.

The technical setup, commands, and release process live in `README.md` and the release docs. This PRD is for product scope, feature status, and future planning.

## 2. Product Overview

Shiftor Employee is the companion mobile app for the Shiftor platform. Employees use it to view assigned shifts, manage shift-related actions, browse public/startup jobs, access account information, upload documents, request vacation, receive notifications, and use QR clock-in workflows.

The app is built with Expo, React Native, Expo Router, Supabase, React Query, and shared i18n/theme utilities. It connects to the same backend ecosystem as Shiftor Admin.

## 3. Product Goals

- Give employees a reliable mobile view of their work schedule and shift details.
- Reduce manager/employee back-and-forth by surfacing shift confirmations, notifications, vacation requests, documents, and account data in one app.
- Support employee self-service without requiring admin intervention for every routine action.
- Support bilingual operation in English and German.
- Prepare the app for iOS and Android release with documented release checks.

## 4. Target Users

- Employees: authenticated users who need shifts, clock-in, documents, vacation requests, notifications, and account information.
- Guest candidates: unauthenticated visitors who can browse public/startup job listings and preview the app.
- Administrators and operations teams: indirect users through Shiftor Admin/backend workflows that supply shifts, jobs, documents, notifications, company links, and approvals.

## 5. Current App Surface

The repository currently includes these main app routes:

- Auth and onboarding: welcome, onboarding, login, signup redirect, startup route.
- Main tabs: Home, Shifts, Calendar, QR Clock-In/Out, Account.
- Detail/support screens: shift details, calendar day details, job details, notifications, profile edit, employee documents, monthly hours, vacation requests, support, not found.

## 6. Developed Features

### Authentication and Navigation

Status: Developed

- Supabase auth provider and route guarding.
- Public routes for onboarding, startup, auth, and jobs.
- Authenticated tab layout and protected employee workflows.
- Startup route utility that decides the correct first screen.

### Shift Feed and Shift Details

Status: Developed

- Fetches assigned shifts through `shift_assignments`.
- Loads shift records from `shifts` and object data.
- Maps backend shift records into app display models.
- Supports realtime subscription to employee shift assignment changes.
- Supports employee confirmation of assigned shifts by updating `confirmationStatus` and `confirmedAt`.
- Caches assigned shifts for degraded offline/weak-network list and calendar viewing.
- Provides fallback sample shifts when shift detail fetching is unavailable.

### Home Dashboard

Status: Developed

- Authenticated startup route opens the employee dashboard.
- Dashboard summarizes next shift, active clock status, unread notifications, pending vacation, latest document, and quick actions.
- Greeting prefers real employee/profile names and avoids raw email-style login aliases.
- Dashboard is responsive for phone/tablet layouts and uses existing theme/i18n patterns.

### Calendar

Status: Developed

- Calendar tab shows shift distribution by day.
- Calendar day details screen lists shifts/events for a selected date.
- Calendar settings screen exists for in-app and external calendar configuration.
- Shared calendar selection utilities and tests are present.

### Jobs and Guest Job Browsing

Status: Developed

- Public/startup jobs endpoint integration via `API_BASE_URL`.
- Startup jobs list supports filtering, search parsing, typo-tolerant matching, and field-specific search terms.
- Job detail screen exists.
- Guest preview screen exists for unauthenticated exploration.
- Demo/test job filtering is included to hide seeded data from public surfaces.

### QR Clock-In

Status: Developed, backend-dependent

- QR scanner uses Expo Camera.
- QR token parsing utility exists.
- Employee presence is read from the `employees` table using multiple possible employee/user id columns for compatibility.
- Active check-in state, worked duration, and clock-in/clock-out reminders are surfaced.
- Scanner has guided states for ready, checking, confirm clock-out, success, and error recovery.
- QR submit flow depends on backend API configuration and server-side validation.

### Account and Profile

Status: Developed

- Account tab loads employee profile data from Supabase with compatibility across several employee id column names.
- Profile photo support uses Supabase Storage.
- Profile edit screen supports updating employee identity/contact/profile fields.
- Language selection is available and persisted.
- Account screen surfaces monthly hours entry points and employee actions.

### Monthly Hours

Status: Developed, backend-dependent

- Monthly hours screen and account summary integration exist.
- Fetches monthly data from `/api/employee/monthly-hours`.
- Formats planned, worked, delta, completed, open, missing, scheduled, and shift timing data.
- Includes tests for monthly hours parsing and display utilities.

### Employee Documents

Status: Developed, backend-dependent

- Employee documents screen exists.
- Supported document types include certificate of sickness, ID/passport, contract, proof of address, and other.
- Allows document selection, validation, Supabase Storage upload, backend registration, listing, and signed download URL retrieval.
- Enforces allowed content types and a 10 MB max file size.
- Document list/register/download depends on Employee API endpoints.

### Vacation Requests

Status: Developed, backend/admin-dependent

- Vacation request screen exists.
- Employees can submit vacation requests with start date, end date, and optional note.
- Vacation request history is fetched from `vacation_requests`.
- Approval-letter signed URL support exists for approved requests.
- Review, approval, rejection, and approval-letter generation are expected to be handled by backend/admin-side workflows.

### Notifications

Status: Developed

- In-app notification bell and notification screen exist.
- Supabase `notifications` table SQL is included.
- Realtime notifications subscribe by employee id.
- Supports unread count, grouping by recency, category display, target navigation, mark one read, and mark all read.
- Push token registration, notification tap routing, Supabase token schema, and employee preference toggles are started.
- Shift notification utilities and tests exist.

### Feedback and Rating Prompts

Status: Developed

- Support screen includes structured in-app feedback capture and email handoff.
- Smart rating prompt foundation appears after positive moments instead of app launch.
- Feedback/rating utilities are reusable across shift confirmation, QR, documents, and vacation flows.

### Company Linking

Status: Developed, backend/admin-dependent

- Supabase SQL exists for company join codes, employee company links, audit logs, and `request_employee_company_link`.
- Employees can submit a company code from Account and view pending, active, or rejected request status.
- Production use requires the company-linking SQL and an admin approval/rejection workflow.

### Localization

Status: Developed

- English and German translation files exist.
- Language context and language utilities are implemented.
- Tests cover translation completeness, interpolation, localization behavior, and visual localization snapshots.

### Runtime Health, Error Handling, and Monitoring

Status: Developed

- App error boundary exists.
- Runtime health utilities check configuration and notification table health.
- Sentry React Native dependency and monitoring initialization exist.
- User-facing error utility exists.

### Release Readiness

Status: Developed

- iOS and Android release docs exist.
- App Store metadata and privacy drafts exist.
- Google Play checklist exists.
- Release scripts run tests, DB/env checks, Expo config parsing, and platform health checks.

## 7. Backend and Data Dependencies

The employee app currently depends on these backend resources:

- Supabase auth users and sessions.
- `employees` table for profile, company, presence, and account data.
- `shift_assignments` table for employee assignments and confirmations.
- `shifts` table and related object data for shift details.
- `notifications` table for realtime and persisted employee notifications.
- `vacation_requests` table for vacation request lifecycle.
- Supabase Storage bucket configured by the app for profile photos and documents.
- Employee API endpoints for jobs, documents, QR clock-in, and monthly hours.
- Shiftor Admin/backend workflows for creating shifts, publishing jobs, approving vacation, generating approval letters, managing document records, and administering company links.

## 8. Current Test Coverage

Status: Strong utility and integration coverage

The test suite covers time utilities, shift phase and mapping, shift confirmation status, notification utilities and realtime flow, notification localization, notification persistence, QR clock-in parsing, calendar selection, maps, language persistence, i18n safeguards, monthly hours, responsive layout, screen localization contracts, runtime health, account UI integration, notifications UI integration, visual responsive snapshots, and visual localization snapshots.

The current test command is `npm run test`.

## 9. Known Gaps and Risks

- Product ownership is split between this mobile app, Shiftor Admin, Supabase schema, and Employee API endpoints.
- Some mobile features are implemented as clients but require backend/admin-side workflows to be production-complete.
- Company linking requires production SQL deployment and end-to-end admin approval validation.
- QR clock-in success depends on server-side token format, eligibility checks, and clock-in/clock-out endpoint behavior.
- Monthly hours and employee documents depend on `API_BASE_URL` endpoints that are not implemented in this mobile repository.
- Fallback shift detail data should not be treated as production data.
- Generated/native folders and local build artifacts exist in the working copy; master product documentation should stay in `docs/`.

## 10. Feature Status Matrix

This matrix is the launch-readiness source of truth. It links each major workflow to the responsible surface and the next action needed before production release.

| Workflow | Current status | Primary owner | Dependencies | Next action |
| --- | --- | --- | --- | --- |
| Authentication and route guarding | Developed | Mobile, Supabase | Supabase auth configuration | Verify login/logout on physical iOS and Android devices. |
| Home dashboard | Developed | Mobile | Shifts, notifications, employee profile, vacation, documents | Add analytics for dashboard activation and action taps; the privacy-safe event foundation is implemented. |
| Shift list and shift details | Developed | Mobile, Supabase | `shift_assignments`, `shifts`, realtime updates | Validate real-data acceptance criteria; unsafe sample-detail fallback has been removed. |
| Shift confirmation | Developed | Mobile, Supabase | Assignment metadata and update permissions | Confirm RLS/update rules in Supabase and test employee confirmation on real data. |
| Calendar | Developed | Mobile | Shift feed, cached shift data | Add physical-device QA for small screens, tablets, and German text expansion. |
| QR clock-in/out | Developed, backend-dependent | Mobile, Employee API, Supabase | `/api/objects/qr-clock-in`, QR token format, presence fields | API contract is documented; run end-to-end validation with production-like QR data. |
| Account and profile | Developed | Mobile, Supabase, Storage | Employee table compatibility, profile photo bucket | Verify profile update permissions and avatar upload/download on production bucket. |
| Monthly hours | Developed, backend-dependent | Mobile, Employee API | `/api/employee/monthly-hours` | Confirm endpoint response contract and add backend-unavailable empty/error state polish. |
| Employee documents | Developed, backend-dependent | Mobile, Employee API, Supabase Storage, Admin | Upload bucket, list/register/download endpoints, admin review workflow | Document upload lifecycle and add document status tracking once backend supports review states. |
| Vacation requests | Developed, backend/admin-dependent | Mobile, Supabase, Admin | `vacation_requests`, approval workflow, approval letter generation | Add deeper submission-state tests and confirm admin approval/rejection flow. |
| Notifications | Developed | Mobile, Supabase, Admin/API senders | `notifications`, push token table, push delivery service | Validate push delivery for shift updates, reminders, vacation, documents, and urgent announcements. |
| Push preferences | Developed, backend-dependent | Mobile, Supabase, push service | Device token registration table and send logic | Connect preferences to server-side notification targeting. |
| Feedback and rating prompts | Developed | Mobile, Support operations | Local feedback capture, mail support handoff, app store rating APIs | Add support triage process and review-response workflow. |
| Company linking | Developed, backend/admin-dependent | Mobile, Supabase, Admin | Join-code SQL, employee-company link workflow | Apply production SQL and validate approval/rejection with the Admin workflow. |
| Support | Developed, needs operations process | Mobile, Support operations | Support email/process ownership | Add categories, attachments, and ticket status tracking if support volume grows. |
| Store listing and ASO | In Progress | Product, Design, Release | Store screenshots, preview video, metadata, localization | Screenshot plan exists; capture English/German assets and finalize preview script, metadata, and release notes. |
| Privacy and compliance | In Progress | Product, Legal, Release | App privacy labels, Play data safety, in-app explanations | Plain-language summary is shipped; validate App Store and Play disclosures before release. |
| Analytics and growth metrics | In Progress | Product, Engineering | Supabase event RPC, privacy-safe event schema | Event allowlist and client sanitization are implemented; deploy SQL, enable production config, and add dashboards. |
| Physical-device QA | Planned | QA, Release | iOS and Android test devices | Execute device matrix before public release. |

## 11. Launch Readiness Dashboard

Status: In Progress

Use this dashboard before every release candidate. A release is not market-ready until all blocking items are resolved or explicitly accepted by product ownership.

| Area | Current readiness | Blocker level | Required before launch |
| --- | --- | --- | --- |
| Core navigation and auth | Strong | Medium | Physical-device login, logout, route-guard, and restart verification. |
| Daily employee workflow | Strong | Medium | Real-data validation for Home, Shifts, Calendar, QR, Notifications, Documents, and Vacation. |
| Backend/API contracts | Partial | High | Mobile contracts are documented; live QR, documents, monthly hours, push delivery, and admin approval validation remains. |
| Offline/degraded behavior | Partial | Medium | Shift list and calendar have cache support; backend-dependent screens still need clearer unavailable states. |
| Monitoring and reliability | Partial | High | Confirm Sentry project/env, crash-free baseline, slow-screen tracking, and post-release review process. |
| Store conversion assets | In Progress | High | Screenshot plan exists; produce localized captures, preview video/script, metadata, keywords, and release notes. |
| Ratings and feedback | Partial | Medium | In-app feedback and smart prompts exist; support triage and public review response process remain. |
| Privacy/compliance | Partial | High | In-app summary and account deletion visibility exist; verify App Store privacy labels, Play data safety, and permission disclosures. |
| Device coverage | Not started | High | Test on physical iOS, physical Android, small screen, large screen, tablet, dark mode, and German locale. |

Immediate next release-readiness actions:

1. Deploy and verify company-linking plus privacy-safe analytics SQL in the production Supabase project.
2. Run live contract validation for QR, documents, monthly hours, vacation approval, push delivery, and profile/storage RLS.
3. Add clearer unavailable/error states for documents, monthly hours, vacation, and company-linking dependencies.
4. Capture the planned English/German store screenshots and finalize localized listing metadata.
5. Execute physical-device QA and record pass/fail results in release docs.

## 12. Planned Features

These items are proposed next-plan entries based on the current repository state. Confirm priority before implementation.

### High Priority

- Validate the documented QR clock-in/out contract against production-like backend data.
- Deploy and validate the completed employee company join-code request/status workflow.
- Add production acceptance criteria for shift confirmation, vacation requests, documents, and QR clock-in.
- Verify all release-critical flows on a physical iOS and Android device.
- Add Apple and Google store listing optimization tasks: localized screenshots, preview video, keyword review, subtitle/short description testing, and release-note quality.
- Deploy the privacy-safe analytics schema and build activation, retention, reliability, support, and conversion dashboards.
- Verify App Store privacy labels plus Play data safety disclosures against the implemented plain-language privacy summary.

### Medium Priority

- Add company names and admin rejection reasons to the company-link status view when the backend exposes them safely.
- Add clearer empty/error states for backend-dependent screens when API endpoints are unavailable.
- Add audit-friendly documentation for document upload/download lifecycle.
- Add deeper tests for vacation request submission states and document upload validation.
- Add onboarding completion metrics and improve first-session activation for employees and guest job seekers.
- Add support response templates and an internal review-response workflow for App Store Connect and Google Play Console.
- Add richer support flow with categories, attachments, and status tracking.

### Future Ideas

- Push notification delivery beyond in-app realtime notifications.
- Offline-friendly cached shift schedule.
- Calendar export/sync improvements.
- Employee availability management.
- Time correction request workflow.
- Manager-to-employee messaging or announcements.
- Richer job application status tracking.
- Referral/share flow for public job listings.
- Employee achievement or reliability signals where appropriate and privacy-safe.
- Admin-configurable employee announcements and urgent shift coverage requests.

## 13. Market Ranking Growth Plan

Goal: make Shiftor Employee competitive in App Store and Google Play ranking by improving product quality, user retention, store conversion, rating quality, and operational feedback loops. This plan should be measured continuously after launch.

### Ranking Principles

- Store ranking is not only keywords. It is affected by app quality, conversion from listing views to installs, ratings/reviews, retention, update quality, localization, and platform policy compliance.
- Google Play visibility is directly affected by Android vitals, especially user-perceived crash rate and ANR rate.
- Apple product page quality depends on a clear name, icon, subtitle, screenshots, app previews, description, keywords, ratings/reviews, category choice, and localization.
- The app should earn positive reviews by becoming reliable in daily employee workflows before asking for ratings.

### Product Quality Priorities

Status: In Progress

- Reach production-grade stability before broad launch.
- Track crash-free sessions, app startup time, slow screens, failed API calls, failed QR scans, notification delivery failures, and document upload failures.
- Add performance budgets for launch, tab switch, shift list load, calendar month render, QR scanner open, document upload, and monthly-hours load.
- Add graceful degraded states when Supabase or Employee API endpoints are unavailable.
- Add offline caching for assigned shifts, shift details, and calendar days so employees can still inspect their schedule with weak connectivity. Assigned shift/calendar cache is started; shift detail cache remains planned.
- Add background refresh and push notification reliability checks for shift updates.
- Add device matrix testing for small Android phones, large Android phones, iPhone SE-sized screens, modern iPhones, tablets, dark mode, and German text expansion.

### Retention and Daily Use Features

Status: In Progress

- Add push notifications for new shifts, changed shifts, removed shifts, upcoming shift reminders, clock-out reminders, vacation approval/rejection, document status, and urgent admin announcements. Mobile token registration and preference UI are started; server-side send workflow remains planned.
- Add home dashboard summarizing next shift, active clock-in state, unread notifications, pending vacation requests, and required documents. Initial dashboard is developed.
- Add employee availability management so employees can tell managers when they are available or unavailable.
- Add shift swap/request coverage workflow if it fits the Shiftor Admin product model.
- Add time correction request workflow for missed or incorrect clock-ins.
- Add employee document status tracking: pending review, accepted, rejected, needs replacement.
- Add vacation balance display if backend data exists.
- Add payroll/pay-period summary and export improvements if monthly-hours data is reliable.
- Add richer support flow with categories, attachments, and status tracking.

### Store Listing and ASO Plan

Status: Planned

- Prepare localized App Store and Google Play metadata for English and German.
- Create high-quality screenshots that show the real app value: next shift, calendar, QR clock-in, notifications, documents, vacation, monthly hours, and jobs.
- Create a 15-30 second app preview video focused on the employee daily workflow.
- Test alternate screenshots, icon, subtitle, and promotional text through Apple product page optimization and Google Play store listing experiments.
- Use accurate, relevant keywords only; avoid competitor names, irrelevant keywords, and keyword stuffing.
- Choose the most relevant primary category and keep category selection consistent with the app's real use.
- Keep "What's New" notes specific and benefit-led, especially when updates respond to user feedback.
- Add custom product pages or campaign-specific listings for job seeker acquisition, employer onboarding, and employee workforce use cases.

### Ratings, Reviews, and Support Plan

Status: In Progress

- Ask for ratings only after positive completed actions, not at app launch or after errors. Smart prompt foundation is developed.
- Add in-app feedback before public review prompt: bug, missing shift, login issue, QR issue, payroll/monthly hours issue, document issue, vacation issue, other. Initial feedback capture is developed.
- Build an internal process to respond to public reviews within 24-48 hours.
- Tag review themes and turn repeated complaints into roadmap items.
- Add support links from error states so users can report problems with context.
- Add a release checklist item to review new ratings, review summaries, support tickets, and crash trends after every release.

### Trust, Privacy, and Compliance

Status: Planned

- Keep privacy labels and Play data safety disclosures accurate for auth, profile data, location/maps, camera, documents, notifications, analytics, and crash reporting.
- Add a plain-language privacy summary in the app.
- Explain camera permission clearly before QR scanning.
- Explain notification value before requesting notification permission.
- Avoid collecting analytics events that include sensitive employee document content, private notes, or unnecessary location data.
- Add account deletion and data request visibility in account/support surfaces.

### Growth Metrics

Status: Planned

- Activation: login success rate, onboarding completion, first shift viewed, first notification read, first QR scan success.
- Engagement: weekly active employees, shifts viewed per week, calendar opens, notification open rate, QR clock-in success rate.
- Retention: day 1, day 7, day 30 return rate for employee users.
- Reliability: crash-free users, Android vitals, failed API calls, upload failure rate, scanner permission denial rate.
- Store conversion: listing views, install conversion, screenshot experiment winner, keyword rank, localized listing performance.
- Satisfaction: average rating, review sentiment, support ticket volume, time to first support response, repeated complaint themes.

### Competitive Differentiators to Build

Status: Planned

- Employee-first shift command center: next shift, map, confirmation, QR clock-in, notifications, and documents in one flow.
- Bilingual workforce experience designed for English and German from the start.
- Reliable QR clock-in with clear shift context and correction path.
- Self-service documents and vacation requests connected to admin workflows.
- Public jobs and employee account experience in the same app, so candidates can become employees without switching products.

### Market Ranking Acceptance Criteria

- App has no known release-blocking crashes on supported iOS and Android devices.
- Android vitals stay below Google Play bad behavior thresholds.
- App Store and Play Store listings have localized screenshots and descriptions for English and German.
- Rating prompt appears only after successful high-satisfaction moments.
- Support/feedback flow is available from account, error states, and settings.
- Each release has a post-release review of crashes, ratings, reviews, support tickets, and conversion metrics.
- Store screenshots and preview video are updated whenever the primary product experience changes.

## 14. Acceptance Criteria by Major Workflow

### Employee Login

- Employee can open the app, log in, and reach the authenticated tab experience.
- Authenticated users are redirected away from auth screens.
- Unauthenticated users cannot access protected employee workflows.

### Shifts

- Employee can view assigned shifts.
- Employee can open shift details.
- Employee can confirm an assigned shift when assignment metadata is available.
- Shift updates appear after refresh or realtime assignment changes.

### Calendar

- Employee can inspect shifts by month/day.
- Employee can open a day detail screen.
- Calendar view remains usable on phone and tablet layouts.

### QR Clock-In

- Employee can grant camera permission.
- App can scan supported QR codes.
- Invalid/expired/unsupported QR codes show user-facing errors.
- Successful scan updates presence state after backend confirmation.

### Vacation

- Employee can create a vacation request.
- Employee can see request history and status.
- Approved request can expose approval letter if backend has generated one.

### Documents

- Employee can upload allowed document types.
- Unsupported file types and oversized files are blocked.
- Employee can list and download their own uploaded documents.

### Notifications

- Employee can see unread count and recent notifications.
- Employee can mark notifications read.
- Notification targets route to the relevant screen when metadata supports it.

### Localization

- Employee can switch between English and German.
- All user-facing app screens should have translation keys.
- Missing interpolation or missing key regressions should be caught by tests.

## 15. Documentation Map

- `README.md`: project setup, commands, environment, scripts.
- `docs/master-prd.md`: product status, roadmap, and project record.
- `docs/company-linking.md`: company linking details.
- `docs/release-safety-checklist.md`: release readiness checklist.
- `docs/release-day-runbook.md`: iOS release-day command flow.
- `docs/release-day-runbook-android.md`: Android release-day command flow.
- `docs/app-store-metadata-template.md`: App Store listing draft.
- `docs/app-store-privacy-draft.md`: App privacy draft.
- `docs/google-play-release-checklist.md`: Google Play release checklist.

## 16. Reference Guidance

- Apple App Store product page guidance: app name, icon, subtitle, previews, screenshots, description, keywords, ratings/reviews, categories, localization, product page optimization, and custom product pages.
- Apple App Review Guidelines: safety, performance, business, design, legal, privacy, and review compliance.
- Android Core App Quality: stability, platform compatibility, SDK maintenance, production build quality, permissions, and major-feature testing.
- Android Vitals: user-perceived crash rate, user-perceived ANR rate, wake locks, battery usage, and Play visibility impact.

## 17. Maintenance Rules

- Update this PRD whenever a feature is added, removed, renamed, or moved behind a backend dependency.
- Use these statuses: Planned, In Progress, Developed, Backend-dependent, Blocked, Deprecated.
- Keep technical command details in `README.md`; keep product decisions and feature status here.
- Add a dated changelog entry for meaningful product-scope changes.

## 18. Changelog

- 2026-07-04: Removed unsafe sample shift fallback, added CI/lint/full type-check gates, completed employee company-link request/status UI, introduced opt-in privacy-safe analytics, aligned Expo SDK dependencies, and documented backend/device/store acceptance plans.
- 2026-07-04: Added feature status matrix and launch readiness dashboard with owners, dependencies, blockers, and next release actions.
- 2026-07-04: Added market ranking growth plan covering product quality, retention, ASO, ratings/reviews, privacy, metrics, and competitive differentiators.
- 2026-07-04: Started market-ranking implementation with in-app feedback capture and smart rating prompt foundation.
- 2026-07-04: Started push notifications v1 with device token registration, tap deep-link routing, employee preference toggles, and Supabase token schema.
- 2026-07-04: Added offline shift cache so My Shifts and Calendar can show last saved schedules when live sync fails.
- 2026-07-04: Added authenticated Home Dashboard as the startup screen with next shift, clock status, notifications, vacation/documents summary, and quick actions.
- 2026-07-04: Polished QR clock-in/out with guided scanner states, clearer recovery actions, and support handoff for scan failures.
- 2026-07-04: Created master PRD from current repository structure, screens, services, Supabase SQL, tests, and release docs.
