// Validation rules mirror the web `lib/input-validation.ts` so backend and
// frontend agree on what's acceptable. Mobile equivalents return only the i18n
// key suffix (e.g. 'passwordMin') and the screen resolves the full localized
// message via `t('register.errors.<suffix>')`.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const COMMON_PASSWORDS = new Set([
  '12345678',
  '123456789',
  '11111111',
  'admin123',
  'letmein123',
  'password',
  'password1',
  'password123',
  'qwerty123',
  'qwertyui',
  'welcome1',
])

export const INPUT_LIMITS = {
  personName: 255,
  email: 255,
  password: 255,
} as const

export type EmailErrorKey = 'emailRequired' | 'emailInvalid'
export type PasswordErrorKey =
  | 'passwordRequired'
  | 'passwordMin'
  | 'passwordLetterNumber'
  | 'passwordTooCommon'

export function validateEmail(value: string, opts?: { required?: boolean }): EmailErrorKey | null {
  const required = opts?.required ?? false
  const trimmed = value.trim()
  if (!trimmed) return required ? 'emailRequired' : null
  if (!EMAIL_PATTERN.test(trimmed)) return 'emailInvalid'
  if (trimmed.length > INPUT_LIMITS.email) return 'emailInvalid'
  return null
}

export function validatePassword(value: string, opts?: { required?: boolean }): PasswordErrorKey | null {
  const required = opts?.required ?? false
  // Passwords are opaque values: validate the exact string that is sent to
  // the API instead of silently trimming it and checking a different value.
  if (!value) return required ? 'passwordRequired' : null
  if (value.length < 8) return 'passwordMin'
  if (value.length > INPUT_LIMITS.password) return 'passwordMin'
  if (COMMON_PASSWORDS.has(value.toLowerCase())) return 'passwordTooCommon'
  if (!/[a-z]/i.test(value) || !/\d/.test(value)) return 'passwordLetterNumber'
  return null
}

export type PasswordStrength = 0 | 1 | 2 | 3 // none, weak, medium, strong

export function getPasswordStrength(value: string): PasswordStrength {
  if (!value) return 0
  let score = 0
  if (value.length >= 8) score++
  if (value.length >= 12) score++
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++
  if (/\d/.test(value)) score++
  if (/[^A-Za-z0-9]/.test(value)) score++
  if (COMMON_PASSWORDS.has(value.toLowerCase())) return 1
  if (score >= 4) return 3
  if (score >= 2) return 2
  return 1
}
