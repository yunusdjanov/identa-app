import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { I18nProvider } from '../../../i18n'
import { getCurrentUser } from '../../../api/auth'
import { getProfile, updateProfile, type ApiProfile } from '../../../api/profile'
import { useAuthStore } from '../../../stores/auth'
import type { ApiUser } from '../../../types'
import ProfileEditSheet from '../ProfileEditSheet'

jest.mock('../../ui/BottomSheet', () => ({
  __esModule: true,
  default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => {
    const { View } = require('react-native')
    return visible ? <View>{children}</View> : null
  },
}))

jest.mock('../../ui/InputCard', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const ReactModule = require('react')
    const { TextInput } = require('react-native')
    return ReactModule.createElement(TextInput, props)
  },
}))

jest.mock('../../../api/profile', () => ({
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
}))

jest.mock('../../../api/auth', () => ({
  getCurrentUser: jest.fn(),
}))

jest.mock('../../ui/Toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn() }),
}))

jest.mock('../../ui/Dialog', () => ({
  useDialog: () => ({ confirm: jest.fn().mockResolvedValue(true) }),
}))

const profile: ApiProfile = {
  id: 'dentist-1',
  name: 'Dentist',
  email: 'old@example.com',
  phone: '+998901112233',
  practice_name: 'Practice',
  license_number: 'L-1',
  address: 'Tashkent',
  working_hours: { start: '09:00', end: '18:00' },
  default_appointment_duration: 30,
}

const user: ApiUser = {
  id: 'dentist-1',
  name: 'Dentist',
  email: 'old@example.com',
  email_verified_at: '2026-07-01T00:00:00Z',
  role: 'dentist',
  account_status: 'active',
}

function renderSheet() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider defaultLocale="uz">
        <ProfileEditSheet visible onClose={jest.fn()} />
      </I18nProvider>
    </QueryClientProvider>
  )
}

describe('ProfileEditSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState({
      user,
      isAuthenticated: true,
      isHydrating: false,
    } as never)
    jest.mocked(getProfile).mockResolvedValue(profile)
    jest.mocked(updateProfile).mockImplementation(async (payload) => ({
      ...profile,
      ...payload,
      email: payload.email ?? profile.email,
    }))
    jest.mocked(getCurrentUser).mockResolvedValue({
      ...user,
      email: 'new@example.com',
      email_verified_at: undefined,
    })
  })

  it('clears stale verification state and refreshes the server user after email change', async () => {
    const screen = renderSheet()
    const emailInput = await screen.findByPlaceholderText('you@example.com')

    fireEvent.changeText(emailInput, 'new@example.com')
    fireEvent.press(screen.getByLabelText('Saqlash'))

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({
      email: 'new@example.com',
    })))
    await waitFor(() => expect(getCurrentUser).toHaveBeenCalledTimes(1))

    expect(useAuthStore.getState().user).toMatchObject({
      email: 'new@example.com',
      email_verified_at: undefined,
    })
  })

  it('does not restore a profile response after the session has logged out', async () => {
    let resolveCurrentUser!: (value: ApiUser) => void
    jest.mocked(getCurrentUser).mockReturnValue(new Promise((resolve) => {
      resolveCurrentUser = resolve
    }))
    const screen = renderSheet()
    const emailInput = await screen.findByPlaceholderText('you@example.com')

    fireEvent.changeText(emailInput, 'new@example.com')
    fireEvent.press(screen.getByLabelText('Saqlash'))
    await waitFor(() => expect(getCurrentUser).toHaveBeenCalledTimes(1))

    act(() => {
      useAuthStore.getState().logout()
      resolveCurrentUser({
        ...user,
        email: 'new@example.com',
        email_verified_at: undefined,
      })
    })
    await act(async () => {
      await Promise.resolve()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().user).toBeNull()
  })
})
