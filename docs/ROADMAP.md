# Identa Mobile — Continuation Roadmap

> Prioritized remaining work to take the app from its current state to a
> shippable Android release (then iOS). Each item lists **why**, **where**,
> **backend dependency**, and a rough **effort** (S ≤ ½ day · M ≈ 1–2 days ·
> L ≈ 3+ days). Source of truth for "what exists" is `FEATURE_STATUS.md`.
>
> Drafted 2026-06-05.

## How to read this
The clinical core (patients, appointments, treatments, payments, images) is
**done**. What's left is mostly: build/release plumbing, a few backend-dependent
Settings features, auth extras, and polish. Items marked **[BE]** are blocked on a
backend endpoint that does not exist yet — coordinate with the Laravel team.

---

## P0 — Launch blockers (do before the first real build/release)

### P0.1 — Wire the EAS project id · S
`app.json → extra.eas` is empty (`{}`). Without a `projectId`, EAS builds/OTA and
**Expo push-token resolution no-op**. Run `eas init`, commit the generated id.
*Verify on a real dev build, not Expo Go.* Files: `app.json`, `eas.json`.

### P0.2 — Decide the dashboard sparkline · S
The finance trend line is **synthetic** (`DashboardScreen.tsx:119-130, 479-498`).
Shipping fabricated data in a medical/finance product is a credibility risk.
Either: **(a)** hide the sparkline until a real history endpoint exists, or
**(b) [BE]** add a `dashboard/revenue-series` endpoint and render real points.
Recommend (a) now, (b) later.

### P0.3 — Confirm release config · S
- `eas.json submit` has `REPLACE_WITH_*` Apple placeholders — fill before any iOS
  submit (Android-first, so this can trail the Android launch).
- Confirm `production` profile env (`EXPO_PUBLIC_API_URL=https://api.identa.uz/api/v1`,
  `USE_MOCK_API=false`, Sentry DSN) and that `runtimeVersion` policy matches your
  OTA plan.

### P0.4 — Locale persistence · S
Language resets to `ru` on every cold start (it's never written to storage).
A clinic that picks Uzbek will be annoyed daily. Persist the selected locale to
AsyncStorage and rehydrate in `I18nProvider` (mirror the `theme` store pattern).
Files: `src/i18n/index.tsx`, `src/lib/currentLocale.ts`.

---

## P1 — Important (needed for a "complete" feeling app)

### P1.1 — Remote push delivery · M · [BE]
Local appointment reminders work; **remote push does not** — `devices.ts:8` is
`USE_MOCK=true` and there's no `/devices/register` route, so the fetched Expo token
goes nowhere. Needs: **[BE]** a device-registration endpoint, then flip
`devices.ts` to real and confirm `navigation/index.tsx:98-100` posts the token.
Depends on P0.1 (projectId).

### P1.2 — Google sign-in on mobile · M
Stub on Login (`LoginScreen.tsx:217`) and Register (`RegisterScreen.tsx:338`). The
**web app already shipped** the Google connect/link flow; mobile should reach
parity. Implement with Expo's Google auth (`expo-auth-session` / native Google
sign-in), exchange for a Sanctum token via the backend's Google endpoint. Confirm
the backend's account-linking policy (existing-email accounts must link from
Settings, per web `27d3c1b`) and mirror that UX/messaging on mobile.

### P1.3 — Notification preferences backend + wire · S · [BE]
UI is built; `notifications.ts:8` is `USE_MOCK=true`. Needs **[BE]**
`/settings/notifications` GET/PUT, then remove the mock branch.

### P1.4 — Active sessions backend + wire · S · [BE]
UI is built; `sessions.ts:11` is `USE_MOCK=true`. Needs **[BE]** a sessions/activity
list + revoke endpoint, then remove the mock. (Security-sensitive — pairs well with
the web's session management.)

### P1.5 — In-app billing / upgrade · L · [BE]
`BillingSheet.tsx:84` CTA is a `comingSoon` stub. Needs a checkout path (likely a
PayX flow, possibly via WebView/redirect) coordinated with the backend billing
service. Until then, the upgrade journey is web-only — make sure the copy points
users to the web cabinet rather than dead-ending.

---

## P2 — Polish & parity (post-launch or as time allows)

### P2.1 — Dark-mode rollout · L
Theme infra exists (`theme.ts`, `useColors`), but most components import the static
`colors` palette directly, so dark mode is only partially live despite
`userInterfaceStyle: automatic`. Migrate components to `useColors()` screen-by-screen
(it's tracked, ~dozens of files). Either finish it or hide the dark/auto option until
it's complete.

### P2.2 — Notification center / inbox · M
Dashboard header bell is a stub (`DashboardHeader.tsx:84`). Build an inbox screen
(depends on P1.1 push + a backend notifications feed).

### P2.3 — Odontogram direct condition editing · M
Currently view-only by design (conditions flow from treatments). If the product
wants direct charting, wire `listPatientOdontogram` (`odontogram.ts:21`, unused) and
add create/update/delete entry endpoints **[BE]** + UI. **Confirm the product intent
first** — this may be intentionally out of scope.

### P2.4 — Patient-level quick-payment shortcut · S
Add a "record payment" action on Patient Detail that opens the quick-payment flow
directly (today it's only reachable through a treatment).

### P2.5 — Real pagination · M
Lists fetch `per_page: 100` (patients) / `500` (appointments) instead of paginating.
Fine at clinic scale; revisit if any clinic exceeds those counts (switch to
infinite-scroll using the `PaginationMeta` the API already returns).

### P2.6 — Expand E2E coverage · M
Maestro covers smoke/auth/nav/odontogram/treatment. Add flows for **appointment
create/edit, patient create/edit, payment recording, settings** before treating
Maestro as a release gate (`QA_VERIFICATION.md §2`).

### P2.7 — Deep-link host parity · S
`app.json` declares `app.identa.uz` (associatedDomains / intent filters) but
`linking.prefixes` only lists `identa.uz`. Align them if universal links on
`app.identa.uz` are needed.

### P2.8 — Decide on invoice UI · S
Mobile intentionally hides standalone invoices (`payments.ts:8-17`). Confirm that's
the final product decision; if invoices are needed on mobile, scope a screen.

---

## Recommended sequence

1. **P0 block** (projectId, sparkline decision, release config, locale persistence)
   — small, unblocks a trustworthy Android build.
2. **P1.2 Google sign-in** + **P1.1 push** (both visible, expected features).
3. **P1.3 / P1.4** (notifications & sessions) once the backend endpoints land.
4. **P1.5 billing**, then **P2** polish (dark mode, inbox, pagination, E2E) as
   capacity allows.

## Backend coordination checklist (give this to the Laravel team)
- [ ] `/devices/register` (push tokens) — P1.1
- [ ] `/settings/notifications` GET/PUT — P1.3
- [ ] Active-sessions list + revoke — P1.4
- [ ] Mobile billing/checkout (PayX) entry — P1.5
- [ ] (Optional) dashboard revenue history series — P0.2(b)
- [ ] (Optional) odontogram condition CRUD — P2.3
- [ ] Confirm the Google account-linking contract for mobile — P1.2
