# Mobile ↔ Web — Parity Gap Report

> **RE-BASELINE (post-commit `fe7419f`, 2026-06-05):** a large parity batch is now
> committed. **Closed:** patient-detail parity (vitals, upcoming appts, force-
> delete, photo-moderation gating), Dialog/type-to-confirm, inactive 6-month
> filter, treatment date/image/comment caps, gender removal, plus this session's
> permissions, calendar-correct age, debt-always-red, locale persistence,
> payments sort tiebreak, DOB max.
> **Still remaining:** BIG → Analytics screen · billing checkout · Google sign-in
> (still a stub) + Connected Accounts (absent) · Staff audit-logs tab · PDF export.
> Product-paused: notification prefs/push. Backend-blocked: active sessions ·
> push-device registration. Small → reason/notes `|` encoding · 1-year inactive
> filter · phone normalization (web change) · currency format (device-verify).
> Quality → EAS projectId · synthetic sparkline · deep-link host · dark mode.
> The sections below are the original analysis (pre-commit) kept for reference.



> Goal: bring **Identa Mobile** to 1:1 with the **current web app**. The mobile
> app was built against an older web version (~70–75% match). This report
> compares the **current web** (inventoried 2026-06-05) against **mobile now**,
> page by page, and proposes a decision for each gap so you can pick per feature.
>
> **You decide each row:** ✅ Bring to mobile · ⏸ Later · ❌ Skip (keep mobile as-is).
> Backend can be extended, so nothing is permanently blocked. Items needing a new
> endpoint are marked **[BE]**.
>
> Legend: **=** already at parity · **Δ** differs · **＋web** web has it, mobile doesn't ·
> **＋mob** mobile has it, web doesn't.

---

## A. Big decisions first (the large gaps)

| # | Gap | Current state | Recommendation |
|---|---|---|---|
| BIG-1 | **Analytics screen** | Web has full `/analytics` (KPIs + 4 charts + date ranges). **Mobile has NONE.** | Decide: build a mobile Analytics screen (M–L, charts on RN), or skip (dashboard already shows key KPIs). |
| BIG-2 | **In-app billing / checkout** | Web: plan cards, monthly/yearly, checkout→PayX, downgrade dialog, payment history. **Mobile: view-only, upgrade is a stub.** | **[BE]** Recommend: add mobile checkout (PayX via WebView/redirect) + payment history. High user value. |
| BIG-3 | **Google sign-in + Connected Accounts** | Web: Google login + Settings→Connected Accounts (link/unlink, lock-out guard). **Mobile: Google is a stub; no Connected Accounts.** | **[BE-ready]** Backend endpoints exist (`/auth/google`, `/auth/google/link`). Recommend bringing both to mobile. |
| BIG-4 | **Payment model divergence** | **Closed:** mobile now follows the web/backend treatment ledger (`debt_amount`, `paid_amount`, currency). Obsolete quick-payment and invoice client flows were removed. | No product decision remains. |
| BIG-5 | **Action Logs (audit) on Staff** | Web `/staff` has an **Action Logs** tab (audit trail, filters, masked IP). Mobile staff = CRUD only, **no audit tab.** | Recommend: add a read-only Action Logs tab to mobile staff (M, **[BE]** if no mobile audit endpoint). |
| BIG-6 | **Admin panel** | Web has a full `/admin/*` suite. Mobile has none. | Recommend **❌ exclude** — admins use the web; out of mobile scope. Confirm. |
| BIG-7 | **PDF export** | Web exports PDF on patients/treatments/appointments/payments/analytics/billing (when `can_export`). Mobile: **no export.** | Decide: add share/export on mobile (M) or skip for v1. |

---

## B. Per-page parity

### Auth
| Item | Web | Mobile | Status | Note / decision |
|---|---|---|---|---|
| Email/password login | ✓ (+remember me) | ✓ (remember-me decorative) | Δ | Make remember-me real or remove it |
| Register → auto-login | ✓ | ✓ | = | |
| Forgot / reset password | ✓ | ✓ | = | |
| Verify email | status page | resend + banner | Δ | Minor; both cover it |
| **Google sign-in** | real GSI button | **stub** | ＋web | BIG-3 |
| Biometric unlock | n/a | none | — | Mobile-only nicety (optional) |

### Connected Accounts (Settings → Security)
| Item | Web | Mobile | Status |
|---|---|---|---|
| Email+password row, Google connect/disconnect, lock-out guard | ✓ | **none** | ＋web → BIG-3 |

### Dashboard
| Item | Web | Mobile | Status | Note |
|---|---|---|---|---|
| KPI: today appts / revenue this month / outstanding debt | ✓ | ✓ | = | |
| **Debt KPI always red (even at 0)** | ✓ | (verify) | Δ? | Match web: debt card always red on mobile |
| Quick actions: add patient / new appointment | ✓ | (verify) | Δ? | Ensure both present |
| Upcoming-today list | ✓ (≤4) | ✓ (+swipe complete/cancel) | ＋mob | Mobile richer — keep |
| Finance sparkline | ✗ | **synthetic data** | ＋mob | Hide or back with real series **[BE]** |
| Locked cards (no perm) | ✓ | ✓ | = | |

### Patients
| Item | Web | Mobile | Status | Note |
|---|---|---|---|---|
| Search, category filter, archived filter | ✓ | ✓ | = | |
| "No visit 6m" / **"no visit 1y"** filter | both | 6m only | Δ | Add 1y option |
| Manage-categories dialog | ✓ | (verify) | Δ? | Add category management on mobile? |
| Create/edit patient (all fields, photo) | ✓ | ✓ | = | Verify field-for-field (license? secondary phone?) |
| Archive / restore / force-delete (typed confirm) | ✓ | ✓ | = | |
| Pagination | 10/page | per_page 100 (no paging) | Δ | Fine at scale; optional |
| Export PDF | ✓ (can_export) | ✗ | ＋web | BIG-7 |
| "Schedule" row action (inactive) | ✓ | (verify) | Δ? | |

### Patient detail
| Item | Web | Mobile | Status |
|---|---|---|---|
| Contact / clinic(medical, allergy-aware) / detail triad | ✓ | ✓ | = |
| Click-to-call, allergy rose styling | ✓ | (verify) | Δ? |
| Appointments card + schedule CTA | ✓ | ✓ | = |
| Edit / archive / restore / force-delete | ✓ | ✓ | = |

### Treatments
| Item | Web | Mobile | Status | Note |
|---|---|---|---|---|
| Create/edit/delete; date, work-done, tooth picker, debt/paid, comment, images | ✓ | ✓ | = | Verify field names (web "work done" vs mobile "type") |
| Image limit + size cap from plan | ✓ | ✓ | = | |
| **Payment method (cash/card/bank)** | ✗ | ✓ | ＋mob | **BIG-4 (resolve the model)** |
| Export PDF (clinical) | ✓ | ✗ | ＋web | BIG-7 |

### Appointments
| Item | Web | Mobile | Status | Note |
|---|---|---|---|---|
| Week + Day views, date nav, status legend | ✓ | ✓ | = | |
| Create/edit (patient, date, time, duration, status, reason) | ✓ | ✓ | = | Verify duration options (web 15–120) |
| Conflict detection | ✓ | ✓ | = | |
| **Drag-drop reschedule (day view)** | ✓ | (verify, likely ✗) | Δ? | Optional on mobile |
| Day-queue inline editor | ✓ | n/a | Δ | Web-specific UX |
| Export PDF | ✓ | ✗ | ＋web | BIG-7 |

### Payments
| Item | Web | Mobile | Status |
|---|---|---|---|
| Summary totals, Patients + History tabs, search | ✓ | ✓ | = |
| 4 summary cards | ✓ | totals | Δ (minor) |
| Treatment ledger (`debt_amount`, `paid_amount`, currency); **no invoices** | ✓ | ✓ | = |
| Filtered payment/expense and patient-ledger PDF export | ✓ | ✓ | = |

### Billing
| Item | Web | Mobile | Status |
|---|---|---|---|
| Subscription view (plan/status/expiry/staff usage/read-only) | ✓ | ✓ | = |
| Plan cards + monthly/yearly + **checkout** | ✓ | **stub** | ＋web → BIG-2 |
| Pro→Basic downgrade (pick staff) | ✓ | ✗ | ＋web → BIG-2 |
| Payment history table | ✓ | ✗ | ＋web → BIG-2 |

### Settings
| Item | Web | Mobile | Status | Note |
|---|---|---|---|---|
| Profile (name/email/phone/**license** dentist) | ✓ | ✓ | Δ? | Verify license field on mobile |
| Practice (name/address) | ✓ | ✓ | = | |
| Working hours (start/end/duration **15/30/45/60** + preview) | ✓ | ✓ | Δ? | Verify duration options match |
| Password change | ✓ | ✓ | = | |
| **Connected Accounts (Google)** | ✓ | ✗ | ＋web → BIG-3 |
| Language | in app layout | in settings | Δ | Mobile: **persist locale** (resets to ru — bug) |
| Theme (light/dark/auto) | ✗ | ✗ | = | Deferred; mobile is explicitly light-only |
| Notifications prefs | ✗ | ✗ | = | Deferred by product decision |
| Active sessions | ✗ | ✗ | = | Not exposed until a real backend contract exists |

### Staff / Team
| Item | Web | Mobile | Status |
|---|---|---|---|
| Assistant CRUD, 6 permission codes, block/activate, reset-pw, delete | ✓ | ✓ | = (verify 6 codes + manage⇒view rule) |
| Status filter Active/Blocked/Deleted + pagination | ✓ | (verify) | Δ? |
| **Action Logs (audit) tab** | ✓ | ✓ | = |
| Subscription/staff-limit banner | ✓ | ✓ | = |

### Analytics — ＋web → BIG-1 (mobile has none)
### Admin — ＋web → BIG-6 (recommend exclude from mobile)

---

## C. Mobile quality / design issues to fix regardless of parity

(from the mobile review — `ROADMAP.md` has detail)
- **Locale persistence** — language resets to `ru` each cold start. (S) — fix regardless.
- **Dark mode partial** — infra exists but many screens use static colors; finish or hide.
- **EAS projectId missing** (`app.json extra.eas` empty) — blocks push + clean builds. (S)
- **Synthetic dashboard sparkline** — hide or back with real data.
- **Deep-link host parity** (`app.identa.uz` declared but not in linking prefixes).
- **Remote push not deliverable** (device registration mock-only) — **[BE]**.
- Verify field-level parity flagged "(verify)" above during implementation.

---

## D. Proposed decision checklist (tick what to bring to mobile)

**Large:**
- [ ] BIG-1 Analytics screen → ✅ / ⏸ / ❌
- [ ] BIG-2 In-app billing checkout + history → ✅ / ⏸ / ❌
- [ ] BIG-3 Google sign-in + Connected Accounts → ✅ / ⏸ / ❌
- [ ] BIG-4 Payment-method model: (a) add to web · (b) simplify mobile · (c) keep both
- [ ] BIG-5 Staff Action Logs tab → ✅ / ⏸ / ❌
- [ ] BIG-6 Admin on mobile → recommend ❌ (confirm)
- [ ] BIG-7 PDF export on mobile → ✅ / ⏸ / ❌

**Smaller parity items:** 1y inactive filter · manage-categories · "schedule" row action ·
drag-drop reschedule · 4 summary cards on payments · debt-always-red · quick actions ·
license field · working-hours duration set · staff status filter+pagination.
- [ ] Bring **all** smaller items (recommended — they're quick) · or pick individually.

**Quality fixes (do regardless):**
- [ ] Locale persistence · dark-mode · EAS projectId · sparkline · deep-link host · push registration

---

## Suggested order once you decide
1. Quality fixes (Section C) — small, unblock a trustworthy build.
2. Approved **smaller parity items** (batchable, low risk).
3. **BIG-3** (Google/Connected Accounts) and **BIG-4** decision (it changes the treatment/payment UI).
4. **BIG-2** billing, **BIG-1** analytics, **BIG-5** audit, **BIG-7** export — larger, sequence by priority.

Tell me your picks (e.g. "BIG-1 skip, BIG-2/3 yes, BIG-4 = simplify mobile, all smaller items yes") and I'll start implementing in that order, confirming each field-level "(verify)" as I go.

---

## E. Behavioral / logic divergences (shared features that behave DIFFERENTLY)

> These are NOT missing features — they exist on both, but the **logic differs**.
> Found via a line-level cross-repo diff (2026-06-05). This is what "1:1" really
> requires. `W:` = web file:line, `M:` = mobile file:line.

### HIGH — users would notice (correctness)
1. **Patient age is wrong on mobile near birthdays.** Web: calendar-correct (W: `app/patients/[id]/page.tsx:88-99`). Mobile: `365.25`-day approximation (M: `PatientDetailScreen.tsx:260-263`) → can be 1 year off. → **Fix mobile to match web.**
2. **Patients list drops rows >100 on mobile.** Web: server pagination, 10/page, sort `-created_at` (W: `app/patients/page.tsx:55,194`). Mobile: `per_page:100`, no paging, re-sorted A–Z (M: `PatientListScreen.tsx:98`, `groupPatients.ts:54`). → **Decision: add pagination/infinite-scroll; align sort (or accept mobile A–Z grouping intentionally).**
3. **Read-only subscription keys off DIFFERENT fields.** Web reads `subscription.is_read_only` and **exempts admins** (W: `lib/auth/permissions.ts:138-140`). Mobile reads `subscription.access_mode==='read_only'`, **no admin exemption** (M: `src/lib/permissions.ts:11-13`). If backend sets one but not the other, the platforms disagree on whether editing is locked. → **Fix mobile: read same field + exempt admin.**
4. **Read-only gives no explanation on mobile.** Web *disables + toasts* manage actions under read-only (explains why); *hides* them for view-only assistants (W: `app/patients/page.tsx:343-368`). Mobile only ever *hides* (M: `PatientListScreen.tsx:140-151`) — a dentist under read-only sees buttons vanish with no reason. → **Add disable+toast pattern to mobile.**
5. **Currency renders completely differently.** Web: full grouped `4 500 000 UZS` (W: `lib/utils.ts:22-33`). Mobile: abbreviated `4.5 mln so'm` (M: `src/lib/format.ts:43-82`). Same amount, very different display. → **Decision: which wins? (recommend match web full format for 1:1).**
6. **Locale not persisted on mobile** — resets to `ru` every cold start (M: `src/i18n/index.tsx:42`); web persists via cookie. → **Fix mobile (persist).**

### MED — validation / UX mismatch
7. **DOB allows future date on mobile** (no `max` on the wheel picker; M: `PatientFormSheet.tsx:464-469`); web caps at today. → **Fix mobile.**
8. **`account_status` not checked in mobile permissions** (web blocks UI if not active; M: `permissions.ts:23-36` omits it). → **Add to mobile.**
9. **"manage implies view" normalization** — web back-fills view + strips orphan `manage` (W: `permissions.ts:41-63`); mobile only reads (no sanitize) → malformed `['patients.manage']` grants manage on mobile, dropped on web. → **Add normalization to mobile.**
10. **Phone → different E.164 for same input.** Web: `+`+digits, no `998` inference (W: `lib/input-validation.ts:114-121`). Mobile: infers `998` for 9-digit, caps 12 (M: `phoneFormat.ts:30-44`). A 9-digit entry becomes `+901234567` (web) vs `+998901234567` (mobile). → **Align the normalization rule.**
11. **Treatment comment: mobile writes it, web can't edit it.** Mobile has a Comment field (maxLength 5000, sent as `comment`+`description`; M: `TreatmentEditSheet.tsx:490-512`). Web treatment form has **no comment input** (only sends existing state). → **Decision: add comment field to web (recommended) so it's editable both sides.**
12. **Date display labels differ** (web `formatDate` short month; mobile piecewise helpers). Transport `YYYY-MM-DD` identical. → Low-impact; align display if desired.
13. **Error handling models differ** — mobile: typed `ApiError.kind`; web: localized message by nested `error.code` (richer i18n). → Mostly fine; mobile lacks plan-code-specific localized messages.

### LOW
14. **Debt card color** — web ALWAYS red (even 0); mobile green-at-0 / red->0 (M: `DashboardScreen.tsx:294`, also patient-detail + payments). → **Align mobile to always-red** (matches the web product rule).
15. **Working hours** — mobile blocks past-time slots today + falls back to 08:00–20:00 (M: `AppointmentCreateSheet.tsx:55-95`); web doesn't block past slots. → Decide which rule.
16. **Appointment reason↔notes** — web stores reason as first `|`-segment of `notes` (W: `app/appointments/page.tsx:133-140`); mobile sends `notes: reason` directly → a mobile note containing `|` is parsed as reason-only on web. → **Align the encoding.**
17. **Time format** — web returns time unchanged; mobile trims to `HH:mm`. Minor.

### Parity OK (verified identical — no action)
Appointment duration set (15–120, default 30) · conflict rules (cancelled/no_show excluded, half-open overlap) · "today's appointments" = scheduled-only · treatment image limits (plan-based) · patient name min-3 + field caps (allergies 40 / meds 120 / history 300) · overpayment allowed (paid>debt) on both.

### Quick wins among the above (low-risk, do regardless of BIG decisions)
Age calc (#1) · read-only field+admin (#3) · DOB max (#7) · account_status (#8) · perm normalization (#9) · locale persist (#6) · debt color (#14) · payments sort tiebreak (#2 partial) · 1y inactive filter.
Decisions needed: pagination (#2), currency format (#5), comment-on-web (#11), payment-method model (BIG-4), working-hours rule (#15).
