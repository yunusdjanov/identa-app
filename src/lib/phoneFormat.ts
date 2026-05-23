// Uzbek phone-number formatting + validation utilities.
//
// Mobile inputs accept anything the user types but normalize on the way
// in so the displayed value always reads as `+998 XX XXX XX XX`. The raw
// E.164-style string (`+998901234567`) is what we send to the backend.
//
// Length rules:
//   • Uzbek mobile numbers are 12 digits total (`998` + 9-digit subscriber)
//   • Users routinely paste numbers without the country code; we infer
//     `998` automatically when the input looks like a 9-digit local
//     number that doesn't already start with `998`.
//   • Inputs longer than 12 digits get truncated client-side so users
//     can't accidentally type past the valid length.
//
// This helper is keyboard-agnostic. Combine with `keyboardType="phone-pad"`
// on the input for the best on-screen keyboard.

const COUNTRY_CODE = '998'
export const PHONE_MAX_DIGITS = 12

// Strip everything except digits. Useful both for raw input and for
// recovering digits from a previously formatted display string.
export function digitsOnly(input: string): string {
  return input.replace(/\D/g, '')
}

// Coerce a possibly partial input into the canonical 12-digit form
// (with `998` country code), capped at PHONE_MAX_DIGITS. Returns just
// digits — pass through `formatPhoneDisplay` for the formatted version.
export function normalizePhoneDigits(input: string): string {
  let digits = digitsOnly(input)
  // 12 → already includes country code; trim anything beyond it
  if (digits.length > PHONE_MAX_DIGITS) {
    digits = digits.slice(0, PHONE_MAX_DIGITS)
  }
  // Heuristic: if the user typed something that starts with 9 digits of
  // a local number (not the country code), prepend 998. We don't infer
  // for partial inputs (1–8 digits) because the user might be mid-typing
  // the country code prefix.
  if (digits.length === 9 && !digits.startsWith(COUNTRY_CODE)) {
    digits = COUNTRY_CODE + digits
  }
  return digits
}

// Format a digits string as `+998 XX XXX XX XX`. Partial inputs format
// as far as they can without breaking the layout:
//   "9"           → "+9"          (1)
//   "998"         → "+998"        (3)
//   "99890"       → "+998 90"     (5)
//   "998901"      → "+998 90 1"   (6)
//   "9989011"     → "+998 90 11"  (7)
//   "99890123"    → "+998 90 123" (8)
//   "9989012345"  → "+998 90 123 45" (10)
//   "998901234567" → "+998 90 123 45 67" (12)
export function formatPhoneDisplay(digits: string): string {
  if (!digits) return ''
  const cc = digits.slice(0, 3)
  const op = digits.slice(3, 5)
  const a = digits.slice(5, 8)
  const b = digits.slice(8, 10)
  const c = digits.slice(10, 12)
  let out = `+${cc}`
  if (op) out += ` ${op}`
  if (a) out += ` ${a}`
  if (b) out += ` ${b}`
  if (c) out += ` ${c}`
  return out
}

// One-shot helper for input `onChangeText` handlers. Wraps
// normalize + format so callers don't have to juggle both functions.
// Returns the formatted display string AND the raw digit string so the
// caller can keep both forms in state if needed.
export function applyPhoneInput(input: string): { display: string; raw: string } {
  const digits = normalizePhoneDigits(input)
  return {
    display: formatPhoneDisplay(digits),
    raw: digits.length === PHONE_MAX_DIGITS ? `+${digits}` : digits ? `+${digits}` : '',
  }
}

// Validation predicate. Returns true when the input represents a fully
// formed Uzbek mobile number (`+998 XX XXX XX XX` in any whitespace).
export function isValidUzbekPhone(input: string): boolean {
  return digitsOnly(input).length === PHONE_MAX_DIGITS
}

// Display-only formatter for existing stored numbers (read-only screens
// like PatientCard, ActionSheet message lines). Falls through unchanged
// for non-Uzbek numbers or anything we can't normalize.
export function formatStoredPhone(input: string | null | undefined): string {
  if (!input) return ''
  const primary = input.split('|')[0]!.trim()
  const digits = digitsOnly(primary)
  if (digits.length === PHONE_MAX_DIGITS && digits.startsWith(COUNTRY_CODE)) {
    return formatPhoneDisplay(digits)
  }
  return primary
}
