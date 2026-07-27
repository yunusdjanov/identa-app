import React from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import { fireEvent, render } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { DialogProvider, useDialog } from '../Dialog'
import { I18nProvider } from '../../../i18n'

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 44, left: 0, right: 0, bottom: 34 },
}

function ActionSheetHarness({ onResolved }: { onResolved: jest.Mock }) {
  const { actionSheet } = useDialog()

  return (
    <Pressable
      accessibilityRole="button"
      onPress={async () => {
        const result = await actionSheet({
          title: 'Actions',
          options: [
            { label: 'Disabled export', icon: 'download-outline', disabled: true },
            { label: 'Enabled action', icon: 'list-outline' },
          ],
        })
        onResolved(result)
      }}
    >
      <Text>Open actions</Text>
    </Pressable>
  )
}

function GridActionSheetHarness() {
  const { actionSheet } = useDialog()

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        actionSheet({
          title: 'Patient actions',
          layout: 'grid',
          cancelLabel: 'Close',
          options: [
            { label: 'Call', icon: 'call-outline' },
            { label: 'Open', icon: 'open-outline' },
            { label: 'Edit', icon: 'create-outline' },
            { label: 'Telegram', icon: 'paper-plane-outline' },
          ],
        })
      }}
    >
      <Text>Open grid actions</Text>
    </Pressable>
  )
}

describe('<DialogProvider /> action sheet', () => {
  it('keeps a disabled action visible but prevents selection', () => {
    const onResolved = jest.fn()
    const screen = render(
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <I18nProvider defaultLocale="uz">
          <DialogProvider>
            <ActionSheetHarness onResolved={onResolved} />
          </DialogProvider>
        </I18nProvider>
      </SafeAreaProvider>
    )

    fireEvent.press(screen.getByText('Open actions'))

    const disabledAction = screen.getByRole('button', { name: 'Disabled export' })
    expect(disabledAction).toHaveAccessibilityState({ disabled: true })

    fireEvent.press(disabledAction)

    expect(onResolved).not.toHaveBeenCalled()
    expect(screen.getByText('Actions')).toBeTruthy()
  })

  it('renders polished compact action tiles side by side in grid mode', () => {
    const screen = render(
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <I18nProvider defaultLocale="uz">
          <DialogProvider>
            <GridActionSheetHarness />
          </DialogProvider>
        </I18nProvider>
      </SafeAreaProvider>
    )

    fireEvent.press(screen.getByText('Open grid actions'))

    const call = screen.getByRole('button', { name: 'Call' })
    expect(StyleSheet.flatten(call.props.style)).toMatchObject({
      flex: 1,
      minHeight: 66,
      alignItems: 'center',
      borderRadius: 10,
    })
    expect(screen.getByRole('button', { name: 'Open' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Telegram' })).toBeTruthy()
    const close = screen.getByRole('button', { name: 'Close' })
    expect(StyleSheet.flatten(close.props.style)).toMatchObject({
      minHeight: 44,
      borderRadius: 10,
    })
    expect(screen.queryByRole('button', { name: 'Bekor qilish' })).toBeNull()
  })
})
