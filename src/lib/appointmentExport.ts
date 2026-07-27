import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import * as FileSystem from 'expo-file-system/legacy'

import type { Locale } from '../constants'
import type { ApiAppointment } from '../types'

export interface AppointmentExportLabels {
  title: string
  generatedAt: string
  loadedCount: string
  dateTime: string
  patient: string
  reason: string
  status: string
  empty: string
  shareTitle: string
  statuses: Record<ApiAppointment['status'], string>
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

function dateTimeLabel(appointment: ApiAppointment, locale: Locale): string {
  const date = new Date(`${appointment.appointment_date}T12:00:00`)
  const formattedDate = Number.isNaN(date.getTime())
    ? appointment.appointment_date
    : new Intl.DateTimeFormat(intlLocale(locale), {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(date)
  return `${formattedDate} · ${appointment.start_time.slice(0, 5)}–${appointment.end_time.slice(0, 5)}`
}

export function buildAppointmentsPdfHtml(
  appointments: ApiAppointment[],
  locale: Locale,
  labels: AppointmentExportLabels,
  now: Date = new Date()
): string {
  const rows = [...appointments]
    .sort((a, b) =>
      `${a.appointment_date} ${a.start_time}`.localeCompare(
        `${b.appointment_date} ${b.start_time}`
      )
    )
    .map(
      (appointment) => `<tr>
        <td>${escapeHtml(dateTimeLabel(appointment, locale))}</td>
        <td>${escapeHtml(
          appointment.patient_name?.trim() ||
          appointment.guest_name?.trim() ||
          labels.empty
        )}</td>
        <td>${escapeHtml(appointment.notes?.trim() || labels.empty)}</td>
        <td>${escapeHtml(labels.statuses[appointment.status])}</td>
      </tr>`
    )
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
        th:nth-child(2), td:nth-child(2) { width: 25%; }
        th:nth-child(3), td:nth-child(3) { width: 32%; }
        th:nth-child(4), td:nth-child(4) { width: 18%; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(labels.title)}</h1>
      <div class="meta">
        ${escapeHtml(labels.generatedAt)}: ${escapeHtml(generated)}
        <span class="count">${escapeHtml(labels.loadedCount)}: ${appointments.length}</span>
      </div>
      <table>
        <thead><tr>
          <th>${escapeHtml(labels.dateTime)}</th>
          <th>${escapeHtml(labels.patient)}</th>
          <th>${escapeHtml(labels.reason)}</th>
          <th>${escapeHtml(labels.status)}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
  </html>`
}

export async function exportAppointmentsPdf(
  appointments: ApiAppointment[],
  locale: Locale,
  labels: AppointmentExportLabels
): Promise<void> {
  const html = buildAppointmentsPdfHtml(appointments, locale, labels)

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
    // The PDF contains patient names and clinical notes. Do not leave it in
    // Expo's cache after the OS share sheet finishes or is cancelled.
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {})
  }
}
