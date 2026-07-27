import React from 'react'

import DashboardHeader from '../DashboardHeader'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { useAuthStore } from '../../../stores/auth'

const mockNavigate = jest.fn()

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}))

describe('DashboardHeader', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    useAuthStore.setState({
      user: {
        id: 'dentist-1',
        name: 'Test Dentist',
        email: 'dentist@example.test',
        role: 'dentist',
        account_status: 'active',
      },
      isAuthenticated: true,
      isHydrating: false,
    })
  })

  it('does not show the analytics action in the dashboard header', () => {
    const screen = renderWithProviders(<DashboardHeader />)

    expect(screen.queryByLabelText('Analitika')).toBeNull()
    expect(screen.getByLabelText('Sozlamalar')).toBeTruthy()
    expect(screen.getByLabelText('Til tanlang')).toBeTruthy()
  })
})
