# Identa Web Loyihasi — Mobile App Uchun To'liq Referens

Bu hujjat `identa-main` web loyihasini o'rganib chiqilgandan so'ng React Native mobile app qurish uchun zarur bo'lgan barcha ma'lumotlarni o'z ichiga oladi.

---

## 1. LOYIHA HAQIDA UMUMIY MA'LUMOT

**Nima bu?** — Identa: stomatologiya klinikasi uchun boshqaruv tizimi (Dental Practice Management System).

**Tech Stack (Web):**
- Next.js 14 (App Router)
- React 19 + TypeScript
- TanStack React Query v5 — server state
- Zustand v5 — client state
- Axios — HTTP client (CSRF bilan)
- Tailwind CSS 4 + Radix UI + shadcn/ui
- date-fns — sana formatlash
- Sonner — toast xabarlari
- next-themes — dark/light rejim

**Backend API:**
- Base URL: `NEXT_PUBLIC_API_URL` (default: `http://127.0.0.1:8001/api`)
- Format: RESTful JSON
- Auth: Cookie-based session (HttpOnly, SameSite=Lax) + CSRF token

---

## 2. SAHIFALAR VA MARSHRUTLAR (Routes)

### Autentifikatsiya sahifalari:
| Route | Tavsif |
|-------|--------|
| `/login` | Email/parol kirish + Google OAuth |
| `/register` | Yangi shifokor ro'yxatdan o'tish |
| `/forgot-password` | Parol tiklash so'rovi |
| `/reset-password` | Token bilan parol yangilash |
| `/admin/login` | Admin panel kirishi |

### Asosiy sahifalar:
| Route | Tavsif |
|-------|--------|
| `/dashboard` | Bosh sahifa — kunlik statistika |
| `/patients` | Bemorlar ro'yxati + qidiruv/filter |
| `/patients/[id]` | Bemor tafsilotlari |
| `/patients/[id]/odontogram` | Interaktiv tish sxemasi |
| `/patients/[id]/history` | Davolanish tarixi |
| `/appointments` | Haftalik/kunlik taqvim |
| `/payments` | To'lovlar va qoldiqlar |
| `/settings` | Profil, ish soatlari, xavfsizlik |
| `/team` | Xodimlar boshqaruvi |
| `/billing` | Obuna va to'lov ma'lumotlari |
| `/admin/*` | Admin panel |

### Mobile uchun navigatsiya tavsiyasi:
Sidebar o'rniga **Bottom Tab Navigation**:
1. Dashboard
2. Bemorlar (Patients)
3. Navbatlar (Appointments)
4. To'lovlar (Payments)
5. Sozlamalar (Settings)

---

## 3. AUTENTIFIKATSIYA

### Login jarayoni:
1. Email + parol yoki Google OAuth
2. API: `POST /auth/login` yoki `POST /auth/google-callback`
3. Session cookie saqlanadi (HttpOnly)
4. CSRF token barcha so'rovlarda ketadi
5. Rol asosida yo'naltirish: `admin` → `/admin`, boshqalar → `/dashboard`

### Sessiya boshqaruvi:
- CSRF tokenlar axios interceptorlar orqali avtomatik qo'shiladi
- 401/419 status → avtomatik logout
- Google OAuth: `window.google.accounts.id` (mobile uchun — native Google Sign-In)

### Rollar:
| Rol | Huquq |
|-----|-------|
| `admin` | Butun platforma |
| `dentist` | O'z ma'lumotlari (to'liq) |
| `assistant` | Granular ruxsatlar (ko'rish/boshqarish) |

### Ruxsat modullari:
- `patients` — (view / manage)
- `appointments` — (view / manage)
- `payments` — (view / manage)

### Obuna holati:
- `full` — to'liq kirish
- `read_only` — faqat ko'rish (obuna tugagan)

---

## 4. API FUNKSIYALARI

### Autentifikatsiya:
```typescript
POST /auth/login              // Email/parol
POST /auth/google-callback    // Google OAuth
GET  /auth/me                 // Joriy foydalanuvchi
POST /auth/logout             // Chiqish
POST /auth/password/email     // Parol tiklash so'rovi
POST /auth/password/reset     // Yangi parol o'rnatish
```

### Bemorlar (Patients):
```typescript
GET    /patients                    // Ro'yxat (qidiruv, sahifalash)
POST   /patients                    // Yangi bemor yaratish
GET    /patients/:id                // Bemor tafsilotlari
PUT    /patients/:id                // Tahrirlash
POST   /patients/:id/restore        // Arxivdan tiklash

GET    /patient-categories          // Kategoriyalar ro'yxati
POST   /patient-categories          // Yangi kategoriya
PUT    /patient-categories/:id      // Tahrirlash
DELETE /patient-categories/:id      // O'chirish
```

### Navbatlar (Appointments):
```typescript
GET    /appointments                // Ro'yxat (sana, status filtr)
POST   /appointments                // Yangi navbat
PUT    /appointments/:id            // Tahrirlash
DELETE /appointments/:id            // O'chirish
```

### Davolanishlar (Treatments):
```typescript
GET    /treatments                  // Ro'yxat
POST   /treatments                  // Yangi davolanish
GET    /treatments/:id              // Tafsilot
PUT    /treatments/:id              // Tahrirlash
DELETE /treatments/:id              // O'chirish
```

### Odontogram (Tish sxemasi):
```typescript
GET    /odontogram/:patientId/summary    // Umumiy holat
GET    /odontogram-entries/:id           // Yozuv tafsiloti
POST   /odontogram-entries              // Yangi yozuv
PUT    /odontogram-entries/:id          // Tahrirlash
DELETE /odontogram-entries/:id          // O'chirish
```

### To'lovlar (Payments & Invoices):
```typescript
GET    /invoices                    // Schyot-fakturalar
POST   /payments                    // To'lov qabul qilish
GET    /payments                    // To'lovlar tarixi
```

### Dashboard:
```typescript
GET    /dashboard/snapshot?date=YYYY-MM-DD   // Kunlik statistika
```

### Profil va sozlamalar:
```typescript
GET    /profile                     // Profil ma'lumotlari
PUT    /profile                     // Profil yangilash
GET    /working-hours               // Ish soatlari
PUT    /working-hours               // Ish soatlarini o'rnatish
GET    /audit-logs                  // Faoliyat jurnali
```

### Xodimlar (Staff/Team):
```typescript
GET    /staff                       // Xodimlar ro'yxati
POST   /staff/invite                // Taklif yuborish
PUT    /staff/:id/permissions       // Ruxsatlarni yangilash
DELETE /staff/:id                   // Xodimni o'chirish
```

### API javob formati:
```json
// Muvaffaqiyatli (bitta obyekt)
{ "data": { ...object } }

// Muvaffaqiyatli (ro'yxat)
{
  "data": [...],
  "meta": {
    "pagination": {
      "current_page": 1,
      "last_page": 5,
      "per_page": 10,
      "total": 47
    }
  }
}

// Xato
{ "message": "Xato matni" }
```

---

## 5. MA'LUMOT MODELLARI (Data Models)

### ApiUser:
```typescript
{
  id: string
  name: string
  email: string
  role: 'admin' | 'dentist' | 'assistant'
  provider?: 'email' | 'google'
  avatar_url?: string
  email_verified_at?: string
  has_password?: boolean
  account_status: 'active' | 'blocked' | 'deleted'
  assistant_permissions?: string[]   // ['patients.view', 'appointments.manage', ...]
  must_change_password?: boolean
  subscription?: ApiSubscriptionSummary
}
```

### ApiPatient:
```typescript
{
  id: string
  patient_id: string              // Ko'rinadigan ID (P-001 kabi)
  full_name: string
  phone: string
  secondary_phone?: string
  date_of_birth?: string          // YYYY-MM-DD
  gender?: 'male' | 'female'
  address?: string
  medical_history?: string
  allergies?: string
  current_medications?: string
  photo_url?: string
  photo_thumbnail_url?: string
  photo_scan_status?: 'pending' | 'approved' | 'rejected'
  created_at?: string
  last_visit_at?: string
  is_archived?: boolean
  categories?: ApiPatientCategory[]
}
```

### ApiAppointment:
```typescript
{
  id: string
  patient_id: string
  patient_name?: string
  appointment_date: string        // YYYY-MM-DD
  start_time: string              // HH:mm
  end_time: string                // HH:mm
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
  notes: string | null
}
```

### ApiTreatment:
```typescript
{
  id: string
  patient_id: string
  patient_name?: string
  teeth: number[]                 // Tish raqamlari (1-32)
  treatment_type: string          // "Kavite plombasi" kabi
  description?: string
  treatment_date: string          // YYYY-MM-DD
  cost: number | null
  debt_amount: number
  paid_amount: number
  balance: number
  images: ApiTreatmentImage[]
  created_at?: string
}
```

### ApiOdontogramEntry:
```typescript
{
  id: string
  patient_id: string
  tooth_number: number            // 1-32
  condition_type: 'healthy' | 'cavity' | 'filling' | 'crown' | 'root_canal' | 'extraction' | 'implant'
  surface?: string                // 'occlusal' | 'buccal' | 'lingual' | ...
  material?: string               // 'composite' | 'porcelain' | 'amalgam' | ...
  severity?: string
  condition_date: string          // YYYY-MM-DD
  notes?: string
  images?: ApiOdontogramEntryImage[]
}
```

### ApiSubscriptionSummary:
```typescript
{
  is_configured: boolean
  plan: 'trial' | 'basic' | 'pro' | 'monthly' | 'yearly' | null
  status: 'none' | 'trialing' | 'active' | 'grace' | 'read_only' | 'canceled'
  access_mode: 'full' | 'read_only'
  starts_at?: string
  ends_at?: string
  trial_ends_at?: string
  days_remaining: number | null
  staff_limit: number | null
  active_staff_count: number
  entry_image_limit?: number
  upload_max_mb?: number
  can_export?: boolean
}
```

### ApiPatientCategory:
```typescript
{
  id: string
  name: string
  color: string                   // Hex rang kodi (#FF5733 kabi)
  patient_count?: number
}
```

### ApiInvoice:
```typescript
{
  id: string
  patient_id: string
  patient_name?: string
  total_amount: number
  paid_amount: number
  debt_amount: number
  status: 'paid' | 'partial' | 'unpaid'
  created_at: string
  treatments?: ApiTreatment[]
}
```

---

## 6. BIZNES MANTIQI VA KONSTANTALAR

### Navbat vaqt sozlamalari:
```typescript
DEFAULT_WORKING_HOURS = { start: '08:00', end: '18:00' }
TIME_SLOT_INTERVAL = 30  // daqiqa
APPOINTMENT_DURATION_OPTIONS = [15, 30, 45, 60, 90, 120]  // daqiqalar
```

### Navbat status ranglari:
| Status | Rang |
|--------|------|
| `scheduled` | Ko'k `#0ea5e9` |
| `completed` | Yashil `#10b981` |
| `cancelled` | Kulrang `#6b7280` |
| `no_show` | Qizil `#ef4444` |

### Tish raqamlash (FDI tizimi):
| Kvadrant | Tishlar |
|----------|---------|
| Yuqori o'ng | 1–8 |
| Yuqori chap | 9–16 |
| Quyi chap | 17–24 |
| Quyi o'ng | 25–32 |

### Tish holati ranglari:
| Holat | Rang |
|-------|------|
| `healthy` | Yashil |
| `cavity` | Qizil |
| `filling` | Ko'k |
| `crown` | Sariq |
| `root_canal` | Binafsha |
| `extraction` | Kulrang |
| `implant` | To'q yashil |

### Kirish chegaralari (validatsiya):
```typescript
email: 255 belgi
password: 255 belgi
name: 255 belgi
phone: 20 belgi
shortText: 100 belgi
longText: 1000 belgi
```

### Sahifalash:
- Default: 10 ta yozuv/sahifa
- Max: 500 ta/so'rov

---

## 7. HOLAT BOSHQARUVI (State Management)

### Zustand store'lari:
```typescript
// Auth holati
useAuthStore() -> {
  isAuthenticated: boolean
  dentistName: string
  login(name: string): void
  logout(): void
}

// Ilova holati
useAppStore() -> {
  selectedPatient: Patient | null
  setSelectedPatient(patient): void
}
```

### React Query kalitlari:
```typescript
['auth', 'me']
['patients', 'list', { search, page, categoryId }]
['patients', 'detail', patientId]
['appointments', 'list', { date, status }]
['treatments', 'list', { patientId }]
['dashboard', 'snapshot', date]
['invoices', 'list', { patientId }]
['odontogram', 'summary', patientId]
```

### React Query sozlamalari:
- Stale time: 5–30 daqiqa
- Cache time: 5–15 daqiqa
- Window focus refetch: O'chirilgan
- Reconnect refetch: O'chirilgan

---

## 8. TILLAR VA LOKALIZATSIYA

**Qo'llab-quvvatlanadigan tillar:**
- `ru` — Rus (asosiy)
- `uz` — O'zbek
- `en` — Ingliz

**I18n arxitekturasi:**
- Tarjimalar backend API'dan yuklanadi: `GET /api/i18n/:locale`
- Client tomonida cache qilinadi
- `useI18n()` hook orqali ishlatiladi:
```typescript
const { t, locale, setLocale } = useI18n()
t('patients.add_new')       // "Yangi bemor qo'shish"
t('common.save')            // "Saqlash"
```

**Mobile uchun tavsiya:** Tarjimalarni bundle ichiga qo'shib, offline ishlashini ta'minlash.

---

## 9. MUHIT O'ZGARUVCHILARI (Environment Variables)

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8001/api
NEXT_PUBLIC_APP_URL=https://identa.uz
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<google-oauth-client-id>
```

**Mobile uchun:**
- `API_URL` — `.env` yoki `app.config.js` da saqlash
- Google Client ID — native Google Sign-In uchun alohida Android/iOS kalitlari kerak

---

## 10. XATOLARNI BOSHQARISH

```typescript
// API xato strukturasi
AxiosError -> response.data.message  || response.statusText

// Maxsus status kodlari
401  -> Autentifikatsiya xatosi (qayta login)
403  -> Ruxsat yo'q
419  -> CSRF token eskirgan (qayta token olish)
422  -> Validatsiya xatosi (response.data.errors)
429  -> Ko'p so'rov (rate limit)
500  -> Server xatosi
```

---

## 11. KOMPONENTLAR VA ULARNING VAZIFASI

### Layout:
- `app-layout` — Sidebar + top navigatsiya
- `account-menu` — Foydalanuvchi menyusi (profil, til, chiqish)
- `subscription-banner` — Obuna holati banneri
- `language-switcher` — Til tanlash (ru/uz/en)

### Bemorlar:
- `add-patient-dialog` — Yangi bemor yaratish formasi
- `edit-patient-dialog` — Bemor ma'lumotlarini tahrirlash
- `patient-photo-field` — Rasm yuklash + preview
- `clinical-snapshot-card` — Bemor qisqacha ko'rinishi
- `patient-accounting-card` — Qarz/to'lov xulosasi
- `treatment-history-card` — O'tgan davolanishlar
- `manage-categories-dialog` — Kategoriyalar boshqaruvi

### Navbatlar:
- `add-appointment-dialog` — Navbat yaratish/tahrirlash formasi
- `appointment-time-picker` — Bo'sh vaqt slotlarini tanlash

### To'lovlar:
- Davolanish ro'yxati + to'lov qabul qilish modal

### Odontogram:
- `tooth-detail-dialog` — Tish holati tarixi modali
- Interaktiv SVG tish sxemasi (32 ta tish)

### Umumiy UI:
- `confirm-action-dialog` — O'chirish tasdiqlash dialogi
- `data-table-shell` — Jadval wrapper (sahifalash, qidiruv)
- `page-shell` — Sahifa sarlavhasi + harakatlar paneli
- `skeleton` — Yuklash holati skeletlari

---

## 12. DASHBOARD STATISTIKASI

```typescript
// GET /dashboard/snapshot?date=YYYY-MM-DD
DashboardStats {
  date: string
  appointments_count: number        // Bugungi navbatlar
  completed_appointments: number    // Bajarilganlar
  new_patients_count: number        // Yangi bemorlar
  revenue_today: number             // Bugungi daromad
  total_debt: number                // Umumiy qarz
  upcoming_appointments: ApiAppointment[]  // Keyingi navbatlar
}
```

---

## 13. RASM VA MEDIA

- Bemorlar rasmi: `photo_url` (to'liq) + `photo_thumbnail_url` (kichik)
- Rasm tekshiruvi: `photo_scan_status`: `pending` | `approved` | `rejected`
- Davolanish rasmlari: `ApiTreatmentImage[]`
- Odontogram rasmlari: `ApiOdontogramEntryImage[]`
- Max yuklash hajmi: `upload_max_mb` (obuna bo'yicha farqlanadi)

---

## 14. MOBILE APP QURISH UCHUN TAVSIYALAR

### Texnologiyalar:
```
React Native + Expo (tavsiya)
TypeScript
TanStack Query (React Query) — server state
Zustand — client state
Axios — HTTP
React Navigation — navigatsiya
React Native Calendars — taqvim
AsyncStorage — sessiya saqlash
Expo SecureStore — maxfiy ma'lumotlar
react-native-image-picker — rasm yuklash
i18next — lokalizatsiya
```

### Arxitektura:
```
src/
├── api/           # Axios instance + barcha API funksiyalar
├── stores/        # Zustand store'lar
├── hooks/         # React Query hooklar
├── screens/       # Sahifalar
│   ├── auth/
│   ├── dashboard/
│   ├── patients/
│   ├── appointments/
│   ├── payments/
│   └── settings/
├── components/    # Qayta ishlatiluvchi komponentlar
├── navigation/    # Tab va Stack navigatsiya
├── types/         # TypeScript interfeyslari
├── constants/     # Raqamlar, ranglar, konfiguratsiya
└── i18n/          # Til fayllari
```

### Auth saqlash (mobile):
```typescript
// Web: HttpOnly cookie (avtomatik)
// Mobile: AsyncStorage (token) + SecureStore (parol)

import * as SecureStore from 'expo-secure-store'
await SecureStore.setItemAsync('session_token', token)
```

### CSRF (mobile):
- Cookie-based CSRF web uchun
- Mobile uchun: Token-based auth (Bearer token) ishlatish mumkin — backend bilan kelishish kerak

### Offline rejim:
- React Query cache + `persistQueryClient` (AsyncStorage)
- Navbatlar + bemorlar ro'yxatini cache qilish
- Tarjimalarni bundle'ga qo'shish

### Navigatsiya tuzilmasi:
```
RootNavigator
├── AuthStack
│   ├── LoginScreen
│   ├── RegisterScreen
│   └── ForgotPasswordScreen
└── MainTabs (Bottom Tab Navigator)
    ├── DashboardScreen
    ├── PatientsStack
    │   ├── PatientListScreen
    │   ├── PatientDetailScreen
    │   ├── OdontogramScreen
    │   └── TreatmentHistoryScreen
    ├── AppointmentsScreen
    ├── PaymentsScreen
    └── SettingsStack
        ├── ProfileScreen
        ├── WorkingHoursScreen
        ├── TeamScreen
        └── BillingScreen
```

---

## 15. MUHIM ESLATMALAR

1. **Obuna tekshiruvi** — Har bir yozish operatsiyasidan oldin `access_mode === 'full'` ekanligini tekshirish.
2. **Ruxsat tekshiruvi** — Assistant rolida `assistant_permissions` array'ini tekshirish.
3. **Tish raqamlash** — FDI tizimi ishlatiladi (1–32), Universal emas.
4. **Sana formati** — Barcha sanalar `YYYY-MM-DD` formatida.
5. **Vaqt formati** — `HH:mm` (24-soatlik).
6. **Pul birligi** — So'm (UZS), `number` tipida (tiyinsiz).
7. **Sahifalash** — Default 10, max 500 yozuv.
8. **Rasm skanerlash** — Yuklangan bemor rasmlari `pending` holatida boshlanadi, admin tasdiqlaydi.

---

*Hujjat `identa-main` web loyihasidan avtomatik yaratilgan — 2026-05-16*
