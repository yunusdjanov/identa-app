import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

import SettingsRow from '../SettingsRow'

describe('SettingsRow', () => {
  it('calls its action when enabled', () => {
    const onPress = jest.fn()
    const screen = render(
      <SettingsRow iconName="person-outline" label="Profile" onPress={onPress} />
    )

    fireEvent.press(screen.getByRole('button'))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('does not call its action and exposes accessibility state when disabled', () => {
    const onPress = jest.fn()
    const screen = render(
      <SettingsRow
        iconName="person-outline"
        label="Profile"
        disabled
        onPress={onPress}
      />
    )
    const row = screen.getByRole('button')

    fireEvent.press(row)

    expect(onPress).not.toHaveBeenCalled()
    expect(row.props.accessibilityState).toEqual({ disabled: true })
  })
})
