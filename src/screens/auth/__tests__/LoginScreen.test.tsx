import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { Animated } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '../../../i18n'
import LoginScreen from '../LoginScreen'

const mockNavigate = jest.fn()

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: undefined }),
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
        <LoginScreen />
      </I18nProvider>
    </QueryClientProvider>
  )
}

describe('LoginScreen', () => {
  let timingSpy: jest.SpyInstance

  beforeAll(() => {
    timingSpy = jest.spyOn(Animated, 'timing').mockReturnValue({ start: jest.fn() } as never)
  })

  afterAll(() => timingSpy.mockRestore())

  beforeEach(() => mockNavigate.mockClear())

  it('exposes labeled fields and announces required errors', () => {
    const screen = renderScreen()

    expect(screen.getByLabelText('Email')).toBeTruthy()
    expect(screen.getByLabelText('Parol')).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'Eslab qol' })).toHaveAccessibilityState({
      checked: true,
    })

    fireEvent.press(screen.getByRole('button', { name: 'Kirish' }))

    expect(screen.getByRole('alert', { name: 'Email manzilni kiriting' })).toBeTruthy()
    expect(screen.getByRole('alert', { name: 'Parolni kiriting' })).toBeTruthy()
    expect(screen.queryByText('Google bilan davom etish')).toBeNull()
  })

  it('opens the registration screen from the sign-up link', () => {
    const screen = renderScreen()
    fireEvent.press(screen.getByRole('link', { name: "Ro'yxatdan o'ting" }))
    expect(mockNavigate).toHaveBeenCalledWith('Register')
  })
})
