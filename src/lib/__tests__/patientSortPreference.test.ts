import AsyncStorage from '@react-native-async-storage/async-storage'

import {
  DEFAULT_PATIENT_LIST_SORT,
  loadPatientListSort,
  savePatientListSort,
} from '../patientSortPreference'

describe('patientSortPreference', () => {
  beforeEach(() => {
    ;(AsyncStorage.getItem as jest.Mock).mockReset()
    ;(AsyncStorage.setItem as jest.Mock).mockReset()
  })

  it('defaults to last changed when no preference exists', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null)

    await expect(loadPatientListSort('user-1')).resolves.toBe(DEFAULT_PATIENT_LIST_SORT)
  })

  it('restores a valid alphabetical preference', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('full_name')

    await expect(loadPatientListSort('user-1')).resolves.toBe('full_name')
  })

  it('rejects stale or malformed stored values', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('created_at')

    await expect(loadPatientListSort('user-1')).resolves.toBe('-updated_at')
  })

  it('stores the preference separately for each account', async () => {
    ;(AsyncStorage.setItem as jest.Mock).mockResolvedValueOnce(undefined)

    await savePatientListSort('user-2', 'full_name')

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@identa/patient_list_sort:user-2',
      'full_name'
    )
  })
})
