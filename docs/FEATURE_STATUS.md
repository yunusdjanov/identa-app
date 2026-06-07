# Identa Mobile — Feature Status

> A screen-by-screen / feature-by-feature snapshot of what is **Done**,
> **Partial**, or **Missing**, with file-level evidence and parity notes vs the
> web app. Use this to know exactly what's left before calling the app shippable.
>
> Verified against the codebase 2026-06-05 (3 independent read-throughs).
> Legend: ✅ Done · 🟡 Partial · ⛔ Missing/stub.

## TL;DR

The app is **further along than "70–75%" in the clinical core** — patients,
treatments, appointments and clinical images are fully built and wired to the
real API. The remaining work is concentrated in: **(a) auth extras** (Google
sign-in, biometrics), **(b) three Settings sub-features with no backend yet**
(notification prefs, active sessions, push-device registration), **(c) billing
checkout**, and **(d) polish** (dark-mode rollout, locale persistence, EAS
project wiring). None of the clinical CRUD paths are blocked.

| Domain | Status | One-line |
|---|---|---|
| Auth (login/register/reset/change pw) | ✅ | Solid; Google + biometric are stubs |
| Dashboard | ✅ | Real KPIs; only the sparkline trend is synthetic |
| Patients (list/detail/CRUD/photo) | ✅ | Complete |
| Odontogram | 🟡 | View-only — no standalone condition editing |
| Treatments | ✅ | Full CRUD incl. tooth picker + images |
| Gallery / clinical images | ✅ | Upload wired; scan-status + variant fallback handled |
| Appointments (week/day/CRUD/conflicts) | ✅ | Complete |
| Payments / debts | ✅ | Read view + quick-payment write; no invoice UI (intentional) |
| Settings — profile/hours/practice/pw/team/lang/theme | ✅ | Complete, real APIs |
| Settings — notifications prefs | ⛔ | UI built, **mock-only** (no backend route) |
| Settings — active sessions | ⛔ | UI built, **mock-only** (no backend route) |
| Push notifications (remote delivery) | ⛔ | Token fetched but **device registration is mock-only** |
| Billing upgrade / in-app checkout | ⛔ | CTA is a `comingSoon` stub |
| Notification center / inbox (header bell) | ⛔ | `comingSoon` stub |

---

## Auth — ✅ (two stubs)

**Done:** Email/password login (sends `device_name`, splits the flattened
`{user, tokens}`, lands the token before any authed request); register → auto
login chain (register issues no tokens, by backend design); forgot/reset password
with the full CSRF deep-link flow; change-password; email-verification resend +
dashboard banner; logout (tolerant of CSRF failure, clears query cache + store);
SecureStore session with backward-compatible hydrate; role/subscription gating on
entry.

**Missing / stub:**
- ⛔ **"Continue with Google"** is a stub on both Login (`LoginScreen.tsx:217`) and
  Register (`RegisterScreen.tsx:338`) → `toast.info(comingSoon)`. *(The web app just
  shipped a real Google link/connect flow — see web `27d3c1b`. Mobile parity is
  pending.)*
- ⛔ **Biometric / Face-ID unlock** — not implemented (no `expo-local-authentication`).
- 🟡 **"Remember me"** checkbox is decorative (state set but unused; the session is
  always persisted).

## Dashboard — ✅

**Done:** snapshot query keyed to local "today"; camelCase→snake remap + `Number()`
coercion (with the documented earlier bug fixed, `dashboard.ts:128-167`); KPIs for
revenue, outstanding debt, today's appointments, next-appointment; swipe-to-
complete/cancel with optimistic cache patch + reminder cancellation; permission-
gated cards; offline/error/empty/after-hours states.

**Caveat:** 🟡 the finance **sparkline trend is synthetic** — `buildTrend()` fabricates
a 7-day wobble because the backend returns no history series yet
(`DashboardScreen.tsx:119-130, 479-498`). The KPI numbers themselves are real.
Either ship a real history endpoint or hide the sparkline before launch.

## Patients — ✅

**Done:** list with debounced search, category chips, archived + inactive(6-month)
filters, pull-to-refresh, A–Z grouping, permission gating; detail/overview (vitals,
contact, medical, 3 finance cards, upcoming appointments, treatment history,
archive/restore/force-delete with type-to-confirm, scan-gated photo); full
create/edit via `PatientFormSheet` (phones E.164-normalized, DOB wheel, category,
allergies/meds/history, photo pick+upload+remove, client validation mirroring
`StorePatientRequest`). `api/patients.ts` is complete (list/get/overview/create/
update/archive/restore/forceDelete/photo/categories).

**Minor gaps:** list requests `per_page: 100` instead of true infinite scroll
(`PatientListScreen.tsx:98`) — fine at clinic scale; no patient-level "quick
payment" shortcut (the `/patients/{id}/quick-payments` endpoint is reached only
through the treatment flow).

## Odontogram — 🟡 (view-only)

**Done:** 32-tooth chart (4 quadrants), condition colors from the summary endpoint,
per-tooth treatment-count badges, summary cards, tooth-detail modal with per-tooth
accounting + history.

**Missing:** ⛔ no way to create/edit a **standalone odontogram condition entry** —
`listPatientOdontogram` (`odontogram.ts:21`) is never called and there are no write
endpoints. Conditions change only indirectly via treatments. This is **by design**
(treatments are the source of truth), but if the product wants direct charting it's
unbuilt. Confirm the intended UX before treating it as a gap.

## Treatments — ✅

**Done:** full CRUD (`treatments.ts`): create/update/delete
`POST/PUT/DELETE /patients/{id}/treatments`, single-fetch with images, payment via
quick-payments. `TreatmentEditSheet.tsx` covers type, back-datable date (capped at
today), an embedded **tooth picker** (odontogram), debt/paid amounts, 5000-char
comment, photo upload, 422 field-error mapping, delete-with-confirm. Reachable from
Patient Detail and Odontogram. Web parity met.

## Gallery / clinical images — ✅

**Done:** `ImagePickerSheet` (camera + library, Android modal-race workaround,
selection cap), `PhotoGallery`, `LightboxViewer`. Upload wired as multipart with the
critical `Content-Type: undefined` boundary fix (`treatments.ts:437`).
`scan_status` handled (rejected hidden; `resolveTreatmentImageUrl` does
preview→thumbnail→url fallback); patient photo gated on `pending`/`rejected`;
subscription `entry_image_limit` respected.

## Appointments — ✅

**Done:** week-grid + day-timeline views, segmented switch, week strip with busy-day
dots, swipe navigation, "now" line, jump-to-today; conflict detection
(`appointmentConflicts.ts`, excludes cancelled/no_show); create/edit/detail sheets
(create sheet mounted globally, opened with patient/date prefill); optimistic status
changes (blocks editing finalized appts), delete with reminder cancellation; correct
`reason`→`notes` mapping (`appointments.ts:7-16`); list with `filter[date_from/to/
status]`.

## Payments / debts — ✅

**Done:** read-only debt/history view aggregating treatments by patient (paid/debt/
net totals, patient + history tabs, search, sorted by |balance|). The **write** path
lives in `TreatmentDetailSheet`: record payment with amount validation + balance cap,
**cash / card / bank_transfer** selector, notes, via `recordQuickPayment` →
`POST /patients/{id}/quick-payments`; delete payment with cache invalidation.
`read_only` gating is correct (`canManage(user,'payments')`).

**Notes:** ⛔ no standalone invoice UI — **intentional** (mobile abstracts invoices
away, documented `payments.ts:8-17`). `updatePayment` wrapper exists but has no edit
UI (delete + re-record instead).

## Settings — 🟡 (UI complete; 3 sub-features mock-backed)

**Done (real APIs):** profile edit, working hours, practice info (all
`/settings/profile`), password change, language, theme/appearance, **team/staff
management with full CRUD** (`/team/assistants`, dentist-only gated), billing view of
the real `user.subscription`, logout. All 11 sheets are wired.

**Missing / mock-only (no backend route exists yet):**
- ⛔ **Notification preferences** — `notifications.ts:8` hardcoded `USE_MOCK = true`;
  the sheet UI is real but persists nowhere.
- ⛔ **Active sessions** — `sessions.ts:11` hardcoded `USE_MOCK = true` with seeded
  fake sessions; "revoke" hits the mock.
- ⛔ **Push-device registration** — `devices.ts:8` hardcoded `USE_MOCK = true`. The
  Expo token is fetched at startup (`navigation/index.tsx:98-100`) but only ack'd to
  memory, so **remote push cannot be delivered**. *(Local appointment reminders DO
  work — `lib/notifications.ts`.)*
- ⛔ **Billing upgrade** CTA is a stub (`BillingSheet.tsx:84` → `comingSoon`) — no
  in-app checkout.
- ⛔ **Notification center** behind the dashboard header bell is a stub
  (`DashboardHeader.tsx:84` → `comingSoon`).

---

## Parity with the web app

Present on web, **not** on mobile (decide per-product whether each is in scope):
- Audit logs · advanced analytics dashboard · standalone invoices.

Present on **both** and at parity: patients, appointments, treatments, payments
(quick), odontogram (web has editing; mobile view-only), team/staff management,
profile/practice settings, subscription/billing **view**.

Just shipped on web, **pending on mobile**: **Google account link/connect** (web
`Settings → Connected Accounts`). The mobile FAQ/UX should follow once the mobile
Google flow lands.
