import React from 'react'
import { Animated } from 'react-native'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { I18nProvider } from '../../../i18n'
import { resetPassword } from '../../../api/auth'
import ResetPasswordScreen from '../ResetPasswordScreen'

const mockReset = jest.fn()
let mockRouteParams: { token?: string; email?: string } = {}

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ reset: mockReset }),
  useRoute: () => ({ params: mockRouteParams }),
}))

jest.mock('../../../api/auth', () => ({
  resetPassword: jest.fn(),
}))

jest.mock('../../../components/ui/Toast', () => ({
  useToast: () => ({
    success: jest.fn(),
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
        <ResetPasswordScreen />
      </I18nProvider>
    </QueryClientProvider>
  )
}

describe('ResetPasswordScreen', () => {
  let timingSpy: jest.SpyInstance

  beforeAll(() => {
    timingSpy = jest.spyOn(Animated, 'timing').mockReturnValue({ start: jest.fn() } as never)
  })

  afterAll(() => timingSpy.mockRestore())

  beforeEach(() => {
    jest.clearAllMocks()
    mockRouteParams = { token: 'reset-token', email: 'wrong-email' }
    jest.mocked(resetPassword).mockResolvedValue(undefined)
  })

  it('allows a malformed deep-link email to be corrected', async () => {
    const screen = renderScreen()

    expect(screen.getByLabelText('Til tanlang')).toBeTruthy()
    expect(screen.getByLabelText('Email').props.value).toBe('wrong-email')

    fireEvent.changeText(screen.getByLabelText('Email'), ' doctor@example.com ')
    fireEvent.changeText(screen.getByLabelText('Yangi parol'), 'Strongpass1')
    fireEvent.changeText(screen.getByLabelText('Parolni tasdiqlang'), 'Strongpass1')
    fireEvent.press(screen.getByRole('button', { name: 'Parolni yangilash' }))

    await waitFor(() => {
      expect(resetPassword).toHaveBeenCalledWith(
        'reset-token',
        'doctor@example.com',
        'Strongpass1',
        'Strongpass1'
      )
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Login', params: { initialEmail: 'doctor@example.com' } }],
      })
    })
  })

  it('requires email, a valid password, and password confirmation', () => {
    mockRouteParams = { token: 'reset-token' }
    const screen = renderScreen()

    fireEvent.press(screen.getByRole('button', { name: 'Parolni yangilash' }))

    expect(screen.getByRole('alert', { name: 'Email manzilni kiriting' })).toBeTruthy()
    expect(screen.getByRole('alert', { name: 'Parolni kiriting' })).toBeTruthy()
    expect(screen.getByRole('alert', { name: 'Parolni tasdiqlang' })).toBeTruthy()
    expect(resetPassword).not.toHaveBeenCalled()
  })
})
