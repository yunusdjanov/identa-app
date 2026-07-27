import React from 'react'
import { Text } from 'react-native'
import { act, fireEvent, render } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import BottomSheet from '../BottomSheet'

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 44, left: 0, right: 0, bottom: 34 },
}

describe('<BottomSheet />', () => {
  beforeAll(() => {
    jest.useFakeTimers()
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  it('keeps an optional footer outside the scrollable content', () => {
    const screen = render(
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <BottomSheet
          visible
          title="Compact form"
          closeAccessibilityLabel="Close"
          onClose={() => {}}
          footer={<Text>Sticky action</Text>}
        >
          <Text>Scrollable fields</Text>
        </BottomSheet>
      </SafeAreaProvider>
    )

    expect(screen.getByText('Scrollable fields')).toBeTruthy()
    expect(screen.getByTestId('bottom-sheet-footer')).toContainElement(
      screen.getByText('Sticky action')
    )
  })

  it('checks the close guard before starting the closing animation', async () => {
    const onClose = jest.fn()
    const onBeforeClose = jest.fn().mockResolvedValue(false)
    const screen = render(
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <BottomSheet
          visible
          title="Protected form"
          closeAccessibilityLabel="Close"
          onClose={onClose}
          onBeforeClose={onBeforeClose}
        >
          <Text>Unsaved fields</Text>
        </BottomSheet>
      </SafeAreaProvider>
    )

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Close'))
      await Promise.resolve()
    })

    expect(onBeforeClose).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText('Unsaved fields')).toBeTruthy()
  })
})
