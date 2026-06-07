# Identa Mobile — QA & Verification Plan

> How to run the app, run the automated suites, and manually verify each feature
> before a release. Pair this with `FEATURE_STATUS.md` (what exists) and
> `ARCHITECTURE.md` (how it's wired).
>
> Verified 2026-06-05.

---

## 1. Environments & how to run

### Prerequisites
- Node + npm, the Expo tooling (`npx expo`), and either Android Studio (emulator)
  or Xcode (iOS simulator) — or a physical device with **Expo Go** (dev) / a dev
  build.
- For real-backend testing: the Laravel API running locally (`Identa web` backend)
  or pointed at staging/prod.

### Point the app at a backend (`.env` → `EXPO_PUBLIC_API_URL`, must end in `/v1`)
| Target | URL |
|---|---|
| Android emulator → host localhost | `http://10.0.2.2:8001/api/v1` (the default) |
| iOS simulator / physical device on LAN | `http://<your-LAN-IP>:8001/api/v1` |
| Staging/prod | `https://api.identa.uz/api/v1` |

> `10.0.2.2` is an **Android-emulator-only** alias for the host. iOS and physical
> devices must use the machine's LAN IP. This is the #1 "why won't it connect" trap.

### Mock vs real
- `EXPO_PUBLIC_USE_MOCK_API=true` → run with **no backend** (good for UI/nav QA).
- `=false` (the build default) → hit the real API.
- Flip one slice at a time with `EXPO_PUBLIC_MOCK_{AUTH,PATIENTS,…}=false` while
  wiring a new endpoint.

### Run
```
npm start            # dev server (press a = Android, i = iOS)
npm run android      # build+run Android
npm run ios          # build+run iOS
```

---

## 2. Automated tests (run these first — they're the cheap gate)

```
npm run typecheck        # tsc --noEmit — MUST be clean before any commit
npm test                 # jest unit/integration
npm run test:coverage    # jest + coverage (used by `ci`)
npm run ci               # typecheck + test:coverage (the gate)
npm run test:e2e         # all Maestro flows (needs a running device/emulator + app)
```

### Jest (`src/**/__tests__`, ~23 files)
Covers the **logic that must not regress**: `api/client.ts` (auth/refresh/error
normalization — 80% floor), all `stores/*` (95% floor), api slices
(`patients-search`, `patients-mutations`, `appointments`, `payments`, `treatments`,
`team`, `odontogram`), and lib helpers (`format`, `groupPatients`, `permissions`,
`offlineGuard`, `currentLocale`, `useDebouncedValue`). Uses `axios-mock-adapter`.
Global coverage floor is intentionally low; **don't chase the global number — keep
the high floors on `stores/` and `api/client.ts` green.**

### Maestro E2E (`.maestro/flows/`, 10 flows, appId `uz.identa.mobile`)
Tagged for targeted runs:
| Flow | Tags |
|---|---|
| `00-smoke` | smoke |
| `01-login` / `02-login-failure` | smoke,auth / auth |
| `03-tab-navigation` / `04-patient-search` | navigation |
| `05-odontogram` | navigation,odontogram |
| `06-treatment-create` / `07-treatment-delete` | navigation,treatment |
| `08-logout` | auth,smoke |
| `09-dashboard-smoke` | smoke,navigation |
```
npm run test:e2e:smoke      # fast confidence pass
npm run test:e2e:auth       # auth flows
npm run test:e2e:nav        # navigation
npm run test:e2e:odontogram # odontogram
npm run test:e2e:treatment  # treatment create/delete
```
> **E2E gaps to add** (see `ROADMAP.md`): no flow for appointment create/edit,
> patient create/edit, payment recording, or settings. Add these before relying on
> Maestro as a release gate.

---

## 3. Manual QA checklist

Run this matrix on **both** a real Android build and an iOS build (clinical app →
both platforms matter), against the **real backend**, with a **dentist** account
and at least once with an **assistant** (limited permissions) and a **read-only**
(expired) subscription.

### Smoke (every build)
- [ ] Cold start: splash → lands on Login (logged out) or Dashboard (logged in).
- [ ] Login with valid creds; wrong creds shows a field/error toast, not a crash.
- [ ] Kill & relaunch → still logged in (SecureStore session survives).
- [ ] Airplane mode: cached lists still render; a write shows the offline toast;
      back online → writes work.
- [ ] Logout returns to Login and clears data.

### Auth
- [ ] Register → auto-login chain lands on Dashboard.
- [ ] Forgot password → email; reset deep link (`identa://reset-password?...` /
      `https://identa.uz/reset-password`) opens ResetPassword prefilled.
- [ ] Change password from Settings.
- [ ] Email-verification banner appears for unverified users; "resend" works.
- [ ] ⚠️ Google sign-in is a **stub** — expect a "coming soon" toast (not a bug yet).

### Dashboard
- [ ] KPIs (revenue / outstanding debt / today's appointments) match the backend.
- [ ] Swipe an appointment row → complete/cancel updates optimistically and sticks.
- [ ] ⚠️ Sparkline is **synthetic** — don't validate its shape against real history.
- [ ] After-hours / empty / error / offline states render.

### Patients
- [ ] Search (debounced), category filter, archived & inactive filters.
- [ ] Create patient (phone normalization, DOB wheel, category, photo upload).
- [ ] Edit patient; archive → restore → force-delete (type-to-confirm).
- [ ] Photo only shows when `photo_scan_status` is approved (upload a fresh one →
      pending → appears after backend scan).

### Appointments
- [ ] Week grid ↔ day timeline switch; week strip dots; swipe weeks; jump-to-today.
- [ ] Create appointment (patient + date prefill from other screens works).
- [ ] Conflict warning when overlapping a scheduled appointment.
- [ ] Status change (scheduled→completed/cancelled/no_show) + reminder cancels.
- [ ] Local reminder fires ~30 min before (leave the app, wait / set a near time).

### Treatments / odontogram / images
- [ ] Open a patient → add treatment (type, back-dated date, tooth picker, amounts,
      comment, photos). Edit and delete.
- [ ] Record a payment on a treatment (cash/card/bank_transfer; amount capped at
      balance). Delete a payment; balances recompute.
- [ ] Odontogram chart colors + per-tooth counts match the summary; tooth-detail
      modal opens. ⚠️ No standalone condition editing (by design).

### Payments
- [ ] Debt list totals (paid/debt/net) and per-patient balances are correct.
- [ ] As a **read-only** subscription: write controls are hidden/disabled
      (record-payment, edit, create everywhere).
- [ ] As an **assistant** without `payments.manage`: same gating.

### Settings
- [ ] Profile edit, working hours, practice info, password change → persist (real API).
- [ ] Team/staff: create assistant, set permissions, reset password, deactivate
      (dentist-only; assistants don't see this section).
- [ ] Language switch (ru/uz/en) updates UI. ⚠️ **Known bug:** locale resets to `ru`
      on next cold start (not persisted) — see `ROADMAP.md`.
- [ ] Theme light/dark/auto. ⚠️ Dark mode is **partial** — expect some screens still
      light-styled.
- [ ] ⚠️ Notification prefs / Active sessions / Billing-upgrade are **mock or stub** —
      changes won't persist; don't file as bugs until those backends exist.

---

## 4. API contract verification

Because the backend has casing/naming traps, verify these explicitly when wiring or
upgrading a slice (full contract in `IDENTA_WEB_REFERENCE.md`):
- [ ] List filters go out as nested `filter[search]` / `filter[status]` / `filter[
      category_id]` / `filter[date_from|to]` / `filter[archived_only]` — **not** flat.
- [ ] Appointment **writes send `reason`**, reads come back as **`notes`**.
- [ ] Dashboard snapshot arrives **camelCase** with string decimals →
      remapped + `Number()`-coerced in `api/dashboard.ts`.
- [ ] Auth: login response is **flattened** `{...user, tokens}`; `device_name` is the
      Sanctum token name; **register returns no tokens** (must login after).
- [ ] `/auth/refresh` works **without** CSRF; the other auth routes **require** the
      `GET /auth/csrf-token` bootstrap.
- [ ] Image URLs (`url`/`thumbnail_url`/`preview_url`) may be null while the backend
      generates variants → preview→thumbnail→url fallback renders something.

---

## 5. Regression watch / release gotchas

- **Cache key:** if you change any `api/*` response mapper's output shape, bump
  `@identa/query-cache-vN` in `App.tsx`. Skipping this hydrates stale rows from a
  previous version (classic symptom: a dashboard card shows a non-number).
- **EAS push:** `app.json → extra.eas` is empty (no `projectId`). Until `eas init`
  wires it, expo push-token resolution may no-op — verify on a real build, not Expo Go.
- **Submit creds:** `eas.json` `submit` has `REPLACE_WITH_*` Apple placeholders — fill
  before `npm run submit:ios`.
- **New strings** must exist in all three locales (`ru`/`uz`/`en`) — a missing key
  silently renders the raw path.
- **Run on real hardware** before release: image picker, camera, push permission
  prompts, haptics, and reanimated gestures behave differently from the simulator.
