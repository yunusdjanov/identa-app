import React from 'react'
import { render } from '@testing-library/react-native'

import { I18nProvider } from '../../../i18n'
import MonthCalendarPicker from '../MonthCalendarPicker'

jest.mock('../BottomSheet', () => ({
  __esModule: true,
  default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => {
    const { View } = require('react-native')
    return visible ? <View>{children}</View> : null
  },
}))

describe('<MonthCalendarPicker />', () => {
  it('labels month navigation and keeps both controls at a 44px target', () => {
    const screen = render(
      <I18nProvider defaultLocale="uz">
        <MonthCalendarPicker
          visible
          value="2026-07-27"
          onClose={jest.fn()}
          onConfirm={jest.fn()}
        />
      </I18nProvider>
    )

    const previous = screen.getByLabelText('Oldingi oy')
    const next = screen.getByLabelText('Keyingi oy')

    expect(previous).toHaveStyle({ width: 44, height: 44 })
    expect(next).toHaveStyle({ width: 44, height: 44 })
  })
})
