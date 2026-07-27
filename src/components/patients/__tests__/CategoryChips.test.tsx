import React from 'react'
import { fireEvent } from '@testing-library/react-native'

import CategoryChips from '../CategoryChips'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'

describe('CategoryChips', () => {
  it('renders backend categories and selects one by id', () => {
    const onSelect = jest.fn()
    const screen = renderWithProviders(
      <CategoryChips
        categories={[
          { id: 'cat-vip', name: 'VIP', color: '#F59E0B' },
          { id: 'cat-child', name: 'Bolalar', color: '#3B82F6' },
        ]}
        activeId="all"
        onSelect={onSelect}
      />
    )

    expect(screen.getByRole('button', { name: 'Barchasi' }))
      .toHaveAccessibilityState({ selected: true })
    expect(screen.getByRole('button', { name: 'VIP' }))
      .toHaveAccessibilityState({ selected: false })

    fireEvent.press(screen.getByRole('button', { name: 'VIP' }))

    expect(onSelect).toHaveBeenCalledWith('cat-vip')
  })

  it('offers a single reset action when filters are active', () => {
    const onReset = jest.fn()
    const screen = renderWithProviders(
      <CategoryChips
        categories={[]}
        activeId="inactive"
        onSelect={jest.fn()}
        showReset
        onReset={onReset}
      />
    )

    fireEvent.press(screen.getByRole('button', { name: 'Filterlarni tozalash' }))

    expect(onReset).toHaveBeenCalledTimes(1)
  })
})
