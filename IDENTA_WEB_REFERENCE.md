# Identa — Backend API & Biznes Qoidalari Kontrakti

Bu hujjat mobil app ulanadigan **Laravel + Sanctum backend** kontraktini va
koddan kelib chiqmaydigan biznes qoidalarini saqlaydi.

> **Source of truth:**
> - Response/obyekt shakllari → `src/types/index.ts`
> - Aniq endpoint yo'llari va so'rov mantiqi → `src/api/*.ts`
> - Mobil arxitektura, auth oqimi, build → `AGENTS.md`
>
> Bu hujjat faqat *backendga tegishli* va koddan oson topib bo'lmaydigan
> ma'lumotlarni (biznes qoidalari, semantika, backend "tuzoqlari") ushlaydi.
> Dastlab `identa-main` web loyihasidan olingan (2026-05-16), keyin haqiqiy
> mobil implementatsiyaga moslab tozalangan.

---

## 1. LOYIHA

Identa — stomatologiya klinikasi boshqaruv tizimi (Dental Practice Management).
Backend: Laravel API, Sanctum auth, RESTful JSON. Base URL `…/api/v1`
(prod: `https://api.identa.uz/api/v1`). Postgres + Redis + worker — Railway'da.

---

## 2. AUTENTIFIKATSIYA

Mobil **Bearer token (Sanctum personal access token)** ishlatadi — cookie-session
EMAS. To'liq oqim `AGENTS.md` da. Bu yerda backend kontrakti:

- `GET  /auth/csrf-token` → `{ token }` qaytaradi + `identa-session` cookie
  o'rnatadi. `web`-middleware auth route'lariga CSRF bootstrap kerak.
- `POST /auth/login` → `device_name` yuborilsa, javobda `tokens` (access +
  refresh) user maydonlari bilan **bir tekis (flattened)** qaytadi. `device_name`
  Sanctum token nomi sifatida ishlatiladi (har qurilma alohida token).
- `POST /auth/register` → mobil tokenlarni **bermaydi**; ro'yxatdan o'tgach
  alohida login qilish kerak.
- `POST /auth/forgot-password`, `POST /auth/reset-password`,
  `POST /auth/change-password` — barchasi `web` middleware → CSRF kerak.
- `POST /auth/refresh` → body'da `refresh_token`; **CSRF kerak emas** (web group
  tashqarisida). Access token 15 daqiqada eskiradi.
- `GET  /auth/me`, `POST /auth/logout`.

### Rollar va ruxsatlar
| Rol | Huquq |
|-----|-------|
| `admin` | Butun platforma |
| `dentist` | O'z ma'lumotlari (to'liq) |
| `assistant` | `assistant_permissions[]` orqali granular (`patients.view`, `appointments.manage`, …) |

Assistant uchun backend `dentist_owner_id` ni ham yuboradi (egasi shifokor id si).

### Obuna (`subscription`)
- `access_mode`: `full` | `read_only`. **Har yozish operatsiyasidan oldin
  `access_mode === 'full'` tekshirilishi shart.**
- `status`: `none | trialing | active | grace | read_only | canceled`.
- `plan` DB'dan keladigan string — noma'lum kodlarni "pulli (non-trial)" deb
  hisoblab fail-safe ishlash kerak.

---

## 3. ENDPOINT XARITASI (umumiy)

Aniq yo'llar `src/api/*.ts` da. Asosiy resurslar:

| Resurs | Endpointlar |
|--------|-------------|
| Patients | `GET/POST /patients`, `GET/PUT /patients/{id}`, `GET /patients/{id}/overview`, `GET /patients/{id}/odontogram/summary`, `POST /patients/{id}/quick-payments` |
| Categories | `GET/POST /patient-categories`, `PUT/DELETE /patient-categories/{id}` |
| Appointments | `GET/POST /appointments`, `PUT/DELETE /appointments/{id}` |
| Dashboard | `GET /dashboard/snapshot?date=YYYY-MM-DD` |
| Profil / jamoa / sessiyalar / bildirishnomalar / qurilmalar | `src/api/{profile,team,sessions,notifications,devices}.ts` |

### Backend "tuzoqlari" (eng qimmatli qism — yangi agentlar shu yerda adashadi)

1. **List filtrlari Laravel nested `filter[...]` ko'rinishida** ketadi, tekis
   maydon nomlarida emas: `filter[search]`, `filter[category_id]`,
   `filter[archived_only]`, `filter[date_from]`, `filter[date_to]`,
   `filter[status]`.
2. **Appointment yozishda `reason`, o'qishda `notes`.** Body'ga `reason`
   yuboriladi, javob `notes` bilan qaytadi (`src/api/appointments.ts` map qiladi).
3. **Dashboard snapshot camelCase qaytadi** (`revenueThisMonth`,
   `outstandingDebtTotal`, `todayAppointments`) — mobil snake_case ga remap
   qiladi. Decimal maydonlar string bo'lib kelishi mumkin → `Number()` bilan
   coerce qilinadi (`src/api/dashboard.ts`).
4. **Pagination meta:** backend (Laravel) `page` / `total_pages` ishlatadi;
   eski mocklar `current_page` / `last_page`. UI faqat `total` ni o'qiydi
   (`PaginationMeta` ikkalasini ham qabul qiladi).

### Javob formati
```json
// Bitta obyekt
{ "data": { ... } }
// Ro'yxat
{ "data": [ ... ], "meta": { "pagination": { "page", "total_pages", "per_page", "total" } } }
// Xato
{ "message": "…", "errors": { "field": ["…"] } }   // 422 da errors bo'ladi
```

---

## 4. MA'LUMOT MODELLARI

To'liq, joriy shakllar → **`src/types/index.ts`** (bu yerda takrorlanmaydi,
chunki kod source of truth). Asosiy interfeyslar: `ApiUser`,
`ApiSubscriptionSummary`, `ApiPatient`, `ApiPatientCategory`, `ApiAppointment`,
`ApiTreatment`, `ApiPayment` (`PaymentMethod = cash | card | bank_transfer`),
`ApiOdontogramEntry` / `ApiOdontogramSummary`, `ApiInvoice`, `ApiSession`,
`ApiAssistant`, `DashboardSnapshot`.

---

## 5. BIZNES KONSTANTALARI

Kod: `src/constants/index.ts`.

### Navbatlar
```
DEFAULT_WORKING_HOURS = { start: '08:00', end: '18:00' }
APPOINTMENT_DURATION_OPTIONS = [15, 30, 45, 60, 90, 120]  // daqiqa
```
| Status | Rang |
|--------|------|
| `scheduled` | `#0ea5e9` |
| `completed` | `#10b981` |
| `cancelled` | `#6b7280` |
| `no_show` | `#ef4444` |

### Tish holati (`ToothCondition`) ranglari
| Holat | Rang |
|-------|------|
| `healthy` | `#22c55e` |
| `cavity` | `#ef4444` |
| `filling` | `#3b82f6` |
| `crown` | `#eab308` |
| `root_canal` | `#a855f7` |
| `extraction` | `#6b7280` |
| `implant` | `#16a34a` |

> **Tish raqamlash:** `tooth_number` — butun son (1–32 diapazonida ishlatiladi).
> Bu **Universal Numbering** ketma-ketligiga mos (ikki xonali FDI 11–48 EMAS).
> Aniq tizim backend bilan tasdiqlansin — mobil kod faqat raqamni saqlaydi.

### Formatlar
- Pul: **UZS, butun son** (tiyinsiz).
- Sana: `YYYY-MM-DD`. Vaqt: `HH:mm` (24-soat).
- Pagination: default `PAGE_SIZE = 10`.

### Tillar
`SUPPORTED_LOCALES = ['ru', 'uz', 'en']`, default `ru`. Tarjimalar bundle ichida
(`src/i18n/translations`), API'dan yuklanmaydi.

---

## 6. MUHIM ESLATMALAR

1. **Yozishdan oldin obuna tekshiruvi** — `access_mode === 'full'`.
2. **Assistant ruxsati** — `assistant_permissions[]` tekshiriladi.
3. **Rasm moderatsiyasi** — `photo_scan_status` / image `scan_status`:
   `pending | approved | rejected`. Faqat `approved` (yoki legacy null)
   ko'rsatiladi.
4. **Image variantlari** — `url`/`thumbnail_url`/`preview_url` null bo'lishi
   mumkin (backend fonda generatsiya qiladi); preview → thumbnail → url tartibida
   fallback.
