import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import PaymentsScreen from '../PaymentsScreen'
import PatientDebtRow from '../../../components/payments/PatientDebtRow'
import { I18nProvider } from '../../../i18n'
import { API_URL } from '../../../constants'
import { useAuthStore } from '../../../stores/auth'
import { useNetworkStore } from '../../../stores/network'
import {
  listPaymentExpenses,
  listPaymentLedgerPatients,
} from '../../../api/payments'
import type {
  PaymentExpense,
  PaymentLedgerSummary,
  PaymentListParams,
} from '../../../api/payments'

const mockNavigate = jest.fn()

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    canGoBack: () => false,
  }),
}))

jest.mock('../../../api/payments', () => ({
  listPaymentLedgerPatients: jest.fn(),
  listPaymentExpenses: jest.fn(),
  deletePaymentExpense: jest.fn(),
}))

jest.mock('../../../components/ui/Toast', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  }),
}))

jest.mock('../../../components/ui/Dialog', () => ({
  useDialog: () => ({ confirm: jest.fn() }),
}))

jest.mock('../../../components/payments/ExpenseFormSheet', () => () => null)

// Row entrance animations are visual-only. Replacing them here keeps native
// animation timers from outliving the screen-level assertions.
jest.mock('../../../components/ui/FadeInRow', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}))

// The segmented-control spring is already covered by the component itself.
// Keep this screen test focused on tab behavior and avoid leaving an animation
// frame queued after React Native Testing Library unmounts the screen.
jest.mock('../../../components/ui/SegmentedControl', () => ({
  __esModule: true,
  default: ({
    options,
    value,
    onChange,
  }: {
    options: Array<{ value: string; label: string }>
    value: string
    onChange: (next: string) => void
  }) => {
    const React = require('react')
    const { Pressable, Text, View } = require('react-native')

    return React.createElement(
      View,
      null,
      options.map((option) =>
        React.createElement(
          Pressable,
          {
            key: option.value,
            accessibilityRole: 'button',
            accessibilityState: { selected: option.value === value },
            onPress: () => onChange(option.value),
          },
          React.createElement(Text, null, option.label)
        )
      )
    )
  },
}))

const overallSummary: PaymentLedgerSummary = {
  total_debt: 1_000_000,
  total_paid: 400_000,
  total_balance: 600_000,
  total_patients: 1,
  total_entries: 2,
  totals_by_currency: {
    UZS: {
      total_debt: 1_000_000,
      total_paid: 400_000,
      total_balance: 600_000,
    },
    USD: {
      total_debt: 0,
      total_paid: 0,
      total_balance: 0,
    },
  },
}

const filteredSummary: PaymentLedgerSummary = {
  ...overallSummary,
  total_debt: 100,
  total_paid: 50,
  total_balance: 50,
  totals_by_currency: {
    ...overallSummary.totals_by_currency,
    UZS: {
      total_debt: 100,
      total_paid: 50,
      total_balance: 50,
    },
  },
}

function renderScreen(outstandingOnly = false) {
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
        insets: { top: 47, right: 0, bottom: 34, left: 0 },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <I18nProvider defaultLocale="uz">
          <PaymentsScreen
            route={
              outstandingOnly
                ? ({
                    key: 'payments',
                    name: 'Payments',
                    params: { outstandingOnly: true, requestId: 1 },
                  } as never)
                : undefined
            }
          />
        </I18nProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}

describe('PaymentsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState({
      user: {
        id: 'dentist-1',
        name: 'Dentist',
        email: 'dentist@example.test',
        role: 'dentist',
        account_status: 'active',
      },
      tokens: undefined,
      isAuthenticated: true,
      isHydrating: false,
    })
    useNetworkStore.setState({ isOnline: true })

    jest.mocked(listPaymentLedgerPatients).mockImplementation(
      async (params?: PaymentListParams) => {
        const filtered = Boolean(params?.search || params?.outstanding)
        return {
          data: [
            {
              patient_id: 'patient-1',
              patient_name: 'Ali Karimov',
              patient_phone: '+998901234567',
              total_debt: filtered ? 100 : 1_000_000,
              total_paid: filtered ? 50 : 400_000,
              balance: filtered ? 50 : 600_000,
              balances_by_currency: {
                UZS: {
                  total_debt: filtered ? 100 : 1_000_000,
                  total_paid: filtered ? 50 : 400_000,
                  balance: filtered ? 50 : 600_000,
                },
                USD: { total_debt: 0, total_paid: 0, balance: 0 },
              },
              entry_count: 2,
              last_entry_date: '2026-07-20',
            },
          ],
          meta: {
            pagination: {
              page: 1,
              per_page: params?.per_page ?? 20,
              total: 1,
              total_pages: 1,
            },
            summary: filtered ? filteredSummary : overallSummary,
          },
        }
      }
    )
    jest.mocked(listPaymentExpenses).mockResolvedValue({
      data: [],
      meta: {
        pagination: { page: 1, per_page: 1, total: 0, total_pages: 1 },
        summary: {
          total_count: 0,
          total_amount: 0,
          current_month_amount: 0,
          totals_by_currency: { UZS: 0, USD: 0 },
          current_month_by_currency: { UZS: 0, USD: 0 },
          latest_expense_date: null,
        },
      },
    })
  })

  it('keeps overall finance cards stable while search and debt filter change only the list', async () => {
    const screen = renderScreen()

    await waitFor(() => {
      expect(
        screen.getByLabelText(/^Ishlar summasi:/).props.accessibilityLabel
      ).toContain('1 mln')
    })
    const initialLabel =
      screen.getByLabelText(/^Ishlar summasi:/).props.accessibilityLabel

    fireEvent.changeText(screen.getByPlaceholderText('Bemor qidirish...'), 'Ali')

    await waitFor(
      () => {
        expect(listPaymentLedgerPatients).toHaveBeenCalledWith(
          expect.objectContaining({ search: 'Ali', per_page: 20 })
        )
      },
      { timeout: 2000 }
    )
    await waitFor(() => {
      expect(screen.queryByTestId('searchbar-spinner')).toBeNull()
    })

    expect(screen.getByLabelText(/^Ishlar summasi:/).props.accessibilityLabel).toBe(
      initialLabel
    )

    fireEvent.press(screen.getByLabelText('Faqat qarzdorlar'))
    await waitFor(() => {
      expect(listPaymentLedgerPatients).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'Ali',
          outstanding: true,
          per_page: 20,
        })
      )
    })
    await waitFor(() => {
      expect(screen.queryByTestId('searchbar-spinner')).toBeNull()
    })
    expect(screen.getByLabelText(/^Ishlar summasi:/).props.accessibilityLabel).toBe(
      initialLabel
    )

    expect(
      jest.mocked(listPaymentLedgerPatients).mock.calls.some(
        ([params]) => params?.per_page === 1 && params.search === undefined
      )
    ).toBe(true)
  })

  it('applies the outstanding filter when opened from analytics', async () => {
    const screen = renderScreen(true)

    await waitFor(() => {
      expect(listPaymentLedgerPatients).toHaveBeenCalledWith(
        expect.objectContaining({ outstanding: true })
      )
    })
    await waitFor(() => expect(screen.getByText('Ali Karimov')).toBeTruthy())
    await waitFor(() =>
      expect(
        screen.getByLabelText(/^Ishlar summasi:/).props.accessibilityLabel
      ).toContain('1 mln')
    )
    expect(screen.getByLabelText('Faqat qarzdorlar')).toHaveAccessibilityState({
      selected: true,
    })
  })

  it('uses the protected thumbnail stream for payment-list patient avatars', async () => {
    const screen = renderScreen()

    await screen.findByText('Ali Karimov')
    expect(screen.UNSAFE_getByType(PatientDebtRow).props.data.patientPhotoUri).toBe(
      `${API_URL}/patients/patient-1/photo?variant=thumbnail`
    )
  })

  it('opens the payment-specific patient ledger instead of the clinical detail', async () => {
    const screen = renderScreen()

    const patientButton = await screen.findByRole('button', {
      name: /Ali Karimov/,
    })
    fireEvent.press(patientButton)

    expect(mockNavigate).toHaveBeenCalledWith('PaymentPatientDetail', {
      id: 'patient-1',
    })
  })

  it('places the expense action by search and groups expenses by month', async () => {
    const expenses: PaymentExpense[] = [
      {
        id: 'expense-july-1',
        title: 'Materiallar',
        amount: 250_000,
        quantity: 2,
        currency: 'UZS',
        expense_date: '2026-07-20',
      },
      {
        id: 'expense-july-2',
        title: 'Ijara',
        amount: 3_000_000,
        quantity: 1,
        currency: 'UZS',
        expense_date: '2026-07-01',
      },
      {
        id: 'expense-june-1',
        title: 'Reklama',
        amount: 100,
        quantity: 1,
        currency: 'USD',
        expense_date: '2026-06-14',
      },
    ]

    const overallExpenseSummary = {
      total_count: expenses.length,
      total_amount: 3_250_100,
      current_month_amount: 3_250_000,
      totals_by_currency: { UZS: 3_250_000, USD: 100 },
      current_month_by_currency: { UZS: 3_250_000, USD: 0 },
      latest_expense_date: '2026-07-20',
    }
    const filteredExpenseSummary = {
      total_count: 1,
      total_amount: 250_000,
      current_month_amount: 250_000,
      totals_by_currency: { UZS: 250_000, USD: 0 },
      current_month_by_currency: { UZS: 250_000, USD: 0 },
      latest_expense_date: '2026-07-20',
    }

    jest.mocked(listPaymentExpenses).mockImplementation(async (params) => {
      const filtered = Boolean(params?.search)
      return {
        data:
          params?.per_page === 1
            ? expenses.slice(0, 1)
            : filtered
              ? expenses.slice(0, 1)
              : expenses,
        meta: {
          pagination: {
            page: 1,
            per_page: params?.per_page ?? 20,
            total: filtered ? 1 : expenses.length,
            total_pages: 1,
          },
          summary: filtered ? filteredExpenseSummary : overallExpenseSummary,
        },
      }
    })

    const screen = renderScreen()
    expect(screen.queryByTestId('expense-add-action')).toBeNull()

    fireEvent.press(screen.getByText('Xarajatlar'))

    expect(await screen.findByTestId('expense-add-action')).toBeTruthy()
    expect(await screen.findByText('Materiallar')).toBeTruthy()
    expect(screen.getByText('iyul, 2026')).toBeTruthy()
    expect(screen.getByText('iyun, 2026')).toBeTruthy()

    const initialExpenseLabel =
      screen.getByLabelText(/^Jami xarajat:/).props.accessibilityLabel
    fireEvent.changeText(
      screen.getByPlaceholderText('Xarajat qidirish...'),
      'Material'
    )
    await waitFor(
      () => {
        expect(listPaymentExpenses).toHaveBeenCalledWith(
          expect.objectContaining({ search: 'Material', per_page: 20 })
        )
      },
      { timeout: 2000 }
    )
    await waitFor(() => {
      expect(screen.queryByTestId('searchbar-spinner')).toBeNull()
    })
    expect(screen.getByLabelText(/^Jami xarajat:/).props.accessibilityLabel).toBe(
      initialExpenseLabel
    )
    expect(
      jest.mocked(listPaymentExpenses).mock.calls.some(
        ([params]) => params?.per_page === 1 && params.search === undefined
      )
    ).toBe(true)
  })
})
