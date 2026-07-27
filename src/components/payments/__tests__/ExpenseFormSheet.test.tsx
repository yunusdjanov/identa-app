import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, waitFor, within } from '@testing-library/react-native'

import ExpenseFormSheet from '../ExpenseFormSheet'
import { I18nProvider } from '../../../i18n'
import type { PaymentExpense } from '../../../api/payments'
import {
  createPaymentExpense,
  createPaymentExpenseIdempotencyKey,
} from '../../../api/payments'

jest.mock('../../ui/BottomSheet', () => {
  const React = require('react')
  const { View } = require('react-native')
  return function MockBottomSheet({ visible, children }: any) {
    return visible ? React.createElement(View, null, children) : null
  }
})

jest.mock('../../ui/InputCard', () => {
  const React = require('react')
  const { TextInput } = require('react-native')
  return function MockInputCard({
    iconName: _iconName,
    containerStyle: _containerStyle,
    error: _error,
    errorMessage: _errorMessage,
    ...props
  }: any) {
    return React.createElement(TextInput, props)
  }
})

jest.mock('../../ui/MonthCalendarPicker', () => () => null)
jest.mock('../../ui/SegmentedControl', () => {
  const React = require('react')
  const { Text, View } = require('react-native')
  return function MockSegmentedControl({ options, value }: any) {
    return React.createElement(
      View,
      { accessibilityValue: { text: value } },
      options.map((option: any) =>
        React.createElement(Text, { key: option.value }, option.label)
      )
    )
  }
})

jest.mock('../../ui/Toast', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
  }),
}))

jest.mock('../../ui/Dialog', () => ({
  useDialog: () => ({ confirm: jest.fn().mockResolvedValue(true) }),
}))

jest.mock('../../../api/payments', () => ({
  createPaymentExpenseIdempotencyKey: jest.fn(() => 'expense-form-key'),
  createPaymentExpense: jest.fn(),
  updatePaymentExpense: jest.fn(),
}))

function renderSheet(expense: PaymentExpense | null = null) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider defaultLocale="uz">
        <ExpenseFormSheet visible expense={expense} onClose={jest.fn()} />
      </I18nProvider>
    </QueryClientProvider>
  )
}

describe('<ExpenseFormSheet />', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the compact form date-first with currency in the amount header', () => {
    const screen = renderSheet()
    const form = screen.getByTestId('expense-form')
    const dateField = screen.getByTestId('expense-date-field')
    const amountHeader = screen.getByTestId('expense-amount-header')

    expect(
      typeof form.children[0] === 'string'
        ? null
        : form.children[0]?.props.testID
    ).toBe(dateField.props.testID)
    expect(
      within(amountHeader).getByTestId('expense-currency-control')
    ).toBeTruthy()
    expect(screen.getByLabelText(/^Sana:/)).toBeTruthy()
  })

  it('uses the same compact form and pre-fills values while editing', async () => {
    const expense: PaymentExpense = {
      id: 'expense-1',
      title: 'Materiallar',
      amount: 1_234,
      quantity: 2,
      currency: 'UZS',
      expense_date: '2026-07-20',
    }
    const screen = renderSheet(expense)

    expect(await screen.findByDisplayValue('Materiallar')).toBeTruthy()
    expect(screen.getByDisplayValue('1 234')).toBeTruthy()
    expect(screen.getByDisplayValue('2')).toBeTruthy()
    expect(screen.getByTestId('expense-date-field')).toBeTruthy()
  })

  it('reuses one idempotency key when a failed create is retried', async () => {
    jest
      .mocked(createPaymentExpense)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({
        id: 'expense-1',
        title: 'Materiallar',
        amount: 120000,
        quantity: 1,
        currency: 'UZS',
        expense_date: '2026-07-27',
      })
    const screen = renderSheet()

    fireEvent.changeText(screen.getByLabelText('Nomi'), 'Materiallar')
    fireEvent.changeText(screen.getByLabelText('Miqdor'), '120000')
    fireEvent.press(screen.getByText("Xarajat qo'shish"))

    await waitFor(() => expect(createPaymentExpense).toHaveBeenCalledTimes(1))
    fireEvent.press(screen.getByText("Xarajat qo'shish"))
    await waitFor(() => expect(createPaymentExpense).toHaveBeenCalledTimes(2))

    expect(createPaymentExpenseIdempotencyKey).toHaveBeenCalledTimes(1)
    expect(jest.mocked(createPaymentExpense).mock.calls[0]?.[1]).toBe(
      'expense-form-key'
    )
    expect(jest.mocked(createPaymentExpense).mock.calls[1]?.[1]).toBe(
      'expense-form-key'
    )
  })
})
