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
- Run `npm run check-env` to confirm required env vars are set before launching.
- After you add the real keys, restart Expo (`npx expo start -c`) so `app.config.ts` re-reads them and populates `Constants.expoConfig.extra`.
- Additional runtime configuration is controlled through `app.config.ts` and `app.json`.

## Project structure

- `App.tsx` – entry point registering the router and providers.
- `components/`, `hooks/`, `services/`, and `lib/` - grouped features, reusable hooks, API helpers, and shared utilities.
- `assets/` – static images and fonts used across the app.
- `app/` – Expo Router layout definitions for stacks and screens.

## Testing & maintenance

- There are no automated tests defined yet; rely on Expo's manual device previews for now.
- Keep dependencies current via `npm outdated` and `npm install` once you bump `package-lock.json`.

Feel free to add more docs or contribute guidelines as the project grows.
