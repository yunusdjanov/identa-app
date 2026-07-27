import * as FileSystem from 'expo-file-system/legacy'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'

import { exportAnalyticsPdf, type AnalyticsExportLabels } from '../analyticsExport'
import type { ApiAnalyticsSummary } from '../../types'

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

const labels: AnalyticsExportLabels = {
  title: 'Analytics',
  range: 'Range',
  generatedAt: 'Generated',
  period: 'Period',
  revenue: 'Revenue',
  debt: 'Debt',
  patients: 'Patients',
  visits: 'Visits',
  shareTitle: 'Share',
}

const analytics: ApiAnalyticsSummary = {
  currency: 'UZS',
  permissions: { payments: true, patients: true, appointments: true },
  kpis: {
    revenue: { current: 1, previous: 0 },
    debt: { current: 0, previous: null },
    patients: { current: 0, previous: 0 },
    visits: { current: 0, previous: 0 },
  },
  buckets: [],
  appointment_status: [],
  top_debtors: [],
}

describe('exportAnalyticsPdf lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(FileSystem.deleteAsync).mockResolvedValue(undefined)
    jest.mocked(Print.printToFileAsync).mockResolvedValue({
      uri: 'file:///cache/analytics.pdf',
      numberOfPages: 1,
      base64: undefined,
    })
  })

  it('deletes the temporary analytics PDF after sharing', async () => {
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true)
    jest.mocked(Sharing.shareAsync).mockResolvedValue(undefined)

    await exportAnalyticsPdf(analytics, '30 days', 'en', labels)

    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      'file:///cache/analytics.pdf',
      { idempotent: true }
    )
  })

  it('deletes the temporary analytics PDF when sharing is cancelled', async () => {
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true)
    jest.mocked(Sharing.shareAsync).mockRejectedValue(new Error('cancelled'))

    await expect(
      exportAnalyticsPdf(analytics, '30 days', 'en', labels)
    ).rejects.toThrow('cancelled')
    expect(FileSystem.deleteAsync).toHaveBeenCalled()
  })

  it('prints directly without creating a temp file when sharing is unavailable', async () => {
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(false)
    jest.mocked(Print.printAsync).mockResolvedValue(undefined)

    await exportAnalyticsPdf(analytics, '30 days', 'en', labels)

    expect(Print.printAsync).toHaveBeenCalled()
    expect(Print.printToFileAsync).not.toHaveBeenCalled()
  })
})
