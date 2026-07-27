import MockAdapter from 'axios-mock-adapter'

import client from '../client'
import {
  createPaymentExpense,
  deletePaymentExpense,
  FinanceContractError,
  listPaymentExpenses,
  listPaymentLedgerHistory,
  listPaymentLedgerPatients,
  updatePaymentExpense,
} from '../payments'
import { useAuthStore } from '../../stores/auth'
import { useNetworkStore } from '../../stores/network'

function authed() {
  useAuthStore.setState({
    user: {
      id: '1',
      name: 'T',
      email: 't@t',
      role: 'dentist',
      account_status: 'active',
    },
    tokens: {
      access_token: 'a',
      refresh_token: 'r',
      token_type: 'Bearer',
      expires_in: 900,
      refresh_expires_in: 2592000,
    },
    isAuthenticated: true,
    isHydrating: false,
  } as any)
  useNetworkStore.setState({ isOnline: true })
}

const pagination = { page: 1, per_page: 20, total: 1, total_pages: 1 }
const ledgerSummary = {
  total_debt: 100000,
  total_paid: 25000,
  total_balance: 75000,
  total_patients: 1,
  total_entries: 2,
  totals_by_currency: {
    UZS: { total_debt: 100000, total_paid: 25000, total_balance: 75000 },
    USD: { total_debt: 100, total_paid: 40, total_balance: 60 },
  },
}

describe('payments API', () => {
  let mock: MockAdapter

  beforeEach(() => {
    mock = new MockAdapter(client)
    authed()
  })

  afterEach(() => mock.restore())

  it('loads the patient ledger without mixing currencies', async () => {
    let paramsSeen: Record<string, unknown> | undefined
    mock.onGet('/payments/ledger/patients').reply((config) => {
      paramsSeen = config.params
      return [
        200,
        {
          data: [
            {
              patient_id: 'p-1',
              patient_name: 'Ali Valiyev',
              total_debt: 100000,
              total_paid: 25000,
              balance: 75000,
              balances_by_currency: {
                UZS: { total_debt: 100000, total_paid: 25000, balance: 75000 },
                USD: { total_debt: 100, total_paid: 40, balance: 60 },
              },
              entry_count: 2,
            },
          ],
          meta: { pagination, summary: ledgerSummary },
        },
      ]
    })

    const result = await listPaymentLedgerPatients({
      patient_id: 'p-1',
      search: 'Ali',
      outstanding: true,
    })

    expect(paramsSeen).toEqual({
      page: 1,
      per_page: 20,
      'filter[search]': 'Ali',
      'filter[outstanding]': 1,
      'filter[patient_id]': 'p-1',
    })
    expect(result.meta.summary.totals_by_currency.USD.total_balance).toBe(60)
    expect(result.data[0]?.balances_by_currency.UZS.balance).toBe(75000)
  })

  it('loads strict patient-scoped ledger history', async () => {
    mock.onGet('/payments/ledger/history').reply(200, {
      data: [
        {
          id: 'tx-1',
          patient_id: 'p-1',
          patient_name: 'Ali Valiyev',
          date: '2026-07-15',
          work_done: 'Restoration',
          debt: 100,
          paid: 120,
          balance_delta: -20,
          currency: 'USD',
        },
      ],
      meta: { pagination, summary: ledgerSummary },
    })

    const result = await listPaymentLedgerHistory({
      patient_id: 'p-1',
      page: 1,
      per_page: 20,
    })

    expect(result.data[0]).toMatchObject({
      id: 'tx-1',
      balance_delta: -20,
      currency: 'USD',
    })
  })

  it('rejects malformed finance payloads instead of coercing values', async () => {
    mock.onGet('/payments/ledger/patients').reply(200, {
      data: [
        {
          patient_id: 'p-1',
          patient_name: 'Ali',
          total_debt: '100000',
          total_paid: 0,
          balance: 100000,
          balances_by_currency: {
            UZS: { total_debt: 100000, total_paid: 0, balance: 100000 },
            USD: { total_debt: 0, total_paid: 0, balance: 0 },
          },
          entry_count: 1,
        },
      ],
      meta: { pagination, summary: ledgerSummary },
    })

    await expect(listPaymentLedgerPatients()).rejects.toBeInstanceOf(
      FinanceContractError
    )
  })

  it('loads and mutates expenses through the current endpoints', async () => {
    const payload = {
      title: 'Rent',
      amount: 1500000,
      quantity: 1,
      currency: 'UZS' as const,
      expense_date: '2026-07-15',
    }
    let idempotencyKey: string | undefined
    mock.onGet('/payments/expenses').reply(200, {
      data: [{ id: 'e-1', ...payload }],
      meta: {
        pagination,
        summary: {
          total_count: 1,
          total_amount: 1500000,
          current_month_amount: 1500000,
          totals_by_currency: { UZS: 1500000, USD: 0 },
          current_month_by_currency: { UZS: 1500000, USD: 0 },
          latest_expense_date: '2026-07-15',
        },
      },
    })
    mock.onPost('/payments/expenses').reply((config) => {
      idempotencyKey = config.headers?.['Idempotency-Key'] as string | undefined
      return [201, { data: { id: 'e-1', ...JSON.parse(config.data) } }]
    })
    mock.onPut('/payments/expenses/e-1').reply((config) => [
      200,
      { data: { id: 'e-1', ...JSON.parse(config.data) } },
    ])
    mock.onDelete('/payments/expenses/e-1').reply(204)

    const listed = await listPaymentExpenses({ search: 'rent' })
    const created = await createPaymentExpense(payload, 'expense-stable-test-key')
    const updated = await updatePaymentExpense('e-1', {
      ...payload,
      amount: 1600000,
    })
    await expect(deletePaymentExpense('e-1')).resolves.toBeUndefined()

    expect(listed.meta.summary.totals_by_currency.USD).toBe(0)
    expect(created.id).toBe('e-1')
    expect(updated.amount).toBe(1600000)
    expect(idempotencyKey).toBe('expense-stable-test-key')
  })

  it('blocks all remaining finance mutations while offline', async () => {
    useNetworkStore.setState({ isOnline: false })
    const payload = {
      title: 'Rent',
      amount: 1,
      quantity: 1,
      currency: 'UZS' as const,
      expense_date: '2026-07-15',
    }

    await expect(createPaymentExpense(payload)).rejects.toMatchObject({
      name: 'OfflineError',
    })
    await expect(updatePaymentExpense('e-1', payload)).rejects.toMatchObject({
      name: 'OfflineError',
    })
    await expect(deletePaymentExpense('e-1')).rejects.toMatchObject({
      name: 'OfflineError',
    })
  })
})
