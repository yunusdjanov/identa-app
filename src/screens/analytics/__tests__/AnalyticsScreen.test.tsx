import React from 'react'
import { RefreshControl, StyleSheet } from 'react-native'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { I18nProvider } from '../../../i18n'
import { getAnalyticsSummary } from '../../../api/analytics'
import { exportAnalyticsPdf } from '../../../lib/analyticsExport'
import { useAuthStore } from '../../../stores/auth'
import type { ApiAnalyticsSummary, ApiUser } from '../../../types'
import AnalyticsScreen from '../AnalyticsScreen'

const mockGoBack = jest.fn()
const mockNavigate = jest.fn()

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
    navigate: mockNavigate,
    canGoBack: () => false,
  }),
  useFocusEffect: (callback: () => void) => callback(),
}))

jest.mock('../../../api/analytics', () => ({
  getAnalyticsSummary: jest.fn(),
}))

jest.mock('../../../components/ui/Sparkline', () => () => null)
jest.mock('../../../components/ui/Skeleton', () => ({
  Skeleton: () => null,
}))

jest.mock('../../../components/ui/Toast', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  }),
}))

jest.mock('../../../lib/analyticsExport', () => ({
  exportAnalyticsPdf: jest.fn(),
}))

const dentist: ApiUser = {
  id: 'dentist-1',
  name: 'Doctor',
  email: 'doctor@example.com',
  role: 'dentist',
  account_status: 'active',
}

function summary(overrides: Partial<ApiAnalyticsSummary> = {}): ApiAnalyticsSummary {
  return {
    currency: 'UZS',
    permissions: { payments: true, patients: true, appointments: true },
    kpis: {
      revenue: { current: 125000, previous: 50000 },
      debt: { current: 30000, previous: null },
      patients: { current: 4, previous: 2 },
      visits: { current: 9, previous: 6 },
    },
    buckets: [
      {
        key: '2026-06',
        revenue: 50000,
        debt: 0,
        new_patients: 2,
        cumulative_patients: 2,
      },
      {
        key: '2026-07',
        revenue: 75000,
        debt: 30000,
        new_patients: 2,
        cumulative_patients: 4,
      },
    ],
    appointment_status: [
      { status: 'scheduled', count: 1 },
      { status: 'completed', count: 7 },
      { status: 'cancelled', count: 1 },
      { status: 'no_show', count: 0 },
    ],
    top_debtors: [{ name: 'Test Patient', phone: '+99890', debt: 30000 }],
    ...overrides,
  }
}

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 44, left: 0, right: 0, bottom: 34 },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <I18nProvider defaultLocale="uz">
          <AnalyticsScreen />
        </I18nProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}

describe('AnalyticsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState({ user: dentist, isAuthenticated: true } as never)
    jest.mocked(getAnalyticsSummary).mockResolvedValue(summary())
    jest.mocked(exportAnalyticsPdf).mockResolvedValue(undefined)
  })

  it('uses the server summary, currency and web-compatible visits KPI', async () => {
    const screen = renderScreen()

    await waitFor(() => expect(screen.getByText('Tashriflar')).toBeTruthy())
    expect(screen.getByLabelText(/^Tashriflar: 9\./)).toBeTruthy()
    expect(getAnalyticsSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        range: '180d',
        current_from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        current_to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        previous_from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        previous_to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        currency: 'UZS',
      })
    )
  })

  it('intersects cached permissions with authoritative server permissions', async () => {
    jest.mocked(getAnalyticsSummary).mockResolvedValue(
      summary({ permissions: { payments: false, patients: true, appointments: false } })
    )

    const screen = renderScreen()
    await waitFor(() => expect(screen.getByText('Yangi bemorlar')).toBeTruthy())

    expect(screen.queryByText('Tushum')).toBeNull()
    expect(screen.queryByText('Qarzdorlik')).toBeNull()
    expect(screen.queryByText('Tashriflar')).toBeNull()
    expect(screen.queryByText('Qabullar holati')).toBeNull()
  })

  it('offers a working retry action after an API failure', async () => {
    jest.mocked(getAnalyticsSummary).mockRejectedValueOnce(new Error('boom'))
    const screen = renderScreen()

    await waitFor(() => expect(screen.getByText('Analitika yuklanmadi')).toBeTruthy())
    fireEvent.press(screen.getByRole('button', { name: 'Qayta urinish' }))

    await waitFor(() => expect(getAnalyticsSummary).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByText('Tashriflar')).toBeTruthy())
  })

  it('switches between the same UZS and USD contract as web analytics', async () => {
    jest.mocked(getAnalyticsSummary).mockImplementation(async (params) =>
      params.currency === 'USD'
        ? summary({
            currency: 'USD',
            kpis: {
              revenue: { current: 25.5, previous: 10 },
              debt: { current: 8.25, previous: null },
              patients: { current: 4, previous: 2 },
              visits: { current: 9, previous: 6 },
            },
            top_debtors: [{ name: 'USD Patient', phone: '+99891', debt: 8.25 }],
          })
        : summary()
    )
    const screen = renderScreen()
    await waitFor(() => expect(screen.getByText('Test Patient')).toBeTruthy())

    fireEvent.press(screen.getByRole('radio', { name: 'USD' }))

    await waitFor(() =>
      expect(getAnalyticsSummary).toHaveBeenLastCalledWith(
        expect.objectContaining({ currency: 'USD' })
      )
    )
    await waitFor(() => expect(screen.getByText('USD Patient')).toBeTruthy())
  })

  it('keeps the final debtor above the floating bottom navigation', async () => {
    const screen = renderScreen()
    await waitFor(() => expect(screen.getByText('Test Patient')).toBeTruthy())

    const contentStyle = StyleSheet.flatten(
      screen.getByTestId('analytics-scroll').props.contentContainerStyle
    )
    expect(contentStyle.paddingBottom).toBe(110)
  })

  it('does not present a filter refetch as pull-to-refresh', async () => {
    let finishRangeRequest: ((value: ApiAnalyticsSummary) => void) | undefined
    jest.mocked(getAnalyticsSummary)
      .mockResolvedValueOnce(summary())
      .mockImplementationOnce(
        () =>
          new Promise<ApiAnalyticsSummary>((resolve) => {
            finishRangeRequest = resolve
          })
      )

    const screen = renderScreen()
    await waitFor(() => expect(screen.getByText('Test Patient')).toBeTruthy())
    fireEvent.press(screen.getByRole('radio', { name: '30 kun' }))
    await waitFor(() => expect(getAnalyticsSummary).toHaveBeenCalledTimes(2))

    expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false)
    expect(screen.getByText('Test Patient')).toBeTruthy()

    await act(async () => {
      finishRangeRequest?.(summary())
    })
  })

  it('exports the exact loaded currency summary when export is entitled', async () => {
    useAuthStore.setState({
      user: {
        ...dentist,
        subscription: {
          is_configured: true,
          plan: 'pro',
          status: 'active',
          access_mode: 'full',
          days_remaining: 30,
          staff_limit: 3,
          active_staff_count: 1,
          can_export: true,
        },
      },
    } as never)
    const data = summary({ currency: 'USD' })
    jest.mocked(getAnalyticsSummary).mockResolvedValue(data)
    const screen = renderScreen()

    const exportButton = await screen.findByRole('button', { name: 'PDF eksport' })
    await waitFor(() => expect(exportButton).toHaveAccessibilityState({ disabled: false }))
    fireEvent.press(exportButton)

    await waitFor(() => {
      expect(exportAnalyticsPdf).toHaveBeenCalledWith(
        data,
        '6 oy',
        'uz',
        expect.objectContaining({ title: 'Analitika hisoboti' })
      )
    })
  })

  it('opens the payments tab with the outstanding filter from all debts', async () => {
    const screen = renderScreen()
    const button = await screen.findByRole('button', { name: 'Barcha qarzlar' })
    fireEvent.press(button)

    expect(mockNavigate).toHaveBeenCalledWith('Tabs', {
      screen: 'Payments',
      params: {
        outstandingOnly: true,
        requestId: expect.any(Number),
      },
    })
  })
})
