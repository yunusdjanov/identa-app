import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

import FinanceSummaryCard from '../FinanceSummaryCard'
import { I18nProvider } from '../../../i18n'

describe('FinanceSummaryCard', () => {
  it('hides every amount without leaking it through accessibility labels', () => {
    const onToggleVisibility = jest.fn()
    const screen = render(
      <I18nProvider defaultLocale="uz">
        <FinanceSummaryCard
          revenue={[{ currency: 'UZS', value: '125', unit: "ming so'm" }]}
          debt={[{ currency: 'USD', value: '40', unit: 'USD' }]}
          hasDebt
          hidden
          updatedAt="10:42"
          onToggleVisibility={onToggleVisibility}
          onPress={jest.fn()}
        />
      </I18nProvider>
    )

    expect(screen.getAllByText('••••••')).toHaveLength(2)
    expect(screen.queryByText('125')).toBeNull()
    expect(screen.queryByLabelText(/125/)).toBeNull()

    fireEvent.press(screen.getByRole('button', { name: "Pul miqdorlarini ko'rsatish" }))
    expect(onToggleVisibility).toHaveBeenCalledTimes(1)
  })
})
