import { translations } from './translations'
import type { Locale } from '../constants'

// Vars accepted by the `t()` interpolator. The runtime renders them via
// String(value), so any primitive that has a sensible toString works.
export type TVars = Record<string, string | number>

// Type alias for the translation function passed through helper props.
// Keeps `t: (k: string, v?: any) => string` from spreading everywhere.
export type TFunction = (key: string, vars?: TVars) => string

// Typed accessor for translation values that aren't plain strings (and so
// can't be reached through the regular `t()` function). Resolves a dotted
// path against the active locale's dictionary, then casts the result to
// the caller-provided type — preferable to scattering `as any` casts at
// every call site.
//
// Example:
//   const reasons = getTranslationValue<string[]>(locale, 'appointments.create.quickReasons')
//
// Returns `null` if the path doesn't resolve, so callers must handle the
// missing case explicitly.
export function getTranslationValue<T>(
  locale: Locale,
  path: string
): T | null {
  const dict = translations[locale] as unknown as Record<string, unknown>
  const value = path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, dict)
  return (value as T | undefined) ?? null
}

// Convenience wrapper for arrays — always returns an array (empty if the
// key is missing), so call sites can iterate without null checks.
export function getTranslationArray<T>(locale: Locale, path: string): T[] {
  const value = getTranslationValue<T[]>(locale, path)
  return Array.isArray(value) ? value : []
}
