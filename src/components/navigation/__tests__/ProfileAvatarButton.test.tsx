import React from 'react'
import { fireEvent } from '@testing-library/react-native'

import ProfileAvatarButton from '../ProfileAvatarButton'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { useAuthStore } from '../../../stores/auth'

const mockNavigate = jest.fn()

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}))

describe('ProfileAvatarButton', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    useAuthStore.setState({
      user: {
        id: 'dentist-1',
        name: 'Aziz Karimov',
        email: 'aziz@example.test',
        role: 'dentist',
        account_status: 'active',
      },
      isAuthenticated: true,
      isHydrating: false,
    })
  })

  it('shows the user initial and opens settings', () => {
    const screen = renderWithProviders(<ProfileAvatarButton />)

    expect(screen.getByText('A')).toBeTruthy()
    fireEvent.press(screen.getByLabelText('Sozlamalar'))
    expect(mockNavigate).toHaveBeenCalledWith('Settings')
  })
})
