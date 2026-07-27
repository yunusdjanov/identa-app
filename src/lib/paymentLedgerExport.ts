import * as FileSystem from 'expo-file-system/legacy'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'

import {
  listPaymentLedgerHistory,
  type PaymentLedgerEntry,
  type PaymentLedgerPatient,
} from '../api/payments'
import type { Locale } from '../constants'
import { fromLocalDateKey, toIntlLocale } from './format'
import { formatStoredPhone } from './phoneFormat'

const EXPORT_PAGE_SIZE = 100
const MAX_EXPORT_ROWS = 5_000
const MAX_EXPORT_PAGE_REQUESTS = 100

export interface PaymentLedgerExportLabels {
  title: string
  generatedAt: string
  patient: string
  phone: string
  entries: string
  date: string
  work: string
  workPrice: string
  paid: string
  debt: string
  advance: string
  totals: string
  empty: string
  shareTitle: string
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatDate(value: string, locale: Locale): string {
  const date = fromLocalDateKey(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatMoney(
  value: number,
  currency: 'UZS' | 'USD',
  locale: Locale
): string {
  const amount = new Intl.NumberFormat(toIntlLocale(locale), {
    minimumFractionDigits: 0,
    maximumFractionDigits: currency === 'USD' ? 2 : 0,
  }).format(value)
  return `${amount} ${currency}`
}

/**
 * Loads the complete patient ledger for export. The explicit limits prevent
 * a malformed paginator from creating an unbounded client-side request loop;
 * the function throws instead of silently producing a partial finance report.
 */
export async function loadPatientLedgerForExport(
  patientId: string
): Promise<PaymentLedgerEntry[]> {
  const rows: PaymentLedgerEntry[] = []
  const seenIds = new Set<string>()
  const visitedPages = new Set<number>()
  let page = 1

  for (
    let requestCount = 0;
    requestCount < MAX_EXPORT_PAGE_REQUESTS;
    requestCount += 1
  ) {
    if (visitedPages.has(page)) {
      throw new Error('Payment ledger pagination repeated a page')
    }
    visitedPages.add(page)

    const response = await listPaymentLedgerHistory({
      patient_id: patientId,
      page,
      per_page: EXPORT_PAGE_SIZE,
    })

    for (const treatment of response.data) {
      if (seenIds.has(treatment.id)) continue
      seenIds.add(treatment.id)
      rows.push(treatment)
      if (rows.length > MAX_EXPORT_ROWS) {
        throw new Error('Payment ledger is too large for on-device export')
      }
    }

    const pagination = response.meta.pagination
    if (pagination.page >= pagination.total_pages) return rows
    page = pagination.page + 1
  }

  throw new Error('Payment ledger exceeded the export page limit')
}

export function buildPaymentLedgerPdfHtml(
  patient: PaymentLedgerPatient,
  treatments: PaymentLedgerEntry[],
  locale: Locale,
  labels: PaymentLedgerExportLabels,
  now: Date = new Date()
): string {
  const generated = new Intl.DateTimeFormat(toIntlLocale(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(now)
  const phone =
    [
      formatStoredPhone(patient.patient_phone),
      formatStoredPhone(patient.patient_secondary_phone),
    ]
      .filter(Boolean)
      .join(' · ') || labels.empty

  const totals = new Map<
    'UZS' | 'USD',
    { workPrice: number; paid: number; debt: number; advance: number }
  >()
  const rows = treatments
    .map((treatment) => {
      const currency = treatment.currency === 'USD' ? 'USD' : 'UZS'
      const total = totals.get(currency) ?? {
        workPrice: 0,
        paid: 0,
        debt: 0,
        advance: 0,
      }
      total.workPrice += treatment.debt
      total.paid += treatment.paid
      if (treatment.balance_delta > 0) {
        total.debt += treatment.balance_delta
      } else if (treatment.balance_delta < 0) {
        total.advance += Math.abs(treatment.balance_delta)
      }
      totals.set(currency, total)
      const remaining =
        treatment.balance_delta < 0
          ? `${labels.advance}: ${formatMoney(
              Math.abs(treatment.balance_delta),
              currency,
              locale
            )}`
          : formatMoney(treatment.balance_delta, currency, locale)

      return `<tr>
        <td>${escapeHtml(formatDate(treatment.date, locale))}</td>
        <td>${escapeHtml(treatment.work_done || labels.empty)}</td>
        <td class="money">${escapeHtml(formatMoney(treatment.debt, currency, locale))}</td>
        <td class="money paid">${escapeHtml(formatMoney(treatment.paid, currency, locale))}</td>
        <td class="money ${treatment.balance_delta < 0 ? 'advance' : 'debt'}">${escapeHtml(remaining)}</td>
      </tr>`
    })
    .join('')

  const totalRows = Array.from(totals.entries())
    .map(
      ([currency, total]) => `<tr>
        <td colspan="2">${escapeHtml(labels.totals)} · ${currency}</td>
        <td class="money">${escapeHtml(formatMoney(total.workPrice, currency, locale))}</td>
        <td class="money paid">${escapeHtml(formatMoney(total.paid, currency, locale))}</td>
        <td class="money debt">${escapeHtml(formatMoney(total.debt, currency, locale))}${total.advance > 0 ? `<br><span class="advance">${escapeHtml(labels.advance)}: ${escapeHtml(formatMoney(total.advance, currency, locale))}</span>` : ''}</td>
      </tr>`
    )
    .join('')

  return `<!doctype html>
  <html lang="${locale}">
    <head>
      <meta charset="utf-8" />
      <style>
        @page { size: A4 landscape; margin: 16mm; }
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #153b3a; }
        h1 { margin: 0 0 12px; font-size: 23px; }
        .patient { display: flex; gap: 28px; padding: 12px 14px; margin-bottom: 16px; border: 1px solid #d7efec; border-radius: 10px; background: #f5fcfb; }
        .meta-item { min-width: 150px; font-size: 11px; color: #64748b; }
        .meta-item strong { display: block; margin-top: 3px; color: #153b3a; font-size: 13px; }
        .generated { margin-left: auto; text-align: right; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid; }
        th { padding: 9px; background: #e6faf7; color: #115e59; font-size: 10.5px; text-align: left; }
        td { padding: 9px; border-bottom: 1px solid #e2e8f0; font-size: 10px; vertical-align: top; word-wrap: break-word; }
        th:nth-child(1), td:nth-child(1) { width: 14%; }
        th:nth-child(2), td:nth-child(2) { width: 29%; }
        th:nth-child(3), td:nth-child(3),
        th:nth-child(4), td:nth-child(4),
        th:nth-child(5), td:nth-child(5) { width: 19%; }
        .money { white-space: nowrap; font-variant-numeric: tabular-nums; }
        .paid { color: #16805a; }
        .debt { color: #a65f00; }
        .advance { color: #16805a; }
        tfoot td { border-top: 1.5px solid #9ddbd4; border-bottom: 0; background: #f5fcfb; font-weight: 700; }
        .empty { padding: 24px; color: #64748b; text-align: center; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(labels.title)}</h1>
      <div class="patient">
        <div class="meta-item">${escapeHtml(labels.patient)}<strong>${escapeHtml(patient.patient_name)}</strong></div>
        <div class="meta-item">${escapeHtml(labels.phone)}<strong>${escapeHtml(phone)}</strong></div>
        <div class="meta-item">${escapeHtml(labels.entries)}<strong>${treatments.length}</strong></div>
        <div class="meta-item generated">${escapeHtml(labels.generatedAt)}<strong>${escapeHtml(generated)}</strong></div>
      </div>
      <table>
        <thead><tr>
          <th>${escapeHtml(labels.date)}</th>
          <th>${escapeHtml(labels.work)}</th>
          <th>${escapeHtml(labels.workPrice)}</th>
          <th>${escapeHtml(labels.paid)}</th>
          <th>${escapeHtml(labels.debt)}</th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="5" class="empty">${escapeHtml(labels.empty)}</td></tr>`}</tbody>
        ${totalRows ? `<tfoot>${totalRows}</tfoot>` : ''}
      </table>
    </body>
  </html>`
}

export async function exportPaymentLedgerPdf(
  patient: PaymentLedgerPatient,
  treatments: PaymentLedgerEntry[],
  locale: Locale,
  labels: PaymentLedgerExportLabels
): Promise<void> {
  if (treatments.length === 0) {
    throw new Error('Cannot export an empty payment ledger')
  }

  const html = buildPaymentLedgerPdfHtml(
    patient,
    treatments,
    locale,
    labels
  )
  if (!(await Sharing.isAvailableAsync())) {
    await Print.printAsync({ html })
    return
  }

  const { uri } = await Print.printToFileAsync({ html })
  try {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: labels.shareTitle,
      UTI: 'com.adobe.pdf',
    })
  } finally {
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {})
  }
}
