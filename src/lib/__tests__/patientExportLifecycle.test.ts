import * as FileSystem from 'expo-file-system/legacy'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'

import { exportPatientsPdf, type PatientExportLabels } from '../patientExport'

jest.mock('expo-file-system/legacy', () => ({
  deleteAsync: jest.fn(),
}))
jest.mock('expo-print', () => ({
  printAsync: jest.fn(),
  printToFileAsync: jest.fn(),
}))
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}))

const labels: PatientExportLabels = {
  title: 'Patients',
  generatedAt: 'Generated',
  loadedCount: 'Count',
  name: 'Patient',
  phone: 'Phone',
  dateOfBirth: 'Date of birth',
  categories: 'Categories',
  lastVisit: 'Last visit',
  empty: '—',
  shareTitle: 'Share',
}

describe('exportPatientsPdf lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(FileSystem.deleteAsync).mockResolvedValue(undefined)
    jest.mocked(Print.printToFileAsync).mockResolvedValue({
      uri: 'file:///cache/patients.pdf',
      numberOfPages: 1,
      base64: undefined,
    })
  })

  it('deletes the temporary patient PDF after sharing', async () => {
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true)
    jest.mocked(Sharing.shareAsync).mockResolvedValue(undefined)

    await exportPatientsPdf([], 'uz', labels)

    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      'file:///cache/patients.pdf',
      { idempotent: true }
    )
  })

  it('deletes the temporary patient PDF when sharing fails', async () => {
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true)
    jest.mocked(Sharing.shareAsync).mockRejectedValue(new Error('cancelled'))

    await expect(exportPatientsPdf([], 'uz', labels)).rejects.toThrow('cancelled')
    expect(FileSystem.deleteAsync).toHaveBeenCalled()
  })

  it('prints directly when native sharing is unavailable', async () => {
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(false)
    jest.mocked(Print.printAsync).mockResolvedValue(undefined)

    await exportPatientsPdf([], 'uz', labels)

    expect(Print.printAsync).toHaveBeenCalled()
    expect(Print.printToFileAsync).not.toHaveBeenCalled()
  })
})
