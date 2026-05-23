import { DEFAULT_LOCALE, type Locale } from '../constants'

// Module-level mirror of the active locale so non-React code paths
// (mutation cache callbacks, scheduled notification builders, axios
// interceptors) can read the user's chosen language without going through
// the React context. The I18nProvider keeps this in sync with its state.

let _locale: Locale = DEFAULT_LOCALE

export function getCurrentLocale(): Locale {
  return _locale
}

export function setCurrentLocale(locale: Locale): void {
  _locale = locale
}
