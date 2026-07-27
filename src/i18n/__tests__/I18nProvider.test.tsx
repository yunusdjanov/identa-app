import React from 'react'
import { Text } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { render, waitFor } from '@testing-library/react-native'

import { I18nProvider, useI18n } from '..'

function LocaleProbe() {
  const { locale, isHydrating } = useI18n()
  return <Text>{`${locale}:${isHydrating}`}</Text>
}

describe('I18nProvider hydration', () => {
  beforeEach(() => {
    jest.mocked(AsyncStorage.getItem).mockReset()
  })

  it('does not report ready until the persisted locale is restored', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce('en')
    const screen = render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>
    )

    await waitFor(() => expect(screen.getByText('en:false')).toBeTruthy())
    expect(AsyncStorage.getItem).toHaveBeenCalledWith('@identa/locale')
  })

  it('skips storage hydration for an explicit test locale', () => {
    const screen = render(
      <I18nProvider defaultLocale="uz">
        <LocaleProbe />
      </I18nProvider>
    )

    expect(screen.getByText('uz:false')).toBeTruthy()
    expect(AsyncStorage.getItem).not.toHaveBeenCalled()
  })
})
