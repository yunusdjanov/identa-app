import * as FileSystem from 'expo-file-system/legacy'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'

import type { Locale } from '../constants'
import type { ApiAnalyticsSummary } from '../types'

export interface AnalyticsExportLabels {
  title: string
  range: string
  generatedAt: string
  period: string
  revenue: string
  debt: string
  patients: string
  visits: string
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

function intlLocale(locale: Locale): string {
  if (locale === 'uz') return 'uz-UZ'
  if (locale === 'ru') return 'ru-RU'
  return 'en-US'
}

function formatMoney(
  amount: number,
  locale: Locale,
  currency: ApiAnalyticsSummary['currency']
): string {
  return `${new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: currency === 'USD' ? 2 : 0,
    maximumFractionDigits: currency === 'USD' ? 2 : 0,
  }).format(Number.isFinite(amount) ? amount : 0)} ${currency}`
}

function formatPeriod(key: string, locale: Locale): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    const date = new Date(`${key}T12:00:00`)
    return new Intl.DateTimeFormat(intlLocale(locale), {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date)
  }
  if (/^\d{4}-\d{2}$/.test(key)) {
    const date = new Date(`${key}-01T12:00:00`)
    return new Intl.DateTimeFormat(intlLocale(locale), {
      month: 'short',
      year: 'numeric',
    }).format(date)
  }
  return key
}

export function buildAnalyticsPdfHtml(
  analytics: ApiAnalyticsSummary,
  rangeLabel: string,
  locale: Locale,
  labels: AnalyticsExportLabels,
  now: Date = new Date()
): string {
  const generated = new Intl.DateTimeFormat(intlLocale(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(now)

  const rows = analytics.buckets
    .map((bucket) => `<tr>
      <td>${escapeHtml(formatPeriod(bucket.key, locale))}</td>
      <td>${escapeHtml(formatMoney(bucket.revenue, locale, analytics.currency))}</td>
      <td>${escapeHtml(formatMoney(bucket.debt, locale, analytics.currency))}</td>
    </tr>`)
    .join('')

  return `<!doctype html>
  <html lang="${locale}">
    <head>
      <meta charset="utf-8" />
      <style>
        @page { size: A4 portrait; margin: 16mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #153b3a; }
        h1 { margin: 0 0 6px; font-size: 24px; }
        .meta { color: #64748b; font-size: 11px; margin-bottom: 16px; }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 18px; }
        .card { border: 1px solid #dbe7e5; border-radius: 10px; padding: 10px; }
        .card-label { color: #64748b; font-size: 9px; text-transform: uppercase; }
        .card-value { color: #0f766e; font-size: 15px; font-weight: 700; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th { background: #e6faf7; color: #115e59; font-size: 10px; text-align: left; padding: 8px; }
        td { border-bottom: 1px solid #e2e8f0; font-size: 9px; padding: 8px; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(labels.title)}</h1>
      <div class="meta">${escapeHtml(labels.range)}: ${escapeHtml(rangeLabel)} · ${escapeHtml(labels.generatedAt)}: ${escapeHtml(generated)}</div>
      <div class="summary">
        <div class="card"><div class="card-label">${escapeHtml(labels.revenue)}</div><div class="card-value">${escapeHtml(formatMoney(analytics.kpis.revenue.current, locale, analytics.currency))}</div></div>
        <div class="card"><div class="card-label">${escapeHtml(labels.debt)}</div><div class="card-value">${escapeHtml(formatMoney(analytics.kpis.debt.current, locale, analytics.currency))}</div></div>
        <div class="card"><div class="card-label">${escapeHtml(labels.patients)}</div><div class="card-value">${analytics.kpis.patients.current}</div></div>
        <div class="card"><div class="card-label">${escapeHtml(labels.visits)}</div><div class="card-value">${analytics.kpis.visits.current}</div></div>
      </div>
      <table>
        <thead><tr>
          <th>${escapeHtml(labels.period)}</th>
          <th>${escapeHtml(labels.revenue)}</th>
          <th>${escapeHtml(labels.debt)}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
  </html>`
}

export async function exportAnalyticsPdf(
  analytics: ApiAnalyticsSummary,
  rangeLabel: string,
  locale: Locale,
  labels: AnalyticsExportLabels
): Promise<void> {
  const html = buildAnalyticsPdfHtml(analytics, rangeLabel, locale, labels)

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
