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
  show_record_authors?: boolean
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
  pending_plan_code?: 'basic' | 'pro' | null
  pending_plan_name?: string | null
  pending_billing_period?: 'monthly' | 'yearly' | null
  pending_change_effective_at?: string | null
}

export interface ApiPatient {
  id: string
  patient_id: string
  full_name: string
  // DB column allows NULL — render sites should guard for empty/null phone.
  phone: string | null
  secondary_phone?: string | null
  date_of_birth?: string | null
  gender?: 'male' | 'female' | null
  address?: string | null
  medical_history?: string | null
  allergies?: string | null
  current_medications?: string | null
  photo_url?: string | null
  photo_thumbnail_url?: string | null
  photo_preview_url?: string | null
  photo_thumbnail_ready?: boolean
  photo_preview_ready?: boolean
  photo_scan_status?: 'pending' | 'approved' | 'rejected' | null
  created_at?: string
  updated_at?: string
  created_by?: ApiRecordActor | null
  updated_by?: ApiRecordActor | null
  last_visit_at?: string
  is_archived?: boolean
  categories?: ApiPatientCategory[]
  /**
   * The backend still calls this clinical-photo group `smile`, but the
   * product exposes it as one flat "General photos" gallery. `top` and
   * `bottom` are legacy web/API view types and are intentionally not shown
   * in mobile.
   */
  oral_photo_galleries?: Partial<Record<ApiPatientClinicalPhotoViewType, ApiPatientClinicalPhoto[]>>
}

export type ApiPatientClinicalPhotoViewType = 'smile' | 'top' | 'bottom'

export interface ApiPatientClinicalPhoto {
  id: string
  view_type: ApiPatientClinicalPhotoViewType
  scan_status: 'pending' | 'approved' | 'rejected'
  url?: string | null
  thumbnail_url?: string | null
  preview_url?: string | null
  thumbnail_ready?: boolean
  preview_ready?: boolean
  is_primary?: boolean
  sort_order?: number
  created_at?: string | null
  updated_at?: string | null
}

/** Lightweight patient identity returned by appointment/payment selectors. */
export interface ApiPatientLookup {
  id: string
  patient_id: string
  full_name: string
  phone: string | null
  secondary_phone?: string | null
  updated_at?: string | null
  photo_scan_status?: 'pending' | 'approved' | 'rejected' | null
  photo_thumbnail_url?: string | null
  photo_url?: string | null
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
  patient_id: string | null
  patient_name?: string
  guest_name?: string | null
  guest_phone?: string | null
  is_guest?: boolean
  appointment_date: string
  start_time: string
  end_time: string
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
  notes: string | null
  created_by?: ApiRecordActor | null
  updated_by?: ApiRecordActor | null
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
  currency?: 'UZS' | 'USD' | null
  images: ApiTreatmentImage[]
  payments?: ApiTreatmentPayment[]
  created_at?: string
}

export interface ApiTreatmentPayment {
  id: string
  amount: number
  recorded_at: string // ISO timestamp
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
  working_hours_end: string
  revenue_this_month: number
  outstanding_debt_total: number
  financials_by_currency: Record<DashboardCurrency, DashboardFinancialSummary>
  today_appointments: DashboardAppointmentView[]
}

export interface ApiRecordActor {
  id: string
  name: string
  role: ApiUser['role']
}

export type DashboardCurrency = 'UZS' | 'USD'

export interface DashboardFinancialSummary {
  revenue_this_month: number
  outstanding_debt_total: number
}

export interface ApiAnalyticsKpiPair {
  current: number
  previous: number
}

export interface ApiAnalyticsBucket {
  key: string
  revenue: number
  debt: number
  new_patients: number
  cumulative_patients: number
}

export interface ApiAnalyticsAppointmentStatus {
  status: ApiAppointment['status']
  count: number
}

export interface ApiAnalyticsTopDebtor {
  name: string
  phone: string
  debt: number
}

export interface ApiAnalyticsSummary {
  currency: DashboardCurrency
  permissions: {
    payments: boolean
    patients: boolean
    appointments: boolean
  }
  kpis: {
    revenue: ApiAnalyticsKpiPair
    debt: { current: number; previous: number | null }
    patients: ApiAnalyticsKpiPair
    visits: ApiAnalyticsKpiPair
  }
  buckets: ApiAnalyticsBucket[]
  appointment_status: ApiAnalyticsAppointmentStatus[]
  top_debtors: ApiAnalyticsTopDebtor[]
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

// Audit log (Staff → Action logs). Mirrors web ApiAuditLogEntry.
export interface ApiAuditActor {
  id?: string
  name?: string | null
  role?: string | null
}

export interface ApiAuditLogEntry {
  id: string
  event_type: string
  entity_type: string | null
  entity_id: string | null
  actor_role: string | null
  actor: ApiAuditActor | null
  ip_address: string | null
  user_agent: string | null
  metadata: Record<string, unknown> | null
  created_at: string | null
}

export interface ApiResponse<T> {
  data: T
}
