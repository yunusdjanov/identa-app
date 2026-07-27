import React from 'react'
import { Platform, StyleSheet } from 'react-native'
import { fireEvent } from '@testing-library/react-native'

import OverflowMenuButton from '../OverflowMenuButton'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'

describe('OverflowMenuButton', () => {
  it('keeps one compact visual style inside an accessible touch target', () => {
    const onPress = jest.fn()
    const screen = renderWithProviders(
      <OverflowMenuButton label="Boshqa amallar" onPress={onPress} />
    )

    expect(StyleSheet.flatten(screen.getByTestId('overflow-menu-button').props.style))
      .toMatchObject({
        width: Platform.OS === 'ios' ? 44 : 48,
        height: Platform.OS === 'ios' ? 44 : 48,
      })
    expect(StyleSheet.flatten(screen.getByTestId('overflow-menu-visual').props.style))
      .toMatchObject({
        width: 32,
        height: 32,
        borderRadius: 10,
      })

    fireEvent.press(screen.getByLabelText('Boshqa amallar'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('exposes loading as a disabled busy state', () => {
    const onPress = jest.fn()
    const screen = renderWithProviders(
      <OverflowMenuButton label="Boshqa amallar" onPress={onPress} loading />
    )

    expect(screen.getByLabelText('Boshqa amallar')).toHaveAccessibilityState({
      disabled: true,
      busy: true,
    })
    fireEvent.press(screen.getByLabelText('Boshqa amallar'))
    expect(onPress).not.toHaveBeenCalled()
  })
})
