# Shiftor Employee Google Play Go-Live Checklist

Use this checklist for every Android Google Play release.

## 0) Baseline (verify first)

- [ ] App name is `Shiftor Employee`.
- [ ] Expo slug is `shiftor-employee`.
- [ ] Android package is `com.shiftor.employee` (or your final chosen production ID).
- [ ] `AUTH_REDIRECT_URL` is valid for your auth callback strategy.
- [ ] `EAS_PROJECT_ID` is set in `.env` for the same EAS project you want to keep.

## 1) Environment readiness

- [ ] `.env` includes required values: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DATABASE_URL`, `DIRECT_URL`, `API_BASE_URL`.
- [ ] Android release values are set: `APP_VERSION`, `ANDROID_PACKAGE`, `ANDROID_VERSION_CODE`, `EXPO_SCHEME`.
- [ ] Legal URLs are set and valid HTTPS links: `LEGAL_PRIVACY_URL`, `LEGAL_TERMS_URL`.
- [ ] Optional but recommended for production: `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_ENABLED=true`.
- [ ] If crash monitoring is enabled, confirm privacy/legal text covers diagnostics collection and no sensitive personal data is sent.
- [ ] Run:

```bash
npm run check-db-config
```

- [ ] Run:

```bash
npx expo config --type public --json
```

- [ ] Confirm output includes expected `name`, `slug`, `android.package`, `android.versionCode`, and `extra.apiBaseUrl`.

## 2) Automated release gates

- [ ] Run:

```bash
npm run release:check
```

- [ ] Run:

```bash
npm run check:play-readiness
```

- [ ] Run Android emulator health check:

```bash
npm run health:android-emu
```

- [ ] If emulator check fails due to adb/service issues, recover with:

```bash
adb kill-server
adb start-server
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
- [ ] Android layout check passes for at least:
- [ ] Pixel 7/8 class phone
- [ ] Small Android phone class
- [ ] Larger Android phone class
- [ ] Push/in-app notification behavior is verified in production-like build.

## 5) Google Play Console setup

- [ ] App record exists in Google Play Console with final package ID.
- [ ] Store listing (short/long description, graphics, screenshots) is complete.
- [ ] Data safety form is completed accurately.
- [ ] App content questionnaires are completed.
- [ ] Privacy policy URL and support URL are valid.

## 6) Build and submit

- [ ] Build production Android artifact:

```bash
eas build --platform android --profile production
```

- [ ] Submit to Google Play:

```bash
eas submit --platform android
```

- [ ] Create production release and attach uploaded build.
- [ ] Add release notes and roll out.

## 7) Post-submit monitoring

- [ ] Monitor crashes and errors for first 30-60 minutes after rollout.
- [ ] Validate auth, jobs, and notifications endpoints from a live install.
- [ ] Keep previous stable release notes available for rollback decisions.
