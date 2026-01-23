# Employee Portal
A cross-platform Expo app that lets employees interact with internal services, leveraging Supabase for data and React Query for caching.

## Getting started

1. **Prerequisites**
   - Node.js (currently supported version 18+ and npm bundled with it).
   - Expo CLI (`npm install -g expo-cli`) if you want the global command shortcuts.
   - A Supabase project and credentials (see `Environment` below).

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   - Copy `.env.example` to `.env` (e.g., `cp .env.example .env`).
   - Fill in `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and any other values required by `app.config.ts`.
   - Confirm the file is loaded in your shell/session before running Expo (`cat .env` or `source .env` if you load it manually).

4. **Run locally**
   - `npm run start` to launch Expo Dev Tools and the Metro bundler.
     - From the browser UI you can scan the QR code with Expo Go on Android/iOS or trigger a platform run using the `a`, `i`, or `w` shortcuts in the terminal.
     - If you already have an emulator/simulator ready, pressing `a` (Android) or `i` (iOS) in the Dev Tools terminal will start the app there automatically.
   - Alternatively, run platform-specific scripts while Dev Tools is open:
     - `npm run android` – starts Metro and immediately deploys to an attached Android device or running emulator (ensure USB debugging or a virtual device is ready).
     - `npm run ios` – same as above for iOS (requires a macOS host with Xcode).
     - `npm run web` – launches the app in your default browser with live reload enabled.
   - For physical devices, install Expo Go from the Play/App Store, open it, and scan the QR code shown in Dev Tools after `npm run start`.
   - When making code changes, Metro automatically reloads the running experience; use `r` in the terminal for a manual refresh if needed.

## Environment

- `.env` (not committed) should contain:
  ```env
  SUPABASE_URL=
  SUPABASE_ANON_KEY=
  ```
- After you add the real keys, restart Expo (`npx expo start -c`) so `app.config.ts` re-reads them and populates `Constants.expoConfig.extra`.
- Additional runtime configuration is controlled through `app.config.ts` and `app.json`.
- Both this Expo app and the Next.js web app share the same Supabase PostgreSQL project (`https://ritalqlveknouvojxfgt.supabase.co`). Mirror the Next.js `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SUPABASE_SERVICE_KEY` settings here so both clients hit the same instance.
- Prisma is the ORM on top of that database: `schema.prisma` sets `provider = "postgresql"` and `prisma.config.js` loads `DATABASE_URL` (and optionally `DIRECT_URL`) from the environment. Use the same Supabase connection string for those vars so Prisma and both apps work against a single backend.
 - Run `npm run check-db-config` after you copy the env vars to confirm every connection string exists and references the shared Supabase project. The script exits with a warning (non-zero status) if keys are missing or still point elsewhere.

### Location handling during development

- The shared location hook intentionally disables permission requests while Expo is running in development because unsatisfied device settings in the simulator/emulator can lead to the `Location request failed due to unsatisfied device settings` runtime error. This guard is only active when `EXPO_STAGE=development` (or whenever `__DEV__` is `true`), and production builds automatically re-enable the real location flow.
- If you need to test location access while still iterating, set `ENABLE_LOCATION_IN_DEV=true` in your `.env` before restarting Metro so the hook performs the normal permission and `Location.getCurrentPositionAsync` calls. Remember to leave that flag unset (or `false`) once development is finished so the production behavior mirrors the deployed experience.

### Magic-link authentication (placeholder)

- Magic-link sign-in is still pending; note in this README that once development wraps up the actual `supabase.auth.signInWithOtp` flow should be wired up so employees can log in using email links. Keep this section here so the eventual implementation has a place to document how to configure and use it once it ships.

## Project structure

- `app/` – Expo Router layouts and screens, with `(tabs)`/`(auth)` folders providing the stack + tab organization for production flows.
- `src/features/` – feature modules that encapsulate services, selectors, and feature-specific components (e.g., `shifts`).
- `src/shared/components` – reusable UI primitives such as `PrimaryButton`, `ShiftCard`, and `TopBar`.
- `src/shared/context` – cross-cutting contexts (notifications, theming, etc.).
- `src/shared/hooks` – shared hooks, including authentication helpers and location/push utilities.
- `src/lib` – low-level clients/helpers (`supabaseClient`, `queryClient`) consumed by the rest of the app.
- `assets/` – fonts, images, and other static resources that ship with the bundle.

## Testing & maintenance

- There are no automated tests defined yet; rely on Expo's manual device previews for now.
- Keep dependencies current via `npm outdated` and `npm install` once you bump `package-lock.json`.

Feel free to add more docs or contribute guidelines as the project grows.
