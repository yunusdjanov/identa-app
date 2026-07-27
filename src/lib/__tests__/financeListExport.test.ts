import * as FileSystem from 'expo-file-system/legacy'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'

import {
  listPaymentLedgerPatients,
  type PaymentLedgerPatient,
} from '../../api/payments'
import {
  buildPaymentPatientsPdfHtml,
  exportFinanceListPdf,
  loadPaymentPatientsForExport,
  type FinanceListExportLabels,
} from '../financeListExport'

jest.mock('../../api/payments', () => ({
  listPaymentLedgerPatients: jest.fn(),
  listPaymentExpenses: jest.fn(),
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
  patient_name: 'Ali & Vali',
  patient_phone: '+998901234567',
  total_debt: 100,
  total_paid: 120,
  balance: -20,
  balances_by_currency: {
    UZS: { total_debt: 100, total_paid: 120, balance: -20 },
    USD: { total_debt: 0, total_paid: 0, balance: 0 },
  },
  entry_count: 2,
}

const labels: FinanceListExportLabels = {
  title: 'Payments',
  generatedAt: 'Generated',
  patient: 'Patient',
  phone: 'Phone',
  entries: 'Entries',
  workPrice: 'Work price',
  paid: 'Paid',
  balance: 'Balance',
  debt: 'Debt',
  advance: 'Advance',
  date: 'Date',
  expense: 'Expense',
  quantity: 'Quantity',
  amount: 'Amount',
  empty: 'None',
  shareTitle: 'Share finance PDF',
}

describe('finance list export', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(FileSystem.deleteAsync).mockResolvedValue(undefined)
  })

  it('loads all bounded patient-ledger pages with active filters', async () => {
    jest
      .mocked(listPaymentLedgerPatients)
      .mockResolvedValueOnce({
        data: [patient],
        meta: {
          pagination: { page: 1, per_page: 100, total: 2, total_pages: 2 },
          summary: {} as never,
        },
      })
      .mockResolvedValueOnce({
        data: [{ ...patient, patient_id: 'patient-2' }],
        meta: {
          pagination: { page: 2, per_page: 100, total: 2, total_pages: 2 },
          summary: {} as never,
        },
      })

    await expect(
      loadPaymentPatientsForExport({
        search: 'Ali',
        outstanding: true,
      })
    ).resolves.toHaveLength(2)
    expect(listPaymentLedgerPatients).toHaveBeenNthCalledWith(2, {
      search: 'Ali',
      outstanding: true,
      page: 2,
      per_page: 100,
    })
  })

  it('escapes PII and labels an overpayment as advance', () => {
    const html = buildPaymentPatientsPdfHtml(
      [patient],
      'en',
      labels,
      new Date('2026-07-26T08:00:00Z')
    )

    expect(html).toContain('Ali &amp; Vali')
    expect(html).toContain('Advance: 20 UZS')
    expect(html).not.toContain('Balance: -20')
  })

  it('cleans up the temporary PDF when sharing is cancelled', async () => {
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true)
    jest
      .mocked(Print.printToFileAsync)
      .mockResolvedValue({ uri: 'file:///finance.pdf' } as never)
    jest.mocked(Sharing.shareAsync).mockRejectedValue(new Error('cancelled'))

    await expect(
      exportFinanceListPdf('<html />', labels.shareTitle)
    ).rejects.toThrow('cancelled')
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      'file:///finance.pdf',
      { idempotent: true }
    )
  })

  it('does not create a temporary file when native sharing is unavailable', async () => {
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(false)
    jest.mocked(Print.printAsync).mockResolvedValue(undefined)

    await exportFinanceListPdf('<html />', labels.shareTitle)

    expect(Print.printAsync).toHaveBeenCalledWith({ html: '<html />' })
    expect(Print.printToFileAsync).not.toHaveBeenCalled()
  })
})
