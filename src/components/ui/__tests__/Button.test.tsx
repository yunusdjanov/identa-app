import React from 'react'
import { StyleSheet, View } from 'react-native'
import { render } from '@testing-library/react-native'

import Button from '../Button'

describe('<Button />', () => {
  it('uses a minimum height and a wrapping label for long localized copy', () => {
    const screen = render(
      <Button
        title="Подтвердить запланированное изменение"
        variant="secondary"
        size="md"
        fullWidth
      />
    )

    const button = screen.getByRole('button')
    const container = button.findByType(View)
    const label = screen.getByText('Подтвердить запланированное изменение')

    expect(StyleSheet.flatten(container.props.style)).toMatchObject({
      minHeight: 44,
      paddingVertical: 9,
    })
    expect(StyleSheet.flatten(label.props.style)).toMatchObject({
      flexShrink: 1,
      textAlign: 'center',
    })
    expect(StyleSheet.flatten(container.props.style).height).toBeUndefined()
  })
})
