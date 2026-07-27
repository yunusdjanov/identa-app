# Identa Mobile — Continuation Roadmap

> Prioritized remaining work to take the app from its current state to a
> shippable Android release (then iOS). Each item lists **why**, **where**,
> **backend dependency**, and a rough **effort** (S ≤ ½ day · M ≈ 1–2 days ·
> L ≈ 3+ days). Source of truth for "what exists" is `FEATURE_STATUS.md`.
>
> Drafted 2026-06-05.
>
> Product update 2026-07-15: notifications are paused for the current mobile
> release. P1.1, P1.3 and P2.2 are retained for future reference, but their UI,
> native permission/plugin and device-registration code are not in the APK.

## How to read this
The clinical core (patients, appointments, treatments, payments, images) is
**done**. What's left is mostly: build/release plumbing, a few backend-dependent
Settings features, auth extras, and polish. Items marked **[BE]** are blocked on a
backend endpoint that does not exist yet — coordinate with the Laravel team.

---

## P0 — Launch blockers (do before the first real build/release)

### P0.1 — Wire the EAS project id · S · Completed
`app.json → extra.eas.projectId` is configured and the Android EAS build profiles
are wired. Re-check ownership only when changing Expo accounts.

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

### P0.4 — Locale persistence · S · Completed
The selected locale is persisted in AsyncStorage and rehydrated by
`I18nProvider`; cold starts no longer reset the language to Russian.

---

## P1 — Important (needed for a "complete" feeling app)

### P1.1 — Remote push delivery · M · [BE]
Deferred by product decision. The current build contains no Expo Notifications
plugin, native notification permission, local reminder scheduler, push token
registration or inbox. If resumed, start with a backend device-registration and
delivery contract; do not add a permission prompt before the feature is usable.

### P1.2 — Google sign-in on mobile · M
Stub on Login (`LoginScreen.tsx:217`) and Register (`RegisterScreen.tsx:338`). The
**web app already shipped** the Google connect/link flow; mobile should reach
parity. Implement with Expo's Google auth (`expo-auth-session` / native Google
sign-in), exchange for a Sanctum token via the backend's Google endpoint. Confirm
the backend's account-linking policy (existing-email accounts must link from
Settings, per web `27d3c1b`) and mirror that UX/messaging on mobile.

### P1.3 — Notification preferences backend + wire · S · [BE]
Deferred by product decision. There is no notification Settings UI, native
plugin/permission, device registration, or preferences API in the current APK.
If resumed, define the backend contract before reintroducing the mobile surface.

### P1.4 — Active sessions backend + wire · S · [BE]
UI is built; `sessions.ts:11` is `USE_MOCK=true`. Needs **[BE]** a sessions/activity
list + revoke endpoint, then remove the mock. (Security-sensitive — pairs well with
the web's session management.)

### P1.5 — In-app billing / upgrade · L · Completed
Mobile now uses the real PayX checkout, scheduled downgrade and cancellation
contracts, plus bounded payment-history pagination. Checkout redirects are
restricted to HTTPS on both backend and mobile.

---

## P2 — Polish & parity (post-launch or as time allows)

### P2.1 — Dark-mode rollout · L
Deferred by product decision. The current release is explicitly light-only and
the appearance selector is removed. If dark mode returns, complete a full-screen
visual/accessibility pass before exposing the selector again.

### P2.2 — Notification center / inbox · M
Deferred by product decision. There is no header bell in the current build.
An inbox depends on P1.1 plus a real backend notification feed.

### P2.3 — Patient-level quick-payment shortcut · S
Add a "record payment" action on Patient Detail that opens the quick-payment flow
directly (today it's only reachable through a treatment).

### P2.4 — Real pagination · M
Lists fetch `per_page: 100` (patients) / `500` (appointments) instead of paginating.
Fine at clinic scale; revisit if any clinic exceeds those counts (switch to
infinite-scroll using the `PaginationMeta` the API already returns).

### P2.5 — Expand E2E coverage · M
Maestro covers smoke/auth/nav/treatment. Add flows for **appointment
create/edit, patient create/edit, payment recording, settings** before treating
Maestro as a release gate (`QA_VERIFICATION.md §2`).

### P2.6 — Deep-link host parity · S
`app.json` declares `app.identa.uz` (associatedDomains / intent filters) but
`linking.prefixes` only lists `identa.uz`. Align them if universal links on
`app.identa.uz` are needed.

### P2.7 — Decide on invoice UI · S
Mobile intentionally hides standalone invoices (`payments.ts:8-17`). Confirm that's
the final product decision; if invoices are needed on mobile, scope a screen.

---

## Recommended sequence

1. **P0 block** (sparkline decision and release config)
   — small, unblocks a trustworthy Android build.
2. **P1.2 Google sign-in** when mobile account-linking policy is approved.
3. **P1.1 / P1.3 / P1.4** only if deferred notifications/sessions are resumed.
4. Finish **P2** pagination and E2E/device regression as capacity allows.

## Backend coordination checklist (give this to the Laravel team)
- [ ] `/devices/register` (push tokens) — P1.1
- [ ] `/settings/notifications` GET/PUT — P1.3
- [ ] Active-sessions list + revoke — P1.4
- [x] Mobile billing/checkout (PayX) entry — P1.5
- [ ] (Optional) dashboard revenue history series — P0.2(b)
- [ ] Confirm the Google account-linking contract for mobile — P1.2
