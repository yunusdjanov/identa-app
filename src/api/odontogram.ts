import client from './client'
import type {
  ApiOdontogramEntry,
  ApiOdontogramSummary,
  ApiListResponse,
  ApiResponse,
} from '../types'

// Odontogram (per-tooth condition timeline) API.
//
// The web app rebuilds the odontogram view from the treatments collection
// (using `treatment.teeth[]`), but the backend ALSO exposes a dedicated
// odontogram entries table. The dedicated table is the source of truth for
// "latest condition per tooth" — treatments may carry teeth purely for
// accounting purposes even if no condition change happened — so the
// standalone odontogram screen prefers it.
//
// Both endpoints return a hierarchical envelope (`{ data: ... }`); we strip
// it here so consumers work with plain arrays / objects.

export async function listPatientOdontogram(
  patientId: string
): Promise<ApiOdontogramEntry[]> {
  const r = await client.get<ApiListResponse<ApiOdontogramEntry>>(
    `/patients/${patientId}/odontogram`
  )
  return r.data.data
}

export async function getPatientOdontogramSummary(
  patientId: string
): Promise<ApiOdontogramSummary> {
  const r = await client.get<ApiResponse<ApiOdontogramSummary>>(
    `/patients/${patientId}/odontogram/summary`
  )
  return r.data.data
}
