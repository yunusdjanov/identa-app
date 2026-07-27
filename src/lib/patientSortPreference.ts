import AsyncStorage from '@react-native-async-storage/async-storage'

export type PatientListSort = 'full_name' | '-updated_at'

export const DEFAULT_PATIENT_LIST_SORT: PatientListSort = '-updated_at'

const STORAGE_KEY_PREFIX = '@identa/patient_list_sort'

function storageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}:${userId}`
}

function isPatientListSort(value: string | null): value is PatientListSort {
  return value === 'full_name' || value === '-updated_at'
}

export async function loadPatientListSort(userId: string | null | undefined): Promise<PatientListSort> {
  if (!userId) return DEFAULT_PATIENT_LIST_SORT
  try {
    const stored = await AsyncStorage.getItem(storageKey(userId))
    return isPatientListSort(stored) ? stored : DEFAULT_PATIENT_LIST_SORT
  } catch {
    return DEFAULT_PATIENT_LIST_SORT
  }
}

export async function savePatientListSort(
  userId: string | null | undefined,
  sort: PatientListSort
): Promise<void> {
  if (!userId) return
  await AsyncStorage.setItem(storageKey(userId), sort)
}
