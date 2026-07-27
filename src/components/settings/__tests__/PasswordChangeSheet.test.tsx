import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { I18nProvider } from '../../../i18n'
import { changeCurrentPassword } from '../../../api/auth'
import { useAuthStore } from '../../../stores/auth'
import type { ApiUser } from '../../../types'
import PasswordChangeSheet from '../PasswordChangeSheet'

jest.mock('../../ui/BottomSheet', () => ({
  __esModule: true,
  default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => {
    const { View } = require('react-native')
    return visible ? <View>{children}</View> : null
  },
}))

jest.mock('../../ui/InputCard', () => ({
  __esModule: true,
  default: ({ rightAccessory, errorMessage, ...props }: Record<string, unknown>) => {
    const React = require('react')
    const { Text, TextInput, View } = require('react-native')
    return React.createElement(
      View,
      null,
      React.createElement(TextInput, props),
      rightAccessory,
      errorMessage ? React.createElement(Text, null, errorMessage) : null
    )
  },
}))

jest.mock('../../../api/auth', () => ({
  changeCurrentPassword: jest.fn(),
}))

jest.mock('../../ui/Toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn() }),
}))

const forcedUser: ApiUser = {
  id: 'assistant-1',
  name: 'Assistant',
  email: 'assistant@example.com',
  role: 'assistant',
  account_status: 'active',
  has_password: true,
  must_change_password: true,
}

function renderSheet(onClose = jest.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return {
    onClose,
    screen: render(
      <QueryClientProvider client={queryClient}>
        <I18nProvider defaultLocale="uz">
          <PasswordChangeSheet visible onClose={onClose} />
        </I18nProvider>
      </QueryClientProvider>
    ),
  }
}

describe('PasswordChangeSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState({ user: forcedUser, isAuthenticated: true } as never)
  })

  it('clears the forced-rotation flag after a valid password change', async () => {
    jest.mocked(changeCurrentPassword).mockResolvedValue({
      ...forcedUser,
      has_password: true,
      must_change_password: false,
    })
    const { screen, onClose } = renderSheet()

    expect(screen.queryByPlaceholderText('Joriy parolingiz')).toBeNull()
    fireEvent.changeText(screen.getByPlaceholderText('Yangi parol (min 8 belgi)'), 'Secure123')
    fireEvent.changeText(screen.getByPlaceholderText('Parolni qaytadan kiriting'), 'Secure123')
    fireEvent.press(screen.getByText("O'zgartirish"))

    await waitFor(() => expect(changeCurrentPassword).toHaveBeenCalledWith({
      current_password: undefined,
      new_password: 'Secure123',
      new_password_confirmation: 'Secure123',
    }))
    await waitFor(() => expect(useAuthStore.getState().user?.must_change_password).toBe(false))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not submit a password that lacks a number', () => {
    const { screen } = renderSheet()

    fireEvent.changeText(screen.getByPlaceholderText('Yangi parol (min 8 belgi)'), 'abcdefgh')
    fireEvent.changeText(screen.getByPlaceholderText('Parolni qaytadan kiriting'), 'abcdefgh')
    fireEvent.press(screen.getByText("O'zgartirish"))

    expect(changeCurrentPassword).not.toHaveBeenCalled()
  })

  it('labels password visibility controls for screen readers', () => {
    const { screen } = renderSheet()

    const controls = screen.getAllByLabelText("Ko'rsatish")
    expect(controls).toHaveLength(2)
    fireEvent.press(controls[0]!)
    expect(screen.getByLabelText('Yashirish')).toBeTruthy()
  })
})
