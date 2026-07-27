# Identa Mobile — Feature Status

> A screen-by-screen / feature-by-feature snapshot of what is **Done**,
> **Partial**, or **Missing**, with file-level evidence and parity notes vs the
> web app. Use this to know exactly what's left before calling the app shippable.
>
> Settings/finance status re-verified against the mobile and Laravel codebases
> on 2026-07-26.
> Legend: ✅ Done · 🟡 Partial · ⛔ Missing/stub.

## TL;DR

The app is **further along than "70–75%" in the clinical core** — patients,
treatments, appointments and clinical images are fully built and wired to the
real API. The remaining work is concentrated in auth extras (Google sign-in,
biometrics), deferred notification/session features that currently have no
mobile surface, and release verification. Dark mode is intentionally paused,
locale persistence and PayX billing are implemented, and none of the clinical
CRUD paths are blocked.

| Domain | Status | One-line |
|---|---|---|
| Auth (login/register/reset/change pw) | ✅ | Solid; Google + biometric are stubs |
| Dashboard | ✅ | Real KPIs; only the sparkline trend is synthetic |
| Patients (list/detail/CRUD/photo) | ✅ | Complete |
| Treatments | ✅ | Full CRUD incl. tooth picker + images |
| Gallery / clinical images | ✅ | Upload wired; scan-status + variant fallback handled |
| Appointments (week/day/CRUD/conflicts) | ✅ | Complete |
| Payments / debts | ✅ | Currency-safe ledger + expenses CRUD + patient PDF export |
| Settings — profile/hours/practice/pw/team/lang/billing | ✅ | Complete, real APIs |
| Settings — notifications prefs | ⏸ | Temporarily removed from mobile by product decision |
| Settings — active sessions | ⏸ | Not exposed; backend route does not exist |
| Push notifications (remote delivery) | ⏸ | Temporarily removed; no native permission/plugin in the build |
| Billing upgrade / in-app checkout | ✅ | PayX checkout, downgrade, cancellation and bounded payment history |
| Notification center / inbox | ⏸ | Deferred; no header action in the current build |

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
complete/cancel with optimistic cache patch; permission-
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
(`PatientListScreen.tsx:98`) — fine at clinic scale.

## Treatments — ✅

**Done:** full CRUD (`treatments.ts`): create/update/delete
`POST/PUT/DELETE /patients/{id}/treatments`, single-fetch with images.
`TreatmentEditSheet.tsx` covers type, back-datable date (capped at
today), an embedded **tooth picker**, debt/paid amounts, 5000-char
comment, photo upload, 422 field-error mapping, delete-with-confirm. Reachable from
Patient Detail. The standalone odontogram feature is intentionally out of mobile scope.

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
changes (blocks editing finalized appts), delete with confirmation; correct
`reason`→`notes` mapping (`appointments.ts:7-16`); list with `filter[date_from/to/
status]`.

## Payments / debts — ✅

**Done:** server-aggregated, paginated patient ledger and treatment-level history;
UZS/USD totals stay separate; debt, settled balance and advance are represented
explicitly. Search and outstanding filters affect only the list, never the global
summary cards. Patient finance detail is authorized by `payments.view` alone and
uses the ledger endpoint rather than loading clinical history. Expenses support
validated CRUD, offline guards and idempotent create. Filtered patient/expense list
exports and patient-ledger PDF export are permission-gated, bounded, and remove
their temporary files after sharing.

**Notes:** payment values are authored on treatment records (`debt_amount`,
`paid_amount`, currency), matching the current web/backend contract. Legacy
quick-payment, invoice and standalone Payment client wrappers have been removed.

## Settings — 🟡 (core complete; selected extras deferred)

**Done (real APIs):** profile edit, working hours, practice info (all
`/settings/profile`), password change, persisted language, **team/staff
management with full CRUD** (`/team/assistants`, dentist-only gated), PayX billing
management and logout. Editable sheets guard unsaved changes and all security/
subscription mutations follow the backend permission contract.

**Deferred / mock-only:**
- ⏸ **Notifications** — temporarily removed from mobile. The Expo plugin,
  native notification permission, local-reminder scheduler, device registration,
  preferences API and Settings sheet are not part of the current build.
- ⏸ **Dark mode** — temporarily removed from Settings; the current release is
  explicitly light-only (`app.json → userInterfaceStyle`).
- ⏸ **Active sessions** — the unfinished mock implementation is not reachable
  from Settings because no backend list/revoke contract exists.

---

## Parity with the web app

Present on web, **not** on mobile (decide per-product whether each is in scope):
- Selected admin-only workflows and billing checkout.

Present on **both** and at parity: patients, appointments, treatments, payments
(treatment ledger + expenses), team/staff management,
profile/practice settings, subscription/billing **view**.

Just shipped on web, **pending on mobile**: **Google account link/connect** (web
`Settings → Connected Accounts`). The mobile FAQ/UX should follow once the mobile
Google flow lands.
