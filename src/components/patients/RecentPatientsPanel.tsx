import React from 'react'

import PatientSuggestionsPanel, {
  PATIENT_SUGGESTION_DISPLAY_LIMIT,
  type PatientSuggestionItem,
} from './PatientSuggestionsPanel'
import { useI18n } from '../../i18n'
import type { ApiRecentPatient } from '../../api/patients'

export const RECENT_PATIENT_DISPLAY_LIMIT = PATIENT_SUGGESTION_DISPLAY_LIMIT

interface Props {
  patients: RecentPatientItem[]
  clearing?: boolean
  onSelect: (patient: RecentPatientItem) => void
  onClear: () => void
  onDismiss: () => void
}

export interface RecentPatientItem extends ApiRecentPatient, PatientSuggestionItem {}

export default function RecentPatientsPanel({
  patients,
  clearing,
  onSelect,
  onClear,
  onDismiss,
}: Props) {
  const { t } = useI18n()

  return (
    <PatientSuggestionsPanel
      patients={patients}
      title={t('patients.recent.title')}
      clearing={clearing}
      onSelect={onSelect}
      onClear={onClear}
      onDismiss={onDismiss}
    />
  )
}
