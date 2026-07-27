import React from 'react'
import { Animated } from 'react-native'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { I18nProvider } from '../../../i18n'
import { requestPasswordReset } from '../../../api/auth'
import ForgotPasswordScreen from '../ForgotPasswordScreen'

const mockGoBack = jest.fn()
const mockToastSuccess = jest.fn()

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
}))

jest.mock('../../../api/auth', () => ({
  requestPasswordReset: jest.fn(),
}))

jest.mock('../../../components/ui/Toast', () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  }),
}))

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider defaultLocale="uz">
        <ForgotPasswordScreen />
      </I18nProvider>
    </QueryClientProvider>
  )
}

describe('ForgotPasswordScreen', () => {
  let timingSpy: jest.SpyInstance

  beforeAll(() => {
    timingSpy = jest.spyOn(Animated, 'timing').mockReturnValue({ start: jest.fn() } as never)
  })

  afterAll(() => timingSpy.mockRestore())

  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(requestPasswordReset).mockResolvedValue(undefined)
  })

  it('validates email and exposes the language switcher', () => {
    const screen = renderScreen()

    expect(screen.getByLabelText('Til tanlang')).toBeTruthy()
    expect(screen.getByLabelText('Email')).toBeTruthy()

    fireEvent.press(screen.getByRole('button', { name: 'Havola yuborish' }))

    expect(screen.getByRole('alert', { name: 'Email manzilni kiriting' })).toBeTruthy()
    expect(requestPasswordReset).not.toHaveBeenCalled()
  })

  it('keeps the confirmation visible instead of navigating away', async () => {
    const screen = renderScreen()

    fireEvent.changeText(screen.getByLabelText('Email'), 'doctor@example.com')
    fireEvent.press(screen.getByRole('button', { name: 'Havola yuborish' }))

    await waitFor(() => {
      expect(requestPasswordReset).toHaveBeenCalledWith('doctor@example.com')
      expect(screen.getByText('Havola kelmasa, spam papkasini tekshiring yoki qayta yuboring.')).toBeTruthy()
    })
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Havola yuborildi. Email pochtangizni tekshiring.'
    )
    expect(mockGoBack).not.toHaveBeenCalled()
  })
})
