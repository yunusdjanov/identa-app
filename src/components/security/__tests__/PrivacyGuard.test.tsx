import React from 'react'
import { act, render } from '@testing-library/react-native'
import { AppState, Text } from 'react-native'

import PrivacyGuard from '../PrivacyGuard'
import { useAuthStore } from '../../../stores/auth'

jest.mock('expo-screen-capture', () => ({
  usePreventScreenCapture: jest.fn(),
  enableAppSwitcherProtectionAsync: jest.fn().mockResolvedValue(undefined),
  disableAppSwitcherProtectionAsync: jest.fn().mockResolvedValue(undefined),
}))

describe('<PrivacyGuard />', () => {
  let appStateListener: ((state: 'active' | 'background' | 'inactive') => void) | null

  beforeEach(() => {
    appStateListener = null
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener: any) => {
      appStateListener = listener
      return { remove: jest.fn() } as any
    })
    useAuthStore.setState({
      user: {
        id: 'dentist-1',
        name: 'Dentist',
        email: 'dentist@example.test',
        role: 'dentist',
        account_status: 'active',
      },
      isAuthenticated: true,
      isHydrating: false,
    } as any)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    act(() => {
      useAuthStore.setState({
        user: null,
        tokens: null,
        isAuthenticated: false,
        isHydrating: false,
      })
    })
  })

  it('covers authenticated clinical content as soon as the app backgrounds', () => {
    const screen = render(
      <PrivacyGuard>
        <Text>Patient record</Text>
      </PrivacyGuard>
    )

    expect(screen.queryByTestId('privacy-curtain')).toBeNull()
    act(() => appStateListener?.('background'))
    expect(screen.UNSAFE_getByProps({ testID: 'privacy-curtain' })).toBeTruthy()
    act(() => appStateListener?.('active'))
    expect(screen.queryByTestId('privacy-curtain')).toBeNull()
  })

  it('does not show the clinical privacy curtain before authentication', () => {
    useAuthStore.setState({ user: null, isAuthenticated: false })
    const screen = render(
      <PrivacyGuard>
        <Text>Login</Text>
      </PrivacyGuard>
    )

    act(() => appStateListener?.('background'))
    expect(screen.queryByTestId('privacy-curtain')).toBeNull()
  })
})
