import React from 'react'
import { StyleSheet } from 'react-native'
import { fireEvent } from '@testing-library/react-native'

import AnalyticsKpiCard from '../AnalyticsKpiCard'
import AnalyticsRangeSelector from '../AnalyticsRangeSelector'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'

describe('analytics presentation components', () => {
  it('presents KPI value, description and previous-period delta as one accessible summary', () => {
    const screen = renderWithProviders(
      <AnalyticsKpiCard
        label="Tushum"
        description="Davr ichida qabul qilingan toʻlovlar"
        value="1 500 000 UZS"
        delta={50}
        icon="wallet-outline"
        accent="teal"
      />
    )

    const card = screen.getByLabelText(
      'Tushum: 1 500 000 UZS. Davr ichida qabul qilingan toʻlovlar. +50%, oldingi davrga nisbatan'
    )
    expect(card).toBeTruthy()
    expect(StyleSheet.flatten(card.props.style)).toMatchObject({ minHeight: 108 })
    expect(screen.getByText('+50%')).toBeTruthy()
    expect(screen.queryByText('oldingi davrga nisbatan')).toBeNull()
  })

  it('keeps the active range as a radio and changes it from a full touch target', () => {
    const onChange = jest.fn()
    const screen = renderWithProviders(
      <AnalyticsRangeSelector value="180d" onChange={onChange} />
    )

    expect(screen.getByRole('radio', { name: '6 oy' })).toHaveAccessibilityState({
      selected: true,
      checked: true,
    })

    fireEvent.press(screen.getByRole('radio', { name: '30 kun' }))
    expect(onChange).toHaveBeenCalledWith('30d')
  })
})
