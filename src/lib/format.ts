import type { Locale } from '../constants'

const LOCALE_MAP: Record<Locale, string> = {
  uz: 'uz-UZ',
  ru: 'ru-RU',
  en: 'en-US',
}

export function toIntlLocale(locale: Locale): string {
  return LOCALE_MAP[locale] ?? 'en-US'
}

// Format a number as a compact UZS currency string.
// Examples:
//   4_500_000 → "4.5M so'm" (uz) / "4,5 млн" (ru) / "$4.5M" (en, fallback)
// For dental clinic context, all currency is UZS regardless of locale.
// Split-format for visual hierarchy: { value: "4.5", unit: "mln so'm" }.
// Used by hero/finance cards that style value and unit differently.
export function formatCurrencyParts(amount: number, locale: Locale): { value: string; unit: string } {
  // Defensive: backend can transiently ship null/undefined/NaN before a
  // refetch completes, and React Query's persisted cache may rehydrate
  // stale values from before a mapper fix. Treating anything non-finite
  // as 0 keeps the card readable instead of rendering Intl.NumberFormat's
  // locale-specific "не число" / "NaN" output.
  const safe = Number.isFinite(amount) ? amount : 0
  const abs = Math.abs(safe)
  const sign = safe < 0 ? '-' : ''

  if (abs >= 1_000_000) {
    const v = (abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)
    return { value: `${sign}${stripTrailingZero(v)}`, unit: currencySuffix(locale, 'M').trim() }
  }
  if (abs >= 1_000) {
    const v = (abs / 1_000).toFixed(abs >= 100_000 ? 0 : 1)
    return { value: `${sign}${stripTrailingZero(v)}`, unit: currencySuffix(locale, 'K').trim() }
  }
  return {
    value: `${sign}${abs.toLocaleString(toIntlLocale(locale))}`,
    unit: currencyUnit(locale),
  }
}

export function formatCurrency(amount: number, locale: Locale): string {
  const safe = Number.isFinite(amount) ? amount : 0
  const abs = Math.abs(safe)
  const sign = safe < 0 ? '-' : ''

  if (abs >= 1_000_000) {
    const value = (abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)
    const suffix = currencySuffix(locale, 'M')
    return `${sign}${stripTrailingZero(value)}${suffix}`
  }

  if (abs >= 1_000) {
    const value = (abs / 1_000).toFixed(abs >= 100_000 ? 0 : 1)
    const suffix = currencySuffix(locale, 'K')
    return `${sign}${stripTrailingZero(value)}${suffix}`
  }

  return `${sign}${abs.toLocaleString(toIntlLocale(locale))} ${currencyUnit(locale)}`
}

function stripTrailingZero(value: string): string {
  return value.replace(/\.0$/, '')
}

function currencySuffix(locale: Locale, scale: 'M' | 'K'): string {
  if (scale === 'M') {
    if (locale === 'uz') return " mln so'm"
    if (locale === 'ru') return ' млн сум'
    return 'M UZS'
  }
  if (locale === 'uz') return " ming so'm"
  if (locale === 'ru') return ' тыс сум'
  return 'K UZS'
}

function currencyUnit(locale: Locale): string {
  if (locale === 'uz') return "so'm"
  if (locale === 'ru') return 'сум'
  return 'UZS'
}

// "HH:MM" or full Date → short time label "09:30"
export function formatTime(time: string): string {
  return time.length >= 5 ? time.substring(0, 5) : time
}

// Calendar-correct age in whole years from a date of birth (local time).
// Mirrors web `computePatientAge`. Returns null for missing/invalid input.
// Use this everywhere instead of a `365.25`-day division, which drifts by a
// year around birthdays.
export function ageFromDob(dob: Date | null): number | null {
  if (!dob || Number.isNaN(dob.getTime())) return null
  const now = new Date()
  let years = now.getFullYear() - dob.getFullYear()
  const monthDelta = now.getMonth() - dob.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) {
    years--
  }
  return years
}

// Local "YYYY-MM-DD" string for today's date in the user's timezone.
export function toLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Parse "YYYY-MM-DD" → Date (local time).
export function fromLocalDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map((n) => parseInt(n, 10))
  return new Date(y!, (m ?? 1) - 1, d ?? 1)
}

// Monday-aligned start of the week for a given date.
export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0 = Sun
  const offset = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + offset)
  return d
}

// Add N calendar days to a date.
export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

// Compare dates by Y-M-D (ignores time).
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// Locale-aware month-year label, e.g. "May 2026" or "Май 2026".
export function formatMonthYear(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

// Locale-aware short weekday label, e.g. "Mon" or "Пн".
export function formatWeekdayShort(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(toIntlLocale(locale), { weekday: 'short' }).format(date)
}

// Locale-aware long weekday label, e.g. "Monday" or "Понедельник".
export function formatWeekdayLong(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(toIntlLocale(locale), { weekday: 'long' }).format(date)
}

// Day + month, e.g. "16 May" or "16 мая".
export function formatDayMonth(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    day: 'numeric',
    month: 'long',
  }).format(date)
}

// "Today, 16 May, Friday" using Intl.DateTimeFormat (Hermes engine supports Intl in RN 0.65+).
export function formatLongDate(date: Date, locale: Locale, todayLabel?: string): string {
  const intlLocale = toIntlLocale(locale)
  const formatter = new Intl.DateTimeFormat(intlLocale, {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  })
  const formatted = formatter.format(date)
  return todayLabel ? `${todayLabel}, ${formatted}` : formatted
}

export function getGreetingKey(date: Date = new Date()): 'morning' | 'afternoon' | 'evening' {
  const h = date.getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}

// Minutes until a given HH:MM time today. Negative if in the past.
export function minutesUntil(targetTime: string, now: Date = new Date()): number {
  const [h, m] = targetTime.split(':').map((n) => parseInt(n, 10) || 0)
  const target = h * 60 + m
  const current = now.getHours() * 60 + now.getMinutes()
  return target - current
}

// Returns a relative-time bucket key for i18n lookup.
// Caller resolves via t(`relativeTime.${key}`).
export type RelativeBucket = 'now' | 'soon' | 'minutes' | 'hour' | 'hours' | 'later'

export function getRelativeBucket(minutes: number): { bucket: RelativeBucket; value?: number } {
  if (minutes <= 5) return { bucket: 'now' }
  if (minutes <= 15) return { bucket: 'soon' }
  if (minutes < 60) return { bucket: 'minutes', value: Math.round(minutes / 5) * 5 }
  if (minutes < 120) return { bucket: 'hour' }
  if (minutes < 240) return { bucket: 'hours', value: Math.round(minutes / 60) }
  return { bucket: 'later' }
}

// Relative date bucket (days-scale, past-only). Used for "last visit X ago".
export type RelativeDateBucket =
  | { bucket: 'today' }
  | { bucket: 'yesterday' }
  | { bucket: 'daysAgo'; value: number }
  | { bucket: 'weeksAgo'; value: number }
  | { bucket: 'monthsAgo'; value: number }
  | { bucket: 'yearsAgo'; value: number }

export function getRelativeDateBucket(date: Date, now: Date = new Date()): RelativeDateBucket {
  const dayMs = 86_400_000
  const days = Math.floor((now.getTime() - date.getTime()) / dayMs)

  if (days <= 0) return { bucket: 'today' }
  if (days === 1) return { bucket: 'yesterday' }
  if (days < 14) return { bucket: 'daysAgo', value: days }
  if (days < 60) return { bucket: 'weeksAgo', value: Math.floor(days / 7) }
  if (days < 365) return { bucket: 'monthsAgo', value: Math.floor(days / 30) }
  return { bucket: 'yearsAgo', value: Math.floor(days / 365) }
}
