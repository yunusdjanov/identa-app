export interface ApiUser {
  id: string
  name: string
  email: string
  role: 'admin' | 'dentist' | 'assistant'
  provider?: 'email' | 'google'
  avatar_url?: string
  email_verified_at?: string
  has_password?: boolean
  account_status: 'active' | 'blocked' | 'deleted'
  assistant_permissions?: string[]
  must_change_password?: boolean
  // For assistants the backend emits the owning dentist's id so the
  // mobile can scope follow-up calls correctly without a second lookup.
  dentist_owner_id?: string | null
  subscription?: ApiSubscriptionSummary | null
}

export interface ApiSubscriptionSummary {
  is_configured: boolean
  // Backend `plan_code` is a DB-driven string. The values we currently
  // care about UI-side are listed in the union for autocomplete, but the
  // runtime value may be any plan code the backend has registered —
  // hence the trailing `string` widening. Treat unknown codes as
  // "non-trial paid" in the UI to fail safe.
  plan: 'trial' | 'basic' | 'pro' | 'monthly' | 'yearly' | (string & {}) | null
  status: 'none' | 'trialing' | 'active' | 'grace' | 'read_only' | 'canceled'
  access_mode: 'full' | 'read_only'
  starts_at?: string
  ends_at?: string
  trial_ends_at?: string
  days_remaining: number | null
  staff_limit: number | null
  active_staff_count: number
  entry_image_limit?: number
  upload_max_mb?: number | null
  can_export?: boolean
  // Hint fields backend already emits — surface them so the billing
  // screen can render grace-period banners and locked CTAs without
  // re-deriving from `status`.
  is_read_only?: boolean
  cancel_at_period_end?: boolean
  grace_ends_at?: string | null
  plan_name?: string | null
  billing_period?: 'monthly' | 'yearly' | null
}

export interface ApiPatient {
  id: string
  patient_id: string
  full_name: string
  // DB column allows NULL — render sites should guard for empty/null phone.
  phone: string | null
  secondary_phone?: string | null
  date_of_birth?: string
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

export interface ApiPatientCategory {
  id: string
  name: string
  color: string
  sort_order?: number
  patient_count?: number
}

export interface ApiAppointment {
  id: string
  patient_id: string
  patient_name?: string
  appointment_date: string
  start_time: string
  end_time: string
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
  notes: string | null
}

export interface ApiTreatment {
  id: string
  patient_id: string
  patient_name?: string
  teeth: number[]
  treatment_type: string
  description?: string
  treatment_date: string
  cost: number | null
  debt_amount: number
  paid_amount: number
  balance: number
  images: ApiTreatmentImage[]
  payments?: ApiTreatmentPayment[]
  created_at?: string
}

export interface ApiTreatmentPayment {
  id: string
  amount: number
  recorded_at: string // ISO timestamp
}

// Backend Payment.payment_method enum. Mobile uses these as the form
// values; never construct a payment without one (backend rejects with
// validation error).
export type PaymentMethod = 'cash' | 'card' | 'bank_transfer'

// Response shape from POST /patients/{id}/quick-payments. Mirrors the
// backend's PaymentResource (id, invoice_id, patient_id, amount,
// payment_method, payment_date, notes, created_at).
export interface ApiPayment {
  id: string
  invoice_id: string
  patient_id: string
  amount: number
  payment_method: PaymentMethod
  payment_date: string  // YYYY-MM-DD
  notes: string | null
  created_at: string  // ISO datetime
}

export interface ApiTreatmentImage {
  id: string
  // The original URL may be null until backend background variant generation
  // finishes (thumbnail / preview). UI falls back through preview → thumbnail
  // → url. Mark all optional so consumers branch defensively.
  url?: string | null
  thumbnail_url?: string | null
  preview_url?: string | null
  mime_type?: string
  file_size?: number
  created_at?: string | null
  thumbnail_ready?: boolean
  preview_ready?: boolean
  // Backend may quarantine images that fail content moderation. Only show
  // `approved` (or null = legacy) to the user; pending/rejected stay hidden.
  scan_status?: 'pending' | 'approved' | 'rejected' | null
}

export type ToothCondition =
  | 'healthy'
  | 'cavity'
  | 'filling'
  | 'crown'
  | 'root_canal'
  | 'extraction'
  | 'implant'

export interface ApiOdontogramEntry {
  id: string
  patient_id: string
  tooth_number: number
  condition_type: ToothCondition
  surface?: string | null
  material?: string | null
  severity?: string | null
  condition_date: string
  notes?: string | null
  created_at?: string | null
  images?: ApiOdontogramEntryImage[]
}

export interface ApiOdontogramEntryImage {
  id: string
  url?: string | null
  thumbnail_url?: string | null
  preview_url?: string | null
}

// Backend response shape for GET /patients/{id}/odontogram/summary. Each
// `latest_conditions` row is the most recent entry for that tooth; if the
// dentist replaces a filling with a crown over time, only the crown shows.
// `history_count` is the lifetime count for that tooth (used to render the
// small badge on the odontogram).
export interface ApiOdontogramSummaryEntry {
  tooth_number: number
  condition_type: ToothCondition
  history_count: number
  condition_date: string
  created_at?: string | null
}

export interface ApiOdontogramSummary {
  total_entries: number
  affected_teeth_count: number
  latest_conditions: ApiOdontogramSummaryEntry[]
}

export interface ApiInvoice {
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

export interface ApiSession {
  id: string
  device_name: string
  platform: 'ios' | 'android' | 'web'
  ip_address: string
  city?: string
  country?: string
  // ISO timestamp.
  last_active_at: string
  // True for the session that's currently making the request.
  is_current: boolean
}

export interface ApiAssistant {
  id: string
  name: string
  email: string
  phone?: string | null
  account_status: 'active' | 'blocked' | 'deleted'
  assistant_permissions: string[]
  last_login_at?: string | null
  created_at?: string | null
}

export interface DashboardAppointmentView {
  id: string
  patient_name: string
  appointment_date: string
  start_time: string
  duration_minutes: number
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
  reason?: string
}

export interface DashboardSnapshot {
  date: string
  revenue_this_month: number
  outstanding_debt_total: number
  today_appointments: DashboardAppointmentView[]
}

export interface PaginationMeta {
  // Backend (Laravel paginator) uses `page` / `total_pages` here; the
  // older mock APIs accidentally adopted Laravel-internal names
  // (`current_page` / `last_page`). Both pairs are accepted by the type
  // so we don't have to chase down every mock — UI code only ever reads
  // `total`.
  page?: number
  total_pages?: number
  current_page?: number
  last_page?: number
  per_page: number
  total: number
}

export interface ApiListResponse<T> {
  data: T[]
  meta: { pagination: PaginationMeta }
}

export interface ApiResponse<T> {
  data: T
}
