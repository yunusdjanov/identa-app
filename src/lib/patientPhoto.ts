import { API_URL } from '../constants'

interface PatientPhotoIdentity {
  photo_url?: string | null
  photo_thumbnail_url?: string | null
  photo_preview_url?: string | null
  photo_thumbnail_ready?: boolean
  photo_preview_ready?: boolean
  photo_scan_status?: 'pending' | 'approved' | 'rejected' | null
}

/**
 * The payment ledger intentionally returns financial fields only. Use the
 * authenticated thumbnail stream directly instead of issuing one patient
 * detail request per visible row.
 */
export function getPatientPhotoThumbnailUri(patientId: string): string | null {
  const normalizedId = patientId.trim()
  if (!normalizedId) return null
  return `${API_URL}/patients/${encodeURIComponent(normalizedId)}/photo?variant=thumbnail`
}

/**
 * Returns patient photo variants in display priority order. The backend can
 * expose a variant URL before the queued thumbnail/preview file is ready, so
 * callers must retain the original image as a fallback.
 */
export function getPatientPhotoUris(
  patient: PatientPhotoIdentity | null | undefined
): string[] {
  if (
    !patient ||
    patient.photo_scan_status === 'pending' ||
    patient.photo_scan_status === 'rejected'
  ) {
    return []
  }

  const candidates = [
    patient.photo_thumbnail_ready === false ? null : patient.photo_thumbnail_url,
    patient.photo_preview_ready === false ? null : patient.photo_preview_url,
    patient.photo_url,
  ]

  return candidates.filter(
    (value, index): value is string =>
      typeof value === 'string' && value.length > 0 && candidates.indexOf(value) === index
  )
}
