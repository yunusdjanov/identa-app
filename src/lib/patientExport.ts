import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import * as FileSystem from 'expo-file-system/legacy'

import type { ApiPatient } from '../types'
import type { Locale } from '../constants'
import { formatStoredPhone } from './phoneFormat'

export interface PatientExportLabels {
  title: string
  generatedAt: string
  loadedCount: string
  name: string
  phone: string
  dateOfBirth: string
  categories: string
  lastVisit: string
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

function intlLocale(locale: Locale): string {
  if (locale === 'uz') return 'uz-UZ'
  if (locale === 'ru') return 'ru-RU'
  return 'en-US'
}

function formatDate(value: string | null | undefined, locale: Locale, empty: string): string {
  if (!value) return empty
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value)
  if (Number.isNaN(date.getTime())) return empty
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function buildPatientsPdfHtml(
  patients: ApiPatient[],
  locale: Locale,
  labels: PatientExportLabels,
  now: Date = new Date()
): string {
  const rows = patients
    .map((patient) => {
      const categories = patient.categories?.map((category) => category.name).join(', ') || labels.empty
      return `<tr>
        <td>${escapeHtml(patient.full_name)}</td>
        <td>${escapeHtml(formatStoredPhone(patient.phone) || labels.empty)}</td>
        <td>${escapeHtml(formatDate(patient.date_of_birth, locale, labels.empty))}</td>
        <td>${escapeHtml(categories)}</td>
        <td>${escapeHtml(formatDate(patient.last_visit_at, locale, labels.empty))}</td>
      </tr>`
    })
    .join('')

  const generated = new Intl.DateTimeFormat(intlLocale(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(now)

  return `<!doctype html>
  <html lang="${locale}">
    <head>
      <meta charset="utf-8" />
      <style>
        @page { size: A4 landscape; margin: 18mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #153b3a; }
        h1 { margin: 0 0 6px; font-size: 24px; }
        .meta { color: #64748b; font-size: 11px; margin-bottom: 18px; }
        .count { display: inline-block; margin-left: 14px; color: #0f766e; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th { background: #e6faf7; color: #115e59; font-size: 11px; text-align: left; padding: 9px; }
        td { border-bottom: 1px solid #e2e8f0; font-size: 10px; padding: 9px; vertical-align: top; word-wrap: break-word; }
        th:nth-child(1), td:nth-child(1) { width: 25%; }
        th:nth-child(2), td:nth-child(2) { width: 19%; }
        th:nth-child(3), td:nth-child(3) { width: 15%; }
        th:nth-child(4), td:nth-child(4) { width: 24%; }
        th:nth-child(5), td:nth-child(5) { width: 17%; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(labels.title)}</h1>
      <div class="meta">
        ${escapeHtml(labels.generatedAt)}: ${escapeHtml(generated)}
        <span class="count">${escapeHtml(labels.loadedCount)}: ${patients.length}</span>
      </div>
      <table>
        <thead><tr>
          <th>${escapeHtml(labels.name)}</th>
          <th>${escapeHtml(labels.phone)}</th>
          <th>${escapeHtml(labels.dateOfBirth)}</th>
          <th>${escapeHtml(labels.categories)}</th>
          <th>${escapeHtml(labels.lastVisit)}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
  </html>`
}

export async function exportPatientsPdf(
  patients: ApiPatient[],
  locale: Locale,
  labels: PatientExportLabels
): Promise<void> {
  const html = buildPatientsPdfHtml(patients, locale, labels)

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
    // Patient exports contain personally identifiable and clinical context.
    // Remove the one-time file even when the OS share sheet is cancelled.
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {})
  }
}
