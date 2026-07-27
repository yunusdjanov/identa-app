import * as FileSystem from 'expo-file-system/legacy'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'

import {
  exportAppointmentsPdf,
  type AppointmentExportLabels,
} from '../appointmentExport'

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

const labels: AppointmentExportLabels = {
  title: 'Appointments',
  generatedAt: 'Generated',
  loadedCount: 'Count',
  dateTime: 'Date',
  patient: 'Patient',
  reason: 'Reason',
  status: 'Status',
  empty: '—',
  shareTitle: 'Share',
  statuses: {
    scheduled: 'Scheduled',
    completed: 'Completed',
    cancelled: 'Cancelled',
    no_show: 'No show',
  },
}

describe('exportAppointmentsPdf lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(FileSystem.deleteAsync).mockResolvedValue(undefined)
    jest.mocked(Print.printToFileAsync).mockResolvedValue({
      uri: 'file:///cache/appointments.pdf',
      numberOfPages: 1,
      base64: undefined,
    })
  })

  it('deletes the sensitive temporary PDF after sharing', async () => {
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true)
    jest.mocked(Sharing.shareAsync).mockResolvedValue(undefined)

    await exportAppointmentsPdf([], 'uz', labels)

    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      'file:///cache/appointments.pdf',
      expect.objectContaining({ mimeType: 'application/pdf' })
    )
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      'file:///cache/appointments.pdf',
      { idempotent: true }
    )
  })

  it('also deletes the temporary PDF when sharing fails', async () => {
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true)
    jest.mocked(Sharing.shareAsync).mockRejectedValue(new Error('cancelled'))

    await expect(exportAppointmentsPdf([], 'uz', labels)).rejects.toThrow('cancelled')
    expect(FileSystem.deleteAsync).toHaveBeenCalled()
  })

  it('prints directly without generating a redundant cache file', async () => {
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(false)
    jest.mocked(Print.printAsync).mockResolvedValue(undefined)

    await exportAppointmentsPdf([], 'uz', labels)

    expect(Print.printAsync).toHaveBeenCalled()
    expect(Print.printToFileAsync).not.toHaveBeenCalled()
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled()
  })
})
