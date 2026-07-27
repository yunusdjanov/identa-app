interface PatientSearchIdentity {
  full_name: string
  phone?: string | null
  secondary_phone?: string | null
}

// Patient pickers are suggestion surfaces, not full directory views. Keeping
// this shared prevents the planner and appointment sheet from drifting apart.
export const PATIENT_SUGGESTION_LIMIT = 3

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Mirrors the patient combobox: names use normalized text matching,
 * while phone searches ignore spaces, punctuation and the leading plus.
 */
export function patientMatchesSearch(
  patient: PatientSearchIdentity,
  search: string
): boolean {
  const query = normalize(search)
  if (!query) return true

  const haystack = normalize(
    [
      patient.full_name,
      patient.phone ?? '',
      patient.secondary_phone ?? '',
    ].join(' ')
  )
  if (haystack.includes(query)) return true

  const queryDigits = query.replace(/\D/g, '')
  return queryDigits.length > 0 && haystack.replace(/\D/g, '').includes(queryDigits)
}
