import React from 'react'
import { Text } from 'react-native'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '../../../i18n'
import { useAuthStore } from '../../../stores/auth'
import { useUIStore } from '../../../stores/ui'
import type { ApiUser, DashboardSnapshot } from '../../../types'
import DashboardScreen from '../DashboardScreen'
import { getDashboardSnapshot } from '../../../api/dashboard'

const mockNavigate = jest.fn()

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock('../../../api/dashboard', () => ({
  getDashboardSnapshot: jest.fn(),
}))

jest.mock('../../../api/appointments', () => ({
  updateAppointmentStatus: jest.fn(),
}))

jest.mock('../../../components/ui/Toast', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  }),
}))

jest.mock('../../../components/dashboard/DashboardHeader', () => {
  const React = require('react')
  const { View } = require('react-native')
  return () => React.createElement(View, { testID: 'dashboard-header' })
})

jest.mock('../../../components/dashboard/EmailVerificationBanner', () => () => null)

jest.mock('../../../components/dashboard/TodayHeroCard', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return (props: { totalCount: number; remainingCount: number }) =>
    React.createElement(
      Text,
      { testID: 'today-count' },
      `${props.remainingCount}/${props.totalCount}`
    )
})

jest.mock('../../../components/dashboard/AppointmentRow', () => {
  const React = require('react')
  const { Pressable, Text } = require('react-native')
  return (props: {
    appointment: { id: string; patient_name: string }
    overdue?: boolean
    onPress?: () => void
  }) => React.createElement(
    Pressable,
    {
      accessibilityRole: 'button',
      accessibilityLabel: `open-${props.appointment.id}`,
      onPress: props.onPress,
      testID: props.overdue ? `overdue-${props.appointment.id}` : `upcoming-${props.appointment.id}`,
    },
    React.createElement(Text, null, props.appointment.patient_name)
  )
})

jest.mock('../../../components/ui/SwipeableRow', () => {
  const React = require('react')
  return (props: { children: React.ReactNode }) => props.children
})

const dentist: ApiUser = {
  id: 'dentist-1',
  name: 'Test Dentist',
  email: 'dentist@example.test',
  role: 'dentist',
  account_status: 'active',
  email_verified_at: '2026-07-01T00:00:00Z',
}

const noPermissionAssistant: ApiUser = {
  id: 'assistant-1',
  name: 'Test Assistant',
  email: 'assistant@example.test',
  role: 'assistant',
  account_status: 'active',
  assistant_permissions: [],
  email_verified_at: '2026-07-01T00:00:00Z',
}

function snapshot(overrides: Partial<DashboardSnapshot> = {}): DashboardSnapshot {
  return {
    date: '2026-07-14',
    working_hours_end: '18:00',
    revenue_this_month: 100000,
    outstanding_debt_total: 25000,
    financials_by_currency: {
      UZS: { revenue_this_month: 100000, outstanding_debt_total: 25000 },
      USD: { revenue_this_month: 0, outstanding_debt_total: 0 },
    },
    today_appointments: [],
    ...overrides,
  }
}

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider defaultLocale="uz">
        <DashboardScreen />
      </I18nProvider>
    </QueryClientProvider>
  )
}

describe('DashboardScreen', () => {
  const mockGetDashboardSnapshot = jest.mocked(getDashboardSnapshot)

  beforeEach(() => {
    jest.clearAllMocks()
    useUIStore.setState({
      pendingAppointmentsViewDate: null,
      pendingAppointmentsViewId: null,
    })
    useAuthStore.setState({ user: dentist, isAuthenticated: true, isHydrating: false })
  })

  it('shows a permission-specific empty state without requesting private data', () => {
    useAuthStore.setState({ user: noPermissionAssistant })

    const screen = renderScreen()

    expect(screen.getByText("Sizda bu bo'limga kirish huquqi yo'q")).toBeTruthy()
    expect(mockGetDashboardSnapshot).not.toHaveBeenCalled()
  })

  it('shows the completed state when every appointment is completed', async () => {
    mockGetDashboardSnapshot.mockResolvedValue(
      snapshot({
        today_appointments: [
          {
            id: 'apt-1',
            patient_name: 'Ali Testov',
            appointment_date: '2026-07-14',
            start_time: '09:00',
            duration_minutes: 30,
            status: 'completed',
          },
        ],
      })
    )

    const screen = renderScreen()

    expect(await screen.findByText('Bugungi barcha navbatlar yakunlangan')).toBeTruthy()
    expect(screen.getByTestId('today-count').props.children).toBe('0/1')
  })

  it('selects tomorrow before opening the appointments tab', async () => {
    mockGetDashboardSnapshot.mockResolvedValue(
      snapshot({
        working_hours_end: '00:00',
        today_appointments: [
          {
            id: 'apt-2',
            patient_name: 'Vali Testov',
            appointment_date: '2026-07-14',
            start_time: '10:00',
            duration_minutes: 30,
            status: 'cancelled',
          },
        ],
      })
    )

    const screen = renderScreen()
    const tomorrowButton = await screen.findByRole('button', { name: "Ertangi kunni ko'rish" })
    fireEvent.press(tomorrowButton)

    expect(useUIStore.getState().pendingAppointmentsViewDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(mockNavigate).toHaveBeenCalledWith('Dashboard')
  })

  it('does not render payment cards even when the dashboard API returns finance data', async () => {
    mockGetDashboardSnapshot.mockResolvedValue(
      snapshot({
        financials_by_currency: {
          UZS: { revenue_this_month: 100000, outstanding_debt_total: 25000 },
          USD: { revenue_this_month: 40, outstanding_debt_total: 15 },
        },
      })
    )

    const screen = renderScreen()

    await waitFor(() => expect(screen.getByTestId('today-count').props.children).toBe('0/0'))
    expect(screen.queryByTestId('finance-summary')).toBeNull()
  })

  it('separates expired scheduled slots into the overdue section', async () => {
    mockGetDashboardSnapshot.mockResolvedValue(
      snapshot({
        today_appointments: [
          {
            id: 'apt-overdue',
            patient_name: 'Overdue Patient',
            appointment_date: '2026-07-15',
            start_time: '00:00',
            duration_minutes: 0,
            status: 'scheduled',
          },
        ],
      })
    )

    const screen = renderScreen()

    expect(await screen.findByText("E'tibor talab qiladi")).toBeTruthy()
    expect(screen.getByTestId('overdue-apt-overdue')).toBeTruthy()
    expect(screen.getByTestId('today-count').props.children).toBe('1/1')
  })

  it('routes a selected dashboard appointment to its detail request', async () => {
    mockGetDashboardSnapshot.mockResolvedValue(
      snapshot({
        today_appointments: [
          {
            id: 'apt-future',
            patient_name: 'Future Patient',
            appointment_date: '2026-07-15',
            start_time: '23:59',
            duration_minutes: 60,
            status: 'scheduled',
          },
        ],
      })
    )

    const screen = renderScreen()
    fireEvent.press(await screen.findByRole('button', { name: 'open-apt-future' }))

    expect(useUIStore.getState()).toMatchObject({
      pendingAppointmentsViewDate: '2026-07-15',
      pendingAppointmentsViewId: 'apt-future',
    })
    expect(mockNavigate).toHaveBeenCalledWith('Dashboard')
  })
})
