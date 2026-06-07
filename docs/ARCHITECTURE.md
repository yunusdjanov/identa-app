# Identa Mobile — Architecture & Handoff Guide

> Audience: a developer (or agent) picking up the Identa mobile app to continue
> or verify it. Read this first, then `FEATURE_STATUS.md` (what's done), then
> `ROADMAP.md` (what's left) and `QA_VERIFICATION.md` (how to test).
>
> Companion docs already in the repo:
> - `AGENTS.md` — concise agent quick-start (stack, commands, conventions).
> - `IDENTA_WEB_REFERENCE.md` — the **backend API contract & business rules**.
> - **`src/types/index.ts`** — the source of truth for all response shapes.
>
> Last verified against the codebase: 2026-06-05.

---

## 1. What this is

Native mobile client for **Identa**, a dental-clinic practice-management system.
The mobile app is a **client only** — it talks to a separate Laravel + Sanctum
backend (`…/api/v1`, prod `https://api.identa.uz/api/v1`; Postgres + Redis +
worker on Railway). The same backend powers the web app (`Identa web/identa`).

**Stack** (versions are load-bearing — confirm in `package.json` before assuming):

| Concern | Choice |
|---|---|
| Runtime | Expo SDK `~54.0.33`, React Native `0.81.5`, React `19.1`, TypeScript `~5.9` |
| Architecture | New Architecture **enabled** (`app.json → newArchEnabled: true`) |
| Navigation | React Navigation **v7** (`native-stack` + `bottom-tabs`) — **not** expo-router |
| Server state | TanStack React Query v5, persisted to AsyncStorage (offline cache) |
| Client state | Zustand v5 (`src/stores`: `auth`, `network`, `theme`, `ui`) |
| HTTP | axios (`src/api/client.ts`) |
| Auth storage | `expo-secure-store` (session), key `identa.session` |
| Crash reporting | `@sentry/react-native` |
| Media / native | `expo-image-picker`, `expo-notifications`, `expo-updates` (OTA), `expo-haptics` |
| i18n | **Custom** (`src/i18n`) — no i18next. Locales `ru` (default) / `uz` / `en` |

> **Expo moves fast between SDKs.** Before touching any Expo/native API, read the
> SDK 54 docs (`https://docs.expo.dev/versions/v54.0.0/`). Training-data answers
> for older SDKs are frequently wrong for 54.

---

## 2. Project structure

```
src/
  api/         axios client + per-resource modules (each has a mock branch)
  stores/      zustand: auth, network, theme, ui
  screens/     auth/ dashboard/ patients/ appointments/ payments/ settings/
  components/  feature folders (appointments, dashboard, patients, payments,
               settings, odontogram, gallery, treatments) + ui/ primitives
  lib/         hooks + helpers (format, validation, sentry, notifications,
               otaUpdates, offlineGuard, permissions, appointmentConflicts, …)
  i18n/        bundled translations (ru/uz/en) + React provider
  constants/   API_URL, colors/theme, durations, locales, page size, business consts
  types/       all Api* interfaces — SOURCE OF TRUTH for response shapes
App.tsx        React Query + persistence, providers, Sentry/OTA bootstrap
src/navigation/index.tsx   the whole navigator graph + deep linking
```

---

## 3. Navigation graph — `src/navigation/index.tsx`

A single `<NavigationContainer>` switches on `useAuthStore(s => s.isAuthenticated)`:

```
NavigationContainer (deep-link aware)
├─ NOT authenticated → AuthStack (native-stack, headers hidden)
│   ├─ Login
│   ├─ Register
│   ├─ ForgotPassword
│   └─ ResetPassword            params: { token?, email? }
└─ authenticated → MainStack (native-stack)
    ├─ Tabs (bottom-tabs, custom CustomTabBar)
    │   ├─ Dashboard
    │   ├─ Patients
    │   ├─ Appointments
    │   └─ Payments
    ├─ Settings                 presentation: modal
    ├─ PatientDetail            params: { id }
    └─ PatientOdontogram        params: { patientId, patientName? }
```

- **Two global bottom-sheets** are rendered as siblings of the stack and driven by
  `useUIStore`: `AppointmentCreateSheet` and `PatientFormSheet`. They invalidate
  the relevant query keys (`appointments` / `dashboard` / `patients`) on success.
  This is why "create patient" / "create appointment" work from multiple screens.
- On mount, `MainNavigator` registers the Expo push token
  (`getExpoPushToken()` → `registerDeviceToken()`); failure is silent.
- **Deep linking** (`linking`): prefixes `identa://` and `https://identa.uz`.
  Routes: `home`/`patients`/`appointments`/`payments`, `settings`,
  `patient/:id`, `patient/:patientId/odontogram`, `reset-password` (resolves while
  logged out). ⚠️ `app.json` also declares `app.identa.uz` in associatedDomains /
  intent filters, but the `linking.prefixes` list only includes `identa.uz` — keep
  them in sync if universal links on `app.identa.uz` are required.

---

## 4. API layer — `src/api/`

### `client.ts` (the part most likely to trip you up)
- axios instance: `baseURL = API_URL` (see §6), `withCredentials: true` (needed for
  the CSRF cookie jar), `timeout: 20s`.
- **Request interceptor** lazily `require()`s the auth store and attaches
  `Authorization: Bearer <access>` (skippable per-request via `_skipAuthHeader`).
- **`ApiError`** normalizes every failure to a `kind`:
  `network | timeout | unauthorized | forbidden | not_found | validation | server | unknown`
  plus `status`, `fieldErrors` (422), `cause`. **Always branch on `error.kind`,
  never on raw axios shapes.**
- **401 → refresh flow:** a single-flight `refreshInFlight` coalesces concurrent
  401s, calls `POST /auth/refresh` with the `refresh_token` (bare axios, no bearer),
  on success `setTokens` + retries the original request once (`_retriedAfterRefresh`
  guard); on failure → `logout()`. A `403` with body `code: 'account_inactive'`
  also forces `logout()`. `server` / `unknown` kinds are reported to Sentry.

### `csrf.ts` (Laravel `web`-middleware routes only)
Login, register, forgot-password, reset-password, change-password run through the
Laravel `web` group and need a **CSRF bootstrap**: `GET /auth/csrf-token` →
`{ token }` + `identa-session` cookie, then echo `X-CSRF-TOKEN` + `Cookie` on the
POST. Memoized for 10 min, single-flight. **`/auth/refresh` does NOT need CSRF**
(it's outside the `web` group). See `IDENTA_WEB_REFERENCE.md §2` for the contract.

### Per-resource modules + mock toggles
14 slice files (`auth, patients, appointments, dashboard, payments, treatments,
odontogram, profile, team, sessions, devices, notifications, …`). Each mutating
call gates on `requireOnline()` (`lib/offlineGuard.ts`).

Every slice ships an inline **mock branch** so the app runs with no backend:
- Master switch `EXPO_PUBLIC_USE_MOCK_API` — `!== 'false'` means mocks ON.
- Per-slice overrides `EXPO_PUBLIC_MOCK_{AUTH,PATIENTS,APPOINTMENTS,DASHBOARD,
  PROFILE,TEAM,TREATMENTS}` — flip one slice to real while the rest stay mocked
  (useful for incremental backend wiring).
- **All `.env`/`.env.example` files and all 3 EAS profiles set
  `EXPO_PUBLIC_USE_MOCK_API=false`**, so in every real build the mocks are OFF;
  they are a debug-only path. (Three slices are the exception — they have *no* real
  branch yet: notifications-prefs, sessions, devices — see `FEATURE_STATUS.md`.)

> **Backend gotchas you will hit** (full list in `IDENTA_WEB_REFERENCE.md §3`):
> list filters use nested `filter[search]` / `filter[category_id]` / `filter[status]`;
> appointments send `reason` but read back `notes`; dashboard snapshot returns
> camelCase + string decimals (remapped + `Number()`-coerced in `api/dashboard.ts`).

---

## 5. State, persistence & data flow

| Store | File | Holds | Persistence |
|---|---|---|---|
| auth | `stores/auth.ts` | `user`, `tokens` (access/refresh + expiries), `isAuthenticated`, `isHydrating` | **SecureStore** `identa.session` (best-effort; legacy back-compat drops token-less blobs); sets Sentry user id |
| network | `stores/network.ts` | `isOnline`, `lastChangeAt` | subscribes to NetInfo at module load |
| theme | `stores/theme.ts` | `mode` (`light\|dark\|auto`, default `auto`), `effective` | **AsyncStorage** `@identa/theme_mode`; follows `Appearance` for `auto` |
| ui | `stores/ui.ts` | global sheet open/close + appointment view-date requests | — |

- **React Query** (`App.tsx`): `PersistQueryClientProvider` + AsyncStorage persister,
  cache key **`@identa/query-cache-v2`**, `throttleTime 1500`, `maxAge 24h`, only
  `success` queries dehydrated. Defaults: `staleTime 5min`, `gcTime 24h`, `retry 1`,
  no refetch on focus/reconnect; mutations `retry: false`. `MutationCache.onError`
  shows a unified offline toast.
  > ⚠️ **Bump the cache key `-vN`** whenever a response mapper changes shape
  > (e.g. a casing fix in `api/dashboard.ts`). Otherwise users hydrate stale rows —
  > the classic symptom is dashboard cards showing a non-number.
- **Boot/hydration** is gated by `components/ui/SplashGate.tsx`: waits on auth
  hydrate + theme hydrate + Inter fonts (fonts skipped on iOS), then renders.

---

## 6. Configuration, environment & builds

### Environment (`.env`, EAS `env`)
| Var | Purpose | Default |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | backend base, **must end in `/v1`** | `http://10.0.2.2:8001/api/v1` (Android emulator → host localhost) |
| `EXPO_PUBLIC_USE_MOCK_API` | master mock switch | `false` in all real configs |
| `EXPO_PUBLIC_MOCK_*` | per-slice mock overrides | unset (= follow master) |
| `EXPO_PUBLIC_SENTRY_DSN` | crash reporting; empty ⇒ Sentry no-op | unset in dev |

> iOS simulator/devices can't use `10.0.2.2` — set `EXPO_PUBLIC_API_URL` to your
> machine's LAN IP (e.g. `http://192.168.x.x:8001/api/v1`) for iOS local testing.

### `app.json`
- name **Identa**, slug `identa`, scheme `identa`, bundle/package **`uz.identa.mobile`**,
  `runtimeVersion.policy = appVersion`.
- Plugins: expo-font, expo-secure-store, expo-image-picker, expo-notifications.
- iOS `infoPlist`: camera / photo-library / FaceID / notifications usage strings;
  associatedDomains `identa.uz` + `app.identa.uz`.
- Android permissions incl. CAMERA / biometric / POST_NOTIFICATIONS (location blocked).
- ⚠️ **`extra.eas` is empty `{}`** — no EAS `projectId` is wired, so Expo push-token
  resolution may no-op until this is set (`eas init`). See `ROADMAP.md`.

### `eas.json` build profiles
| Profile | Output | Channel | Notes |
|---|---|---|---|
| `development` | dev-client APK + simulator | `development` | internal |
| `preview` | APK | `preview` | internal |
| `production` | Android **app-bundle**, autoIncrement, `appVersionSource: remote` | `production` | iOS too |

All profiles set `EXPO_PUBLIC_API_URL=https://api.identa.uz/api/v1`,
`EXPO_PUBLIC_USE_MOCK_API=false`, and Sentry secrets.
⚠️ The `submit` block has **placeholder Apple credentials** (`REPLACE_WITH_*`).

> **Build order is Android-first, then iOS** (a product decision — Android ships first).

### Commands
```
npm start | npm run android | npm run ios     # Expo dev server
npm run typecheck                              # tsc --noEmit — run before committing
npm test | npm run test:coverage               # jest
npm run test:e2e                               # maestro flows
npm run build:prod:android                     # EAS app-bundle (Android first)
npm run build:prod:ios                         # EAS iOS
npm run update:prod                            # EAS OTA update (production channel)
```

---

## 7. Cross-cutting concerns — `src/lib/`

- **`sentry.ts`** — `initSentry()` is a no-op without `EXPO_PUBLIC_SENTRY_DSN`;
  `tracesSampleRate 0.1`, `sendDefaultPii: false`, scrubs auth/cookie/csrf headers
  and password/token/secret fields, strips auth-route request bodies from
  breadcrumbs. `wrapApp = Sentry.wrap` (root error boundary).
- **`otaUpdates.ts`** — `checkAndDownloadUpdate()` fired at boot (no-op in Expo
  Go / dev); downloads in the background, applies on next cold start.
- **`notifications.ts`** — foreground handler, `getExpoPushToken()`, and
  **local appointment reminders** (`scheduleAppointmentReminder` 30-min lead,
  `syncReminders` idempotent). Local reminders fully work; **remote push does not
  yet** (no device-registration backend — see `FEATURE_STATUS.md`).
- **`offlineGuard.ts`** — `OfflineError`, `requireOnline()`, `isOfflineError()`.
- **`permissions.ts`** — mirrors the web RBAC: admin/dentist = full; assistant via
  `assistant_permissions` (`module.action`); a `read_only` subscription blocks
  manage. Use `canView` / `canManage` / `isSubscriptionReadOnly` — **never** check
  the role string directly.

---

## 8. Conventions (do these or things break subtly)

1. **Errors:** branch on `ApiError.kind`, never raw axios.
2. **Money** is UZS **integers** (no minor units). **Dates** `YYYY-MM-DD`, **times** `HH:mm` (24h).
3. **Writes require `access_mode === 'full'`** and the right assistant permission —
   gate UI with `canManage(...)`; the API layer also calls `requireOnline()`.
4. **Bump `@identa/query-cache-vN`** in `App.tsx` when a mapper's output shape changes.
5. **Default locale is `ru`.** New user-facing strings go in all three of
   `src/i18n/translations` — `ru`, `uz`, `en` (no key is allowed to exist in only one).
6. Run `npm run typecheck` before every commit (`ci` = typecheck + coverage).

---

## 9. Testing surfaces (detail in `QA_VERIFICATION.md`)

- **Jest** (`src/**/__tests__`, ~23 files): api modules, lib helpers, stores
  (95% floor), `api/client.ts` (80% floor), a few components. Global coverage floor
  is intentionally low; the high floors are where they matter (stores + client).
- **Maestro** E2E (`.maestro/flows/`, 10 flows) with tags `smoke / auth / navigation
  / odontogram / treatment` — run via `npm run test:e2e[:smoke|:auth|:nav|…]`.
