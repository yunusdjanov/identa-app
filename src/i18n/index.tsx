import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import { translations } from './translations'
import { DEFAULT_LOCALE, type Locale } from '../constants'
import { setNotificationLocale } from '../lib/notifications'
import { setCurrentLocale } from '../lib/currentLocale'

type Dict = typeof translations.uz

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (path: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function getNested(obj: any, path: string): unknown {
  return path.split('.').reduce((acc: any, key: string) => {
    if (acc && typeof acc === 'object' && key in acc) return acc[key]
    return null
  }, obj)
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return key in vars ? String(vars[key]) : match
  })
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE)

  const dict = translations[locale] as Dict
  const t = useCallback(
    (path: string, vars?: Record<string, string | number>) => {
      const value = getNested(dict, path)
      if (typeof value === 'string') return interpolate(value, vars)
      return path
    },
    [dict]
  )

  // Keep non-React modules (notification scheduler, mutation cache toast)
  // in sync with the current locale so messages they produce use the
  // right language.
  useEffect(() => {
    setNotificationLocale(locale)
    setCurrentLocale(locale)
  }, [locale])

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
