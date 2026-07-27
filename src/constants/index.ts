// Base URL for the Laravel backend (Sanctum-based). The `/api/v1` prefix
// matches `routes/api.php` Route::prefix('v1') group on the server.
//
// Override per environment via EXPO_PUBLIC_API_URL — e.g. to point at the
// deployed instance from a release build, or at a LAN IP when testing
// from a real device. The default targets the Android emulator's special
// host alias (10.0.2.2 → host machine's localhost) so `php artisan serve`
// on the dev laptop is reachable out of the box.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8001/api/v1'

// Human-readable device label reported to the backend. The backend appends a
// unique token-family id, so multiple installations can safely share it.
export const DEVICE_NAME = 'Identa Mobile'

// Access tokens issued by the backend expire after 15 minutes (per
// AuthController::MOBILE_ACCESS_TTL_MINUTES). Refresh-on-401 handles the
// rotation; this constant exists so client code can avoid surprise.
export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000

export const APPOINTMENT_STATUS_COLORS = {
  scheduled: '#0ea5e9',
  completed: '#10b981',
  cancelled: '#6b7280',
  no_show:   '#ef4444',
} as const

export const TOOTH_CONDITION_COLORS = {
  healthy:    '#22c55e',
  cavity:     '#ef4444',
  filling:    '#3b82f6',
  crown:      '#eab308',
  root_canal: '#a855f7',
  extraction: '#6b7280',
  implant:    '#16a34a',
} as const

export const APPOINTMENT_DURATION_OPTIONS = [15, 30, 45, 60, 90, 120]

export const DEFAULT_WORKING_HOURS = { start: '08:00', end: '18:00' }

export const SUPPORTED_LOCALES = ['ru', 'uz', 'en'] as const
export type Locale = typeof SUPPORTED_LOCALES[number]

export const DEFAULT_LOCALE: Locale = 'ru'

export const PAGE_SIZE = 10
