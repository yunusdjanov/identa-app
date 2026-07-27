# Identa Mobile — Agent Guide

Expo SDK 54 React Native client for the Identa dental-clinic management system.
The backend is a separate Laravel + Sanctum API. This repo is the mobile client
only. For backend API/business-rules contract see `IDENTA_WEB_REFERENCE.md`;
for response shapes the source of truth is `src/types/index.ts`.

## Before writing code

Expo changes fast between SDKs. Read the v54 docs at
https://docs.expo.dev/versions/v54.0.0/ before touching any Expo/native API —
older Expo answers from training data are usually wrong for SDK 54.

## Stack (versions are load-bearing — check package.json before assuming)

- Expo `~54`, React Native `0.81`, React `19`, TypeScript `~5.9`
- React Navigation v7 (`native-stack` + `bottom-tabs`) — **not** expo-router
- TanStack React Query v5, in-memory per authenticated session
- Zustand v5 for client state (`src/stores`: auth, ui, network)
- axios for HTTP; `@sentry/react-native` for crash reporting
- `expo-secure-store` (session), `expo-image-picker`, `expo-notifications`,
  `expo-updates` (OTA)
- Custom i18n (`src/i18n`) — **no i18next**

## API + auth model (the part most likely to trip you up)

- Base URL from `EXPO_PUBLIC_API_URL`, default `http://10.0.2.2:8001/api/v1`
  (Android emulator alias → host's localhost). Prod: `https://api.identa.uz/api/v1`.
  The `/v1` prefix is required.
- Primary auth = Sanctum **Bearer tokens** (access + refresh). The access token
  is attached by a request interceptor in `src/api/client.ts`. A 401 triggers a
  single `/auth/refresh` + retry, then logout if that fails.
- The `web`-middleware auth routes — login, register, forgot-password,
  reset-password, logout, change-password — ALSO need a **CSRF bootstrap**:
  `GET /auth/csrf-token` → echo `X-CSRF-TOKEN` header + session cookie on the
  follow-up POST. This dance lives in `src/api/csrf.ts`. `/auth/refresh` does NOT
  need it (it's outside the `web` group).
- Session persisted in SecureStore (key `identa.session`) via `src/stores/auth.ts`.

## Mock backend

The app ships per-resource mocks so it runs with no backend at all.
- `EXPO_PUBLIC_USE_MOCK_API=false` → hit the real backend (set in every eas.json
  profile and in `.env.example`).
- `EXPO_PUBLIC_MOCK_AUTH` / `MOCK_PATIENTS` / `MOCK_APPOINTMENTS` /
  `MOCK_DASHBOARD` = `false` → flip an individual slice to real while the rest
  stay mocked. Useful for incremental backend wiring.
- With no env set, mocks are ON.

## Structure

```
src/api         axios client + per-resource modules (each has a mock branch)
src/stores      zustand: auth, ui, network
src/screens     auth/ dashboard/ patients/ appointments/ payments/ settings/
src/components   feature folders + ui/ primitives
src/lib         hooks + helpers (format, validation, sentry, notifications, …)
src/i18n        bundled translations (ru default, uz, en) + provider
src/constants   API_URL, colors, durations, locales, page size
src/types       all Api* interfaces — source of truth for response shapes
```

Navigation: bottom tabs = **Dashboard / Patients / Appointments / Payments**.
Settings is a modal stack screen, not a tab. Auth vs Main is switched on
`useAuthStore().isAuthenticated`. Deep links: `identa://` and `https://identa.uz`.

## Commands

```
npm start | npm run android | npm run ios
npm run typecheck     # tsc --noEmit — run before committing
npm test              # jest
npm run test:e2e      # maestro flows in .maestro/
```

EAS builds: `npm run build:prod:android` (app-bundle) /
`npm run build:preview:android` (apk). **Build order: Android first, then iOS.**

## Conventions

- Errors: the API layer normalizes everything to `ApiError { kind }`
  (`src/api/client.ts`). Branch on `kind`, never on raw axios shapes.
- Money is UZS **integers** (no minor units). Dates `YYYY-MM-DD`, times `HH:mm`.
- Do not persist clinical or financial React Query data to AsyncStorage. Session
  changes and authorization-scope changes must clear the in-memory query cache.
- Default locale is `ru`.
