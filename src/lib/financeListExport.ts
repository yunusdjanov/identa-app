import * as FileSystem from 'expo-file-system/legacy'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'

import {
  listPaymentExpenses,
  listPaymentLedgerPatients,
  type MoneyCurrency,
  type PaymentExpense,
  type PaymentLedgerPatient,
  type PaymentListParams,
} from '../api/payments'
import type { Locale } from '../constants'
import { fromLocalDateKey, toIntlLocale } from './format'
import { formatStoredPhone } from './phoneFormat'

const EXPORT_PAGE_SIZE = 100
const MAX_EXPORT_ROWS = 5_000
const MAX_EXPORT_PAGE_REQUESTS = 100
const CURRENCIES: MoneyCurrency[] = ['UZS', 'USD']

export interface FinanceListExportLabels {
  title: string
  generatedAt: string
  patient: string
  phone: string
  entries: string
  workPrice: string
  paid: string
  balance: string
  debt: string
  advance: string
  date: string
  expense: string
  quantity: string
  amount: string
  empty: string
  shareTitle: string
}

export async function loadPaymentPatientsForExport(
  filters: Pick<PaymentListParams, 'search' | 'outstanding'> = {}
): Promise<PaymentLedgerPatient[]> {
  return collectPages(
    (page) =>
      listPaymentLedgerPatients({
        ...filters,
        page,
        per_page: EXPORT_PAGE_SIZE,
      }),
    (patient) => patient.patient_id
  )
}

export async function loadPaymentExpensesForExport(
  filters: Pick<PaymentListParams, 'search' | 'date_from' | 'date_to'> = {}
): Promise<PaymentExpense[]> {
  return collectPages(
    (page) =>
      listPaymentExpenses({
        ...filters,
        page,
        per_page: EXPORT_PAGE_SIZE,
      }),
    (expense) => expense.id
  )
}

async function collectPages<T, Summary>(
  loadPage: (
    page: number
  ) => Promise<{
    data: T[]
    meta: {
      pagination: {
        page: number
        total_pages: number
      }
      summary: Summary
    }
  }>,
  getKey: (row: T) => string
): Promise<T[]> {
  const rows: T[] = []
  const seenRows = new Set<string>()
  const visitedPages = new Set<number>()
  let page = 1

  for (
    let requestCount = 0;
    requestCount < MAX_EXPORT_PAGE_REQUESTS;
    requestCount += 1
  ) {
    if (visitedPages.has(page)) {
      throw new Error('Finance export pagination repeated a page')
    }
    visitedPages.add(page)
    const response = await loadPage(page)
    for (const row of response.data) {
      const key = getKey(row)
      if (seenRows.has(key)) continue
      seenRows.add(key)
      rows.push(row)
    }
    if (rows.length > MAX_EXPORT_ROWS) {
      throw new Error('Finance export is too large for on-device export')
    }

    const pagination = response.meta.pagination
    if (pagination.page >= pagination.total_pages) return rows
    page = pagination.page + 1
  }

  throw new Error('Finance export exceeded the page limit')
}

export function buildPaymentPatientsPdfHtml(
  patients: PaymentLedgerPatient[],
  locale: Locale,
  labels: FinanceListExportLabels,
  now: Date = new Date()
): string {
  const rows = patients
    .map(
      (patient) => `<tr>
        <td>${escapeHtml(patient.patient_name)}</td>
        <td>${escapeHtml(
          formatStoredPhone(patient.patient_phone) || labels.empty
        )}</td>
        <td>${patient.entry_count}</td>
        <td>${escapeHtml(
          formatPatientMoney(patient, 'total_debt', locale, labels)
        )}</td>
        <td class="paid">${escapeHtml(
          formatPatientMoney(patient, 'total_paid', locale, labels)
        )}</td>
        <td>${escapeHtml(
          formatPatientBalance(patient, locale, labels)
        )}</td>
      </tr>`
    )
    .join('')

  return buildTableDocument(
    labels.title,
    labels.generatedAt,
    formatGeneratedAt(now, locale),
    [
      labels.patient,
      labels.phone,
      labels.entries,
      labels.workPrice,
      labels.paid,
      labels.balance,
    ],
    rows,
    6,
    labels.empty,
    locale
  )
}

export function buildPaymentExpensesPdfHtml(
  expenses: PaymentExpense[],
  locale: Locale,
  labels: FinanceListExportLabels,
  now: Date = new Date()
): string {
  const rows = expenses
    .map(
      (expense) => `<tr>
        <td>${escapeHtml(formatDate(expense.expense_date, locale))}</td>
        <td>${escapeHtml(expense.title)}</td>
        <td>${escapeHtml(String(expense.quantity))}</td>
        <td>${escapeHtml(
          formatMoney(expense.amount, expense.currency, locale)
        )}</td>
      </tr>`
    )
    .join('')

  return buildTableDocument(
    labels.title,
    labels.generatedAt,
    formatGeneratedAt(now, locale),
    [labels.date, labels.expense, labels.quantity, labels.amount],
    rows,
    4,
    labels.empty,
    locale
  )
}

export async function exportFinanceListPdf(
  html: string,
  shareTitle: string
): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    await Print.printAsync({ html })
    return
  }

  const { uri } = await Print.printToFileAsync({ html })
  try {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: shareTitle,
      UTI: 'com.adobe.pdf',
    })
  } finally {
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {})
  }
}

function formatPatientMoney(
  patient: PaymentLedgerPatient,
  field: 'total_debt' | 'total_paid',
  locale: Locale,
  labels: FinanceListExportLabels
): string {
  const values = CURRENCIES.map((currency) => ({
    currency,
    amount: patient.balances_by_currency[currency][field],
  })).filter(({ currency, amount }) => currency === 'UZS' || amount !== 0)

  return (
    values
      .map(({ currency, amount }) => formatMoney(amount, currency, locale))
      .join(' / ') || labels.empty
  )
}

function formatPatientBalance(
  patient: PaymentLedgerPatient,
  locale: Locale,
  labels: FinanceListExportLabels
): string {
  return CURRENCIES.map((currency) => ({
    currency,
    amount: patient.balances_by_currency[currency].balance,
  }))
    .filter(({ currency, amount }) => currency === 'UZS' || amount !== 0)
    .map(({ currency, amount }) => {
      const status =
        amount < 0 ? labels.advance : amount > 0 ? labels.debt : labels.balance
      return `${status}: ${formatMoney(Math.abs(amount), currency, locale)}`
    })
    .join(' / ')
}

function buildTableDocument(
  title: string,
  generatedAtLabel: string,
  generatedAt: string,
  columns: string[],
  rows: string,
  columnCount: number,
  empty: string,
  locale: Locale
): string {
  return `<!doctype html>
  <html lang="${locale}">
    <head>
      <meta charset="utf-8" />
      <style>
        @page { size: A4 landscape; margin: 16mm; }
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #153b3a; }
        h1 { margin: 0 0 6px; font-size: 23px; }
        .meta { margin-bottom: 16px; color: #64748b; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid; }
        th { padding: 9px; background: #e6faf7; color: #115e59; font-size: 10px; text-align: left; }
        td { padding: 9px; border-bottom: 1px solid #e2e8f0; font-size: 9.5px; vertical-align: top; word-wrap: break-word; }
        .paid { color: #16805a; }
        .empty { padding: 24px; color: #64748b; text-align: center; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">${escapeHtml(generatedAtLabel)}: ${escapeHtml(
        generatedAt
      )}</div>
      <table>
        <thead><tr>${columns
          .map((column) => `<th>${escapeHtml(column)}</th>`)
          .join('')}</tr></thead>
        <tbody>${
          rows ||
          `<tr><td colspan="${columnCount}" class="empty">${escapeHtml(
            empty
          )}</td></tr>`
        }</tbody>
      </table>
    </body>
  </html>`
}

function formatGeneratedAt(value: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}

function formatDate(value: string, locale: Locale): string {
  const parsed = fromLocalDateKey(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed)
}

function formatMoney(
  value: number,
  currency: MoneyCurrency,
  locale: Locale
): string {
  const amount = new Intl.NumberFormat(toIntlLocale(locale), {
    minimumFractionDigits: 0,
    maximumFractionDigits: currency === 'USD' ? 2 : 0,
  }).format(value)
  return `${amount} ${currency}`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
