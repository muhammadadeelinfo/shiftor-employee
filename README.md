# Shiftor Employee
Companion mobile app for the Shiftor platform. This Expo/React Native app is used by employees and connects to the same Supabase backend as Shiftor Admin (`shiftorapp.com`).

## Product naming

- Web app: **Shiftor Admin**
- Mobile app (this repository): **Shiftor Employee**

## Requirements

- Node.js `>=20`
- npm
- Xcode (for iOS simulator/device builds on macOS)
- Android Studio (for Android emulator/device builds)

## Quick start

1. Install dependencies:
```bash
npm install
```

2. Copy env file and fill real values:
```bash
cp .env.example .env
```

3. Start Metro:
```bash
npm run start
```

4. Run app targets:
```bash
npm run ios
npm run android
npm run web
```

For native development builds instead of Expo Go:
```bash
npm run ios:dev
npm run android:dev
```

## Environment

Minimum required values in `.env`:

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
API_BASE_URL=
```

Important optional release/runtime values:

```env
APP_VERSION=1.0.0
IOS_BUNDLE_IDENTIFIER=com.shiftor.employee
IOS_BUILD_NUMBER=1
ANDROID_PACKAGE=com.shiftor.employee
ANDROID_VERSION_CODE=1
EXPO_SCHEME=shiftoremployee
AUTH_REDIRECT_URL=https://expo.dev/@your-account/shiftor-employee
EAS_PROJECT_ID=
EXPO_STAGE=development
ENABLE_LOCATION_IN_DEV=false
```

Notes:

- Expo config comes from `app.config.ts` with base values in `app.json`.
- Current Expo slug is `shiftor-employee`.
- This app should point to the same Supabase project used by Shiftor Admin.
- After env changes, restart Metro with cache clear:
```bash
npx expo start -c
```

## i18n

- Translations are split into dedicated files:
  - `src/shared/i18n/translations/en.ts`
  - `src/shared/i18n/translations/de.ts`
- Language state and translation resolution live in `src/shared/context/LanguageContext.tsx`.

## Notifications

- The app expects `public.notifications` in Supabase for realtime notification feed and read-state handling.
- Shift-related notification generation is handled in shared notification utilities/hooks and consumed by the in-app notifications UI.

## Scripts

- `npm run start` - start Expo/Metro
- `npm run ios` - run iOS target in Expo Go
- `npm run ios:dev` - run iOS target in a custom development build
- `npm run android` - run Android target in Expo Go
- `npm run android:dev` - run Android target in a custom development build
- `npm run web` - run web target
- `npm run test` - run full test suite
- `npm run check-db-config` - validate DB/env wiring
- `npm run release:check` - release preflight (tests + env/db config + Expo config parse)
- `npm run release:check:ios` - release preflight plus iOS simulator health check
- `npm run health:ios-sim` - iOS simulator health check
- `npm run release:check:android` - release preflight plus Android emulator/device health check
- `npm run health:android-emu` - Android emulator/device health check

## Testing

Automated tests are available and should pass before release:

```bash
npm run test
```

## Release notes

- App display name: `Shiftor Employee`
- Expo slug: `shiftor-employee`
- If slug/redirects change, update:
  - `AUTH_REDIRECT_URL` in `.env`
  - Auth redirect allowlists in Supabase/auth provider settings
  - Any shared links that include the old Expo slug

## Release docs

- `docs/release-safety-checklist.md` - full go-live checklist
- `docs/release-day-runbook.md` - iOS command order for build and submit day
- `docs/release-day-runbook-android.md` - Android command order for build and submit day
- `docs/app-store-metadata-template.md` - App Store listing text template
- `docs/app-store-privacy-draft.md` - App Privacy questionnaire draft
- `docs/google-play-release-checklist.md` - Google Play go-live checklist
