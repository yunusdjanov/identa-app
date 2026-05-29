import React from 'react'
import { render, type RenderOptions } from '@testing-library/react-native'
import { I18nProvider } from '../i18n'
import type { Locale } from '../constants'

interface Options extends Omit<RenderOptions, 'wrapper'> {
  // Defaults to 'uz' (primary user language) so test queries can match the
  // Uzbek copy that appears in translations.ts. Override per-test when
  // verifying ru/en-specific behavior.
  locale?: Locale
}

export function renderWithProviders(ui: React.ReactElement, { locale = 'uz', ...options }: Options = {}) {
  return render(<I18nProvider defaultLocale={locale}>{ui}</I18nProvider>, options)
}
