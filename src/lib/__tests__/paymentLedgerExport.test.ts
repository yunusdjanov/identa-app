import * as FileSystem from 'expo-file-system/legacy'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'

import {
  listPaymentLedgerHistory,
  type PaymentLedgerEntry,
  type PaymentLedgerPatient,
} from '../../api/payments'
import {
  buildPaymentLedgerPdfHtml,
  exportPaymentLedgerPdf,
  loadPatientLedgerForExport,
  type PaymentLedgerExportLabels,
} from '../paymentLedgerExport'

jest.mock('../../api/payments', () => ({
  listPaymentLedgerHistory: jest.fn(),
}))

jest.mock('expo-file-system/legacy', () => ({
  deleteAsync: jest.fn(),
}))

jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(),
  printAsync: jest.fn(),
}))

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}))

const patient: PaymentLedgerPatient = {
  patient_id: 'patient-1',
  patient_code: 'P-1',
  patient_name: 'Ali & Vali',
  patient_phone: '+998901234567',
  patient_secondary_phone: null,
  total_debt: 1_000_000,
  total_paid: 600_000,
  balance: 400_000,
  balances_by_currency: {
    UZS: { total_debt: 1_000_000, total_paid: 600_000, balance: 400_000 },
    USD: { total_debt: 100, total_paid: 75, balance: 25 },
  },
  entry_count: 2,
}

const firstTreatment: PaymentLedgerEntry = {
  id: 'treatment-1',
  patient_id: 'patient-1',
  work_done: 'Implant <A>',
  date: '2026-07-15',
  debt: 1_000_000,
  paid: 600_000,
  balance_delta: 400_000,
  currency: 'UZS',
}

const secondTreatment: PaymentLedgerEntry = {
  ...firstTreatment,
  id: 'treatment-2',
  work_done: 'Consultation',
  currency: 'USD',
  debt: 100,
  paid: 75,
  balance_delta: 25,
}

const labels: PaymentLedgerExportLabels = {
  title: 'Patient ledger',
  generatedAt: 'Generated',
  patient: 'Patient',
  phone: 'Phone',
  entries: 'Entries',
  date: 'Date',
  work: 'Work',
  workPrice: 'Work price',
  paid: 'Paid',
  debt: 'Debt',
  advance: 'Advance',
  totals: 'Total',
  empty: '—',
  shareTitle: 'Share ledger',
}

describe('payment ledger export', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(FileSystem.deleteAsync).mockResolvedValue(undefined)
  })

  it('loads every paginator page and keeps unique ledger entries', async () => {
    jest
      .mocked(listPaymentLedgerHistory)
      .mockResolvedValueOnce({
        data: [firstTreatment],
        meta: {
          pagination: {
            page: 1,
            total_pages: 2,
            per_page: 100,
            total: 2,
          },
          summary: {
            total_debt: 1_000_000,
            total_paid: 600_000,
            total_balance: 400_000,
            total_patients: 1,
            total_entries: 2,
            totals_by_currency: {
              UZS: {
                total_debt: 1_000_000,
                total_paid: 600_000,
                total_balance: 400_000,
              },
              USD: { total_debt: 100, total_paid: 75, total_balance: 25 },
            },
          },
        },
      })
      .mockResolvedValueOnce({
        data: [firstTreatment, secondTreatment],
        meta: {
          pagination: {
            page: 2,
            total_pages: 2,
            per_page: 100,
            total: 2,
          },
          summary: {
            total_debt: 1_000_000,
            total_paid: 600_000,
            total_balance: 400_000,
            total_patients: 1,
            total_entries: 2,
            totals_by_currency: {
              UZS: {
                total_debt: 1_000_000,
                total_paid: 600_000,
                total_balance: 400_000,
              },
              USD: { total_debt: 100, total_paid: 75, total_balance: 25 },
            },
          },
        },
      })

    await expect(loadPatientLedgerForExport('patient-1')).resolves.toEqual([
      firstTreatment,
      secondTreatment,
    ])
    expect(listPaymentLedgerHistory).toHaveBeenNthCalledWith(1, {
      patient_id: 'patient-1',
      page: 1,
      per_page: 100,
    })
    expect(listPaymentLedgerHistory).toHaveBeenNthCalledWith(2, {
      patient_id: 'patient-1',
      page: 2,
      per_page: 100,
    })
  })

  it('escapes patient data and separates UZS and USD totals in the PDF', () => {
    const html = buildPaymentLedgerPdfHtml(
      patient,
      [firstTreatment, secondTreatment],
      'en',
      labels,
      new Date('2026-07-24T08:00:00Z')
    )

    expect(html).toContain('Ali &amp; Vali')
    expect(html).toContain('Implant &lt;A&gt;')
    expect(html).toContain('Total · UZS')
    expect(html).toContain('Total · USD')
    expect(html).toContain('400,000 UZS')
    expect(html).toContain('25 USD')
  })

  it('generates and shares a PDF when native sharing is available', async () => {
    jest
      .mocked(Print.printToFileAsync)
      .mockResolvedValue({ uri: 'file:///ledger.pdf' } as never)
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true)
    jest.mocked(Sharing.shareAsync).mockResolvedValue(undefined)

    await exportPaymentLedgerPdf(
      patient,
      [firstTreatment],
      'en',
      labels
    )

    expect(Print.printToFileAsync).toHaveBeenCalledWith({
      html: expect.stringContaining('Patient ledger'),
    })
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      'file:///ledger.pdf',
      expect.objectContaining({
        mimeType: 'application/pdf',
        dialogTitle: 'Share ledger',
      })
    )
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      'file:///ledger.pdf',
      { idempotent: true }
    )
  })

  it('deletes the temporary PDF when sharing is cancelled', async () => {
    jest
      .mocked(Print.printToFileAsync)
      .mockResolvedValue({ uri: 'file:///ledger.pdf' } as never)
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true)
    jest.mocked(Sharing.shareAsync).mockRejectedValue(new Error('cancelled'))

    await expect(
      exportPaymentLedgerPdf(patient, [firstTreatment], 'en', labels)
    ).rejects.toThrow('cancelled')

    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      'file:///ledger.pdf',
      { idempotent: true }
    )
  })

  it('prints directly without creating a temporary file when sharing is unavailable', async () => {
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(false)
    jest.mocked(Print.printAsync).mockResolvedValue(undefined)

    await exportPaymentLedgerPdf(patient, [firstTreatment], 'en', labels)

    expect(Print.printAsync).toHaveBeenCalledWith({
      html: expect.stringContaining('Patient ledger'),
    })
    expect(Print.printToFileAsync).not.toHaveBeenCalled()
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled()
  })
})
