import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { Animated } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '../../../i18n'
import RegisterScreen from '../RegisterScreen'

const mockGoBack = jest.fn()
const mockNavigate = jest.fn()
const mockReplace = jest.fn()

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
    navigate: mockNavigate,
    replace: mockReplace,
  }),
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
        <RegisterScreen />
      </I18nProvider>
    </QueryClientProvider>
  )
}

describe('RegisterScreen', () => {
  let timingSpy: jest.SpyInstance

  beforeAll(() => {
    timingSpy = jest.spyOn(Animated, 'timing').mockReturnValue({ start: jest.fn() } as never)
  })

  afterAll(() => timingSpy.mockRestore())

  beforeEach(() => {
    mockGoBack.mockClear()
    mockNavigate.mockClear()
    mockReplace.mockClear()
  })

  it('labels every field and announces all client-side requirements', () => {
    const screen = renderScreen()

    expect(screen.getByLabelText("To'liq ism")).toBeTruthy()
    expect(screen.getByLabelText('Email')).toBeTruthy()
    expect(screen.getByLabelText('Parol')).toBeTruthy()
    expect(screen.getByLabelText('Parolni tasdiqlang')).toBeTruthy()
    expect(screen.getByRole('checkbox')).toHaveAccessibilityState({ checked: false })

    fireEvent.press(screen.getByRole('button', { name: 'Hisob yaratish' }))

    expect(screen.getByRole('alert', { name: 'Ismingizni kiriting' })).toBeTruthy()
    expect(screen.getByRole('alert', { name: 'Email manzilni kiriting' })).toBeTruthy()
    expect(screen.getByRole('alert', { name: 'Parolni kiriting' })).toBeTruthy()
    expect(screen.getByRole('alert', { name: 'Parolni tasdiqlang' })).toBeTruthy()
    expect(
      screen.getByRole('alert', { name: 'Davom etish uchun shartlarni qabul qiling' })
    ).toBeTruthy()
    expect(screen.queryByText("Google bilan ro'yxatdan o'tish")).toBeNull()
  })

  it('provides a labeled back button', () => {
    const screen = renderScreen()
    fireEvent.press(screen.getByRole('button', { name: 'Ortga' }))
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })
})
