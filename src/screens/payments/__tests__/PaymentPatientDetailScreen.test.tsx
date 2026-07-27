import React from 'react'
import { Linking } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import PaymentPatientDetailScreen from '../PaymentPatientDetailScreen'
import PaymentLedgerTreatmentRow from '../../../components/payments/PaymentLedgerTreatmentRow'
import { I18nProvider } from '../../../i18n'
import {
  listPaymentLedgerHistory,
  listPaymentLedgerPatients,
} from '../../../api/payments'
import { useAuthStore } from '../../../stores/auth'
import { useNetworkStore } from '../../../stores/network'
import { exportPaymentLedgerPdf } from '../../../lib/paymentLedgerExport'

const mockGoBack = jest.fn()

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({ params: { id: 'patient-1' } }),
}))

jest.mock('../../../api/payments', () => ({
  listPaymentLedgerPatients: jest.fn(),
  listPaymentLedgerHistory: jest.fn(),
}))

jest.mock('../../../components/ui/Toast', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
  }),
}))

jest.mock('../../../lib/paymentLedgerExport', () => ({
  exportPaymentLedgerPdf: jest.fn(),
  loadPatientLedgerForExport: jest.fn(),
}))

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, right: 0, bottom: 34, left: 0 },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <I18nProvider defaultLocale="uz">
          <PaymentPatientDetailScreen />
        </I18nProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}

describe('<PaymentPatientDetailScreen />', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState({
      user: {
        id: 'dentist-1',
        name: 'Dentist',
        email: 'dentist@example.test',
        role: 'dentist',
        account_status: 'active',
        subscription: {
          is_configured: true,
          plan: 'pro',
          status: 'active',
          access_mode: 'full',
          days_remaining: 30,
          staff_limit: 5,
          active_staff_count: 1,
          can_export: true,
        },
      },
      isAuthenticated: true,
      isHydrating: false,
      tokens: undefined,
    })
    useNetworkStore.setState({ isOnline: true })
    jest.mocked(listPaymentLedgerPatients).mockResolvedValue({
      data: [{
        patient_id: 'patient-1',
        patient_code: 'P-1',
        patient_name: 'Ali Karimov',
        patient_phone: '+998901234567',
        patient_secondary_phone: null,
        patient_address: 'Toshkent',
        patient_date_of_birth: '1990-02-18',
        total_debt: 1_000_000,
        total_paid: 600_000,
        balance: 400_000,
        balances_by_currency: {
          UZS: {
            total_debt: 1_000_000,
            total_paid: 600_000,
            balance: 400_000,
          },
          USD: { total_debt: 0, total_paid: 0, balance: 0 },
        },
        entry_count: 1,
      }],
      meta: {
        pagination: { page: 1, total_pages: 1, per_page: 1, total: 1 },
        summary: {
          total_debt: 1_000_000,
          total_paid: 600_000,
          total_balance: 400_000,
          total_patients: 1,
          total_entries: 1,
          totals_by_currency: {
            UZS: {
              total_debt: 1_000_000,
              total_paid: 600_000,
              total_balance: 400_000,
            },
            USD: { total_debt: 0, total_paid: 0, total_balance: 0 },
          },
        },
      },
    })
    jest.mocked(listPaymentLedgerHistory).mockResolvedValue({
      data: [
        {
          id: 'treatment-1',
          patient_id: 'patient-1',
          work_done: 'Implantatsiya',
          date: '2026-07-15',
          debt: 1_000_000,
          paid: 600_000,
          balance_delta: 400_000,
          currency: 'UZS',
        },
      ],
      meta: {
        pagination: { page: 1, total_pages: 1, per_page: 20, total: 1 },
        summary: {
          total_debt: 1_000_000,
          total_paid: 600_000,
          total_balance: 400_000,
          total_patients: 1,
          total_entries: 1,
          totals_by_currency: {
            UZS: {
              total_debt: 1_000_000,
              total_paid: 600_000,
              total_balance: 400_000,
            },
            USD: { total_debt: 0, total_paid: 0, total_balance: 0 },
          },
        },
      },
    })
  })

  it('loads the patient identity and a paginated finance-only ledger', async () => {
    const screen = renderScreen()

    expect(await screen.findByText('Ali Karimov')).toBeTruthy()
    expect(screen.getByText('+998 90 123 45 67')).toBeTruthy()
    expect(screen.getByText('Toshkent')).toBeTruthy()
    expect(screen.getByText('Hisob-kitoblar')).toBeTruthy()
    expect(screen.getByText('Implantatsiya')).toBeTruthy()
    expect(screen.UNSAFE_getByType(PaymentLedgerTreatmentRow)).toBeTruthy()
    expect(screen.queryByText('Davolanish tarixi')).toBeNull()
    expect(listPaymentLedgerPatients).toHaveBeenCalledWith({
      patient_id: 'patient-1',
      page: 1,
      per_page: 1,
    })
    expect(listPaymentLedgerHistory).toHaveBeenCalledWith({
      patient_id: 'patient-1',
      page: 1,
      per_page: 20,
    })
  })

  it('allows a payments-only assistant without clinical patient access', async () => {
    useAuthStore.setState((state) => ({
      ...state,
      user: {
        id: 'assistant-1',
        name: 'Finance assistant',
        email: 'finance@example.test',
        role: 'assistant',
        account_status: 'active',
        assistant_permissions: ['payments.view'],
      },
    }))

    const screen = renderScreen()

    expect(await screen.findByText('Ali Karimov')).toBeTruthy()
    expect(screen.queryByText("Ruxsat yo'q")).toBeNull()
  })

  it('opens compact call and Telegram actions for the patient number', async () => {
    const openUrl = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValue(true as never)
    const screen = renderScreen()

    await screen.findByText('Hisob-kitoblar')
    fireEvent.press(
      screen.getByLabelText("Qo'ng'iroq qilish: +998 90 123 45 67")
    )
    fireEvent.press(
      screen.getByLabelText('Telegram: +998 90 123 45 67')
    )

    expect(openUrl).toHaveBeenNthCalledWith(1, 'tel:+998901234567')
    expect(openUrl).toHaveBeenNthCalledWith(
      2,
      'https://t.me/+998901234567'
    )
  })

  it('exports the complete loaded ledger from the header action', async () => {
    jest.mocked(exportPaymentLedgerPdf).mockResolvedValue(undefined)
    const screen = renderScreen()

    await screen.findByText('Implantatsiya')
    fireEvent.press(
      screen.getByLabelText('Hisob-kitobni PDF qilish')
    )

    await waitFor(() => {
      expect(exportPaymentLedgerPdf).toHaveBeenCalledWith(
        expect.objectContaining({ patient_id: 'patient-1' }),
        [expect.objectContaining({ id: 'treatment-1' })],
        'uz',
        expect.objectContaining({
          title: 'Bemor hisob-kitobi',
          work: 'Ish turi',
        })
      )
    })
  })
})
