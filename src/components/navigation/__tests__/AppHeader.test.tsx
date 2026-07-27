import React from 'react'
import { Text } from 'react-native'
import { fireEvent } from '@testing-library/react-native'

import AppHeader, { HeaderIconButton } from '../AppHeader'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'

describe('AppHeader', () => {
  it('renders a concise title hierarchy and an accessible back action', () => {
    const onBack = jest.fn()
    const screen = renderWithProviders(
      <AppHeader
        title="Bemorlar"
        subtitle="42 ta bemor"
        onBack={onBack}
        backLabel="Ortga"
      />
    )

    expect(screen.getByRole('header', { name: 'Bemorlar' })).toBeTruthy()
    expect(screen.getByText('42 ta bemor')).toBeTruthy()
    fireEvent.press(screen.getByLabelText('Ortga'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('exposes loading and disabled state on header actions', () => {
    const onPress = jest.fn()
    const screen = renderWithProviders(
      <HeaderIconButton
        icon="download-outline"
        label="PDF eksport"
        onPress={onPress}
        loading
      />
    )

    expect(screen.getByLabelText('PDF eksport')).toBeDisabled()
    fireEvent.press(screen.getByLabelText('PDF eksport'))
    expect(onPress).not.toHaveBeenCalled()
  })

  it('supports a compact control below the title instead of subtitle copy', () => {
    const screen = renderWithProviders(
      <AppHeader
        title="Weekly planner"
        subtitle="Old subtitle"
        supportingContent={<Text>Jul 2026</Text>}
      />
    )

    expect(screen.getByText('Jul 2026')).toBeTruthy()
    expect(screen.queryByText('Old subtitle')).toBeNull()
  })
})
