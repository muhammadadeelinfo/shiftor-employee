# Shiftor Employee App Store Go-Live Checklist

Use this checklist for every iOS App Store release.

## 0) Baseline (verify first)

- [ ] App name is `Shiftor Employee`.
- [ ] Expo slug is `shiftor-employee`.
- [ ] iOS bundle identifier is `com.shiftor.employeeportal` (or your final chosen production ID).
- [ ] `AUTH_REDIRECT_URL` uses the new slug path (`.../shiftor-employee`), not the old `employee-portal`.
- [ ] `EAS_PROJECT_ID` is set in `.env` for the same EAS project you want to keep.

## 1) Environment readiness

- [ ] `.env` includes required values: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DATABASE_URL`, `DIRECT_URL`, `API_BASE_URL`.
- [ ] iOS release values are set: `APP_VERSION`, `IOS_BUILD_NUMBER`, `IOS_BUNDLE_IDENTIFIER`, `EXPO_SCHEME`.
- [ ] Optional but recommended for production: `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`.
- [ ] Run:

```bash
npm run check-db-config
```

- [ ] Run:

```bash
npx expo config --type public --json
```

- [ ] Confirm output includes expected `name`, `slug`, `ios.bundleIdentifier`, `ios.buildNumber`, and `extra.apiBaseUrl`.

## 2) Automated release gates

- [ ] Run:

```bash
npm run release:check
```

- [ ] Run iOS simulator health check:

```bash
npm run health:ios-sim
```

- [ ] If simulator check fails due to simulator service, recover with:

```bash
xcrun simctl shutdown all
killall Simulator
open -a Simulator
npx expo start -c
```

## 3) Backend and data contract checks

- [ ] Production database contains `public.notifications`.
- [ ] `supabase/notifications-table.sql` is applied in production if needed.
- [ ] RLS policies are verified for employee reads/writes needed by mobile flows.
- [ ] Notification payload deep links resolve to valid public paths (no `/(tabs)/...` paths).

## 4) Manual QA on real device (required)

- [ ] Login, logout, and session restore after app restart.
- [ ] Jobs tab loads and refreshes with production API.
- [ ] Account tab opens without runtime errors.
- [ ] Notifications screen opens and renders empty/non-empty states correctly.
- [ ] Notification deep-link navigation works and does not show `Unmatched Route`.
- [ ] Language switch EN <-> DE works on all primary screens.
- [ ] iPhone layout check passes for at least:
- [ ] iPhone 14 Pro
- [ ] iPhone 14 Pro Max / Plus class
- [ ] Small iPhone class (SE/mini equivalent)
- [ ] Push/in-app notification behavior is verified in production-like build.

## 5) App Store Connect setup

- [ ] App record exists in App Store Connect with final bundle ID.
- [ ] App name, subtitle, description, keywords, and category are complete.
- [ ] Privacy policy URL and support URL are valid.
- [ ] App Privacy questionnaire is completed accurately.
- [ ] Export compliance answers are completed.
- [ ] Required screenshots and icon are uploaded.

## 6) Build and submit

- [ ] Build production iOS artifact:

```bash
eas build --platform ios --profile production
```

- [ ] Submit to App Store Connect:

```bash
eas submit --platform ios
```

- [ ] Add release notes in App Store Connect.
- [ ] Confirm build processing completed and assign build to version.

## 7) Post-submit monitoring

- [ ] Monitor crashes and errors for first 30-60 minutes after rollout.
- [ ] Validate auth, jobs, and notifications endpoints from a live install.
- [ ] Keep previous stable build/release notes available for rollback decisions.
