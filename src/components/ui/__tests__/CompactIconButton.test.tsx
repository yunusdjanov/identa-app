import React from 'react'
import { Platform, StyleSheet } from 'react-native'
import { fireEvent } from '@testing-library/react-native'

import CompactIconButton from '../CompactIconButton'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'

describe('CompactIconButton', () => {
  it('uses a compact visual surface without shrinking the touch target', () => {
    const onPress = jest.fn()
    const screen = renderWithProviders(
      <CompactIconButton icon="add" label="Yozuv qo'shish" onPress={onPress} />
    )

    expect(StyleSheet.flatten(screen.getByLabelText("Yozuv qo'shish").props.style))
      .toMatchObject({
        width: Platform.OS === 'ios' ? 44 : 48,
        height: Platform.OS === 'ios' ? 44 : 48,
      })
    expect(StyleSheet.flatten(screen.getByTestId('compact-icon-visual').props.style))
      .toMatchObject({ width: 32, height: 32, borderRadius: 10 })

    fireEvent.press(screen.getByLabelText("Yozuv qo'shish"))
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})
