import client from './client'
import { requireOnline } from '../lib/offlineGuard'
import type { ApiResponse } from '../types'

export type MoneyCurrency = 'UZS' | 'USD'

export interface MoneyLedgerAmount {
  total_debt: number
  total_paid: number
  balance: number
}

export interface PaymentLedgerPatient {
  patient_id: string
  patient_code?: string | null
  patient_name: string
  patient_phone?: string | null
  patient_secondary_phone?: string | null
  patient_address?: string | null
  patient_date_of_birth?: string | null
  patient_photo_scan_status?: 'pending' | 'approved' | 'rejected' | null
  patient_photo_url?: string | null
  patient_photo_thumbnail_url?: string | null
  patient_photo_preview_url?: string | null
  patient_photo_thumbnail_ready?: boolean
  patient_photo_preview_ready?: boolean
  total_debt: number
  total_paid: number
  balance: number
  balances_by_currency: Record<MoneyCurrency, MoneyLedgerAmount>
  entry_count: number
  last_entry_date?: string | null
}

export interface PaymentLedgerSummary {
  total_debt: number
  total_paid: number
  total_balance: number
  total_patients: number
  total_entries: number
  totals_by_currency: Record<
    MoneyCurrency,
    {
      total_debt: number
      total_paid: number
      total_balance: number
    }
  >
}

export interface PaymentLedgerEntry {
  id: string
  patient_id: string
  patient_name?: string | null
  patient_phone?: string | null
  patient_secondary_phone?: string | null
  patient_code?: string | null
  date: string
  work_done: string
  comment?: string | null
  debt: number
  paid: number
  balance_delta: number
  currency: MoneyCurrency
}

export interface PaymentExpense {
  id: string
  title: string
  amount: number
  quantity: number
  currency: MoneyCurrency
  expense_date: string
  created_at?: string
  updated_at?: string
}

export interface PaymentExpenseSummary {
  total_count: number
  /** Backward-compatible UZS-only scalar. */
  total_amount: number
  /** Backward-compatible UZS-only scalar. */
  current_month_amount: number
  totals_by_currency: Record<MoneyCurrency, number>
  current_month_by_currency: Record<MoneyCurrency, number>
  latest_expense_date: string | null
}

interface Pagination {
  page: number
  per_page: number
  total: number
  total_pages: number
}

export interface PaymentPage<T, Summary> {
  data: T[]
  meta: { pagination: Pagination; summary: Summary }
}

export interface PaymentListParams {
  page?: number
  per_page?: number
  search?: string
  outstanding?: boolean
  patient_id?: string
  date_from?: string
  date_to?: string
}

export class FinanceContractError extends Error {
  constructor(path: string) {
    super(`Invalid finance API response at ${path}`)
    this.name = 'FinanceContractError'
  }
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new FinanceContractError(path)
  }
  return value as Record<string, unknown>
}

function asString(value: unknown, path: string): string {
  if (typeof value !== 'string') throw new FinanceContractError(path)
  return value
}

function asOptionalString(value: unknown, path: string): string | null | undefined {
  if (value === undefined || value === null) return value
  return asString(value, path)
}

function asNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new FinanceContractError(path)
  }
  return value
}

function asInteger(value: unknown, path: string): number {
  const parsed = asNumber(value, path)
  if (!Number.isInteger(parsed) || parsed < 0) throw new FinanceContractError(path)
  return parsed
}

function asOptionalBoolean(value: unknown, path: string): boolean | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'boolean') throw new FinanceContractError(path)
  return value
}

function asCurrency(value: unknown, path: string): MoneyCurrency {
  if (value !== 'UZS' && value !== 'USD') throw new FinanceContractError(path)
  return value
}

function asDateKey(value: unknown, path: string): string {
  const date = asString(value, path)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new FinanceContractError(path)
  return date
}

function parsePagination(value: unknown, path: string): Pagination {
  const row = asRecord(value, path)
  const page = asInteger(row.page, `${path}.page`)
  const perPage = asInteger(row.per_page, `${path}.per_page`)
  const total = asInteger(row.total, `${path}.total`)
  const totalPages = asInteger(row.total_pages, `${path}.total_pages`)
  if (page < 1 || perPage < 1 || totalPages < 1) throw new FinanceContractError(path)
  return { page, per_page: perPage, total, total_pages: totalPages }
}

function parseLedgerAmount(value: unknown, path: string): MoneyLedgerAmount {
  const row = asRecord(value, path)
  return {
    total_debt: asNumber(row.total_debt, `${path}.total_debt`),
    total_paid: asNumber(row.total_paid, `${path}.total_paid`),
    balance: asNumber(row.balance, `${path}.balance`),
  }
}

function parseCurrencyLedgerAmounts(
  value: unknown,
  path: string
): Record<MoneyCurrency, MoneyLedgerAmount> {
  const row = asRecord(value, path)
  return {
    UZS: parseLedgerAmount(row.UZS, `${path}.UZS`),
    USD: parseLedgerAmount(row.USD, `${path}.USD`),
  }
}

function parseLedgerSummary(value: unknown, path: string): PaymentLedgerSummary {
  const row = asRecord(value, path)
  const totals = asRecord(row.totals_by_currency, `${path}.totals_by_currency`)
  const currencyTotal = (currency: MoneyCurrency) => {
    const item = asRecord(totals[currency], `${path}.totals_by_currency.${currency}`)
    return {
      total_debt: asNumber(
        item.total_debt,
        `${path}.totals_by_currency.${currency}.total_debt`
      ),
      total_paid: asNumber(
        item.total_paid,
        `${path}.totals_by_currency.${currency}.total_paid`
      ),
      total_balance: asNumber(
        item.total_balance,
        `${path}.totals_by_currency.${currency}.total_balance`
      ),
    }
  }

  return {
    total_debt: asNumber(row.total_debt, `${path}.total_debt`),
    total_paid: asNumber(row.total_paid, `${path}.total_paid`),
    total_balance: asNumber(row.total_balance, `${path}.total_balance`),
    total_patients: asInteger(row.total_patients, `${path}.total_patients`),
    total_entries: asInteger(row.total_entries, `${path}.total_entries`),
    totals_by_currency: {
      UZS: currencyTotal('UZS'),
      USD: currencyTotal('USD'),
    },
  }
}

function parseLedgerPatient(value: unknown, path: string): PaymentLedgerPatient {
  const row = asRecord(value, path)
  const scanStatus = row.patient_photo_scan_status
  if (
    scanStatus !== undefined &&
    scanStatus !== null &&
    scanStatus !== 'pending' &&
    scanStatus !== 'approved' &&
    scanStatus !== 'rejected'
  ) {
    throw new FinanceContractError(`${path}.patient_photo_scan_status`)
  }

  return {
    patient_id: asString(row.patient_id, `${path}.patient_id`),
    patient_code: asOptionalString(row.patient_code, `${path}.patient_code`),
    patient_name: asString(row.patient_name, `${path}.patient_name`),
    patient_phone: asOptionalString(row.patient_phone, `${path}.patient_phone`),
    patient_secondary_phone: asOptionalString(
      row.patient_secondary_phone,
      `${path}.patient_secondary_phone`
    ),
    patient_address: asOptionalString(row.patient_address, `${path}.patient_address`),
    patient_date_of_birth: asOptionalString(
      row.patient_date_of_birth,
      `${path}.patient_date_of_birth`
    ),
    patient_photo_scan_status: scanStatus,
    patient_photo_url: asOptionalString(
      row.patient_photo_url,
      `${path}.patient_photo_url`
    ),
    patient_photo_thumbnail_url: asOptionalString(
      row.patient_photo_thumbnail_url,
      `${path}.patient_photo_thumbnail_url`
    ),
    patient_photo_preview_url: asOptionalString(
      row.patient_photo_preview_url,
      `${path}.patient_photo_preview_url`
    ),
    patient_photo_thumbnail_ready: asOptionalBoolean(
      row.patient_photo_thumbnail_ready,
      `${path}.patient_photo_thumbnail_ready`
    ),
    patient_photo_preview_ready: asOptionalBoolean(
      row.patient_photo_preview_ready,
      `${path}.patient_photo_preview_ready`
    ),
    total_debt: asNumber(row.total_debt, `${path}.total_debt`),
    total_paid: asNumber(row.total_paid, `${path}.total_paid`),
    balance: asNumber(row.balance, `${path}.balance`),
    balances_by_currency: parseCurrencyLedgerAmounts(
      row.balances_by_currency,
      `${path}.balances_by_currency`
    ),
    entry_count: asInteger(row.entry_count, `${path}.entry_count`),
    last_entry_date:
      row.last_entry_date === undefined || row.last_entry_date === null
        ? row.last_entry_date
        : asDateKey(row.last_entry_date, `${path}.last_entry_date`),
  }
}

function parseLedgerEntry(value: unknown, path: string): PaymentLedgerEntry {
  const row = asRecord(value, path)
  return {
    id: asString(row.id, `${path}.id`),
    patient_id: asString(row.patient_id, `${path}.patient_id`),
    patient_name: asOptionalString(row.patient_name, `${path}.patient_name`),
    patient_phone: asOptionalString(row.patient_phone, `${path}.patient_phone`),
    patient_secondary_phone: asOptionalString(
      row.patient_secondary_phone,
      `${path}.patient_secondary_phone`
    ),
    patient_code: asOptionalString(row.patient_code, `${path}.patient_code`),
    date: asDateKey(row.date, `${path}.date`),
    work_done: asString(row.work_done, `${path}.work_done`),
    comment: asOptionalString(row.comment, `${path}.comment`),
    debt: asNumber(row.debt, `${path}.debt`),
    paid: asNumber(row.paid, `${path}.paid`),
    balance_delta: asNumber(row.balance_delta, `${path}.balance_delta`),
    currency: asCurrency(row.currency, `${path}.currency`),
  }
}

function parseExpense(value: unknown, path: string): PaymentExpense {
  const row = asRecord(value, path)
  return {
    id: asString(row.id, `${path}.id`),
    title: asString(row.title, `${path}.title`),
    amount: asNumber(row.amount, `${path}.amount`),
    quantity: asNumber(row.quantity, `${path}.quantity`),
    currency: asCurrency(row.currency, `${path}.currency`),
    expense_date: asDateKey(row.expense_date, `${path}.expense_date`),
    created_at: asOptionalString(row.created_at, `${path}.created_at`) ?? undefined,
    updated_at: asOptionalString(row.updated_at, `${path}.updated_at`) ?? undefined,
  }
}

function parseExpenseSummary(value: unknown, path: string): PaymentExpenseSummary {
  const row = asRecord(value, path)
  const totals = asRecord(row.totals_by_currency, `${path}.totals_by_currency`)
  const month = asRecord(
    row.current_month_by_currency,
    `${path}.current_month_by_currency`
  )
  return {
    total_count: asInteger(row.total_count, `${path}.total_count`),
    total_amount: asNumber(row.total_amount, `${path}.total_amount`),
    current_month_amount: asNumber(
      row.current_month_amount,
      `${path}.current_month_amount`
    ),
    totals_by_currency: {
      UZS: asNumber(totals.UZS, `${path}.totals_by_currency.UZS`),
      USD: asNumber(totals.USD, `${path}.totals_by_currency.USD`),
    },
    current_month_by_currency: {
      UZS: asNumber(month.UZS, `${path}.current_month_by_currency.UZS`),
      USD: asNumber(month.USD, `${path}.current_month_by_currency.USD`),
    },
    latest_expense_date:
      row.latest_expense_date === null
        ? null
        : asDateKey(row.latest_expense_date, `${path}.latest_expense_date`),
  }
}

function parsePage<T, Summary>(
  value: unknown,
  path: string,
  parseRow: (row: unknown, rowPath: string) => T,
  parseSummary: (summary: unknown, summaryPath: string) => Summary
): PaymentPage<T, Summary> {
  const root = asRecord(value, path)
  if (!Array.isArray(root.data)) throw new FinanceContractError(`${path}.data`)
  const meta = asRecord(root.meta, `${path}.meta`)
  return {
    data: root.data.map((row, index) => parseRow(row, `${path}.data[${index}]`)),
    meta: {
      pagination: parsePagination(meta.pagination, `${path}.meta.pagination`),
      summary: parseSummary(meta.summary, `${path}.meta.summary`),
    },
  }
}

function listParams(params?: PaymentListParams): Record<string, string | number> {
  const query: Record<string, string | number> = {
    page: params?.page ?? 1,
    per_page: params?.per_page ?? 20,
  }
  if (params?.search) query['filter[search]'] = params.search
  if (params?.outstanding) query['filter[outstanding]'] = 1
  if (params?.patient_id) query['filter[patient_id]'] = params.patient_id
  if (params?.date_from) query['filter[date_from]'] = params.date_from
  if (params?.date_to) query['filter[date_to]'] = params.date_to
  return query
}

export const listPaymentLedgerPatients = async (
  params?: PaymentListParams
): Promise<PaymentPage<PaymentLedgerPatient, PaymentLedgerSummary>> => {
  const response = await client.get<unknown>('/payments/ledger/patients', {
    params: listParams(params),
  })
  return parsePage(
    response.data,
    'payments.ledger.patients',
    parseLedgerPatient,
    parseLedgerSummary
  )
}

export const listPaymentLedgerHistory = async (
  params?: PaymentListParams
): Promise<PaymentPage<PaymentLedgerEntry, PaymentLedgerSummary>> => {
  const response = await client.get<unknown>('/payments/ledger/history', {
    params: listParams(params),
  })
  return parsePage(
    response.data,
    'payments.ledger.history',
    parseLedgerEntry,
    parseLedgerSummary
  )
}

export const listPaymentExpenses = async (
  params?: PaymentListParams
): Promise<PaymentPage<PaymentExpense, PaymentExpenseSummary>> => {
  const response = await client.get<unknown>('/payments/expenses', {
    params: listParams(params),
  })
  return parsePage(
    response.data,
    'payments.expenses',
    parseExpense,
    parseExpenseSummary
  )
}

export interface PaymentExpensePayload {
  title: string
  amount: number
  quantity: number
  currency: MoneyCurrency
  expense_date: string
}

export function createPaymentExpenseIdempotencyKey(): string {
  return `expense-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`
}

function parseExpenseEnvelope(value: unknown, path: string): PaymentExpense {
  const envelope = asRecord(value, path)
  return parseExpense(envelope.data, `${path}.data`)
}

export const createPaymentExpense = async (
  payload: PaymentExpensePayload,
  idempotencyKey = createPaymentExpenseIdempotencyKey()
): Promise<PaymentExpense> => {
  requireOnline()
  const response = await client.post<ApiResponse<unknown>>(
    '/payments/expenses',
    payload,
    { headers: { 'Idempotency-Key': idempotencyKey } }
  )
  return parseExpenseEnvelope(response.data, 'payments.expenses.create')
}

export const updatePaymentExpense = async (
  id: string,
  payload: PaymentExpensePayload
): Promise<PaymentExpense> => {
  requireOnline()
  const response = await client.put<ApiResponse<unknown>>(
    `/payments/expenses/${id}`,
    payload
  )
  return parseExpenseEnvelope(response.data, 'payments.expenses.update')
}

export const deletePaymentExpense = async (id: string): Promise<void> => {
  requireOnline()
  await client.delete(`/payments/expenses/${id}`)
}
