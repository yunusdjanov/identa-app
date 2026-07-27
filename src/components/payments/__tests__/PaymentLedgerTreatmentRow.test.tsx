import React from 'react'

import PaymentLedgerTreatmentRow from '../PaymentLedgerTreatmentRow'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import type { PaymentLedgerEntry } from '../../../api/payments'

const treatment: PaymentLedgerEntry = {
  id: 'treatment-1',
  patient_id: 'patient-1',
  work_done: 'Restavratsiya',
  date: '2026-07-15',
  debt: 100,
  paid: 40,
  balance_delta: 60,
  currency: 'USD',
}

describe('<PaymentLedgerTreatmentRow />', () => {
  it('shows the mobile ledger fields from the canonical treatment finance values', () => {
    const screen = renderWithProviders(
      <PaymentLedgerTreatmentRow treatment={treatment} />
    )

    expect(screen.getByText('Restavratsiya')).toBeTruthy()
    expect(screen.getByText(/15[./]07[./]2026/)).toBeTruthy()
    expect(screen.getByText('Ish narxi')).toBeTruthy()
    expect(screen.getByText("To'langan")).toBeTruthy()
    expect(screen.getByText('Qarz')).toBeTruthy()
    expect(screen.getByText('100', { exact: false })).toBeTruthy()
    expect(screen.getByText('40', { exact: false })).toBeTruthy()
    expect(screen.getByText('60', { exact: false })).toBeTruthy()
    expect(screen.getAllByText('USD', { exact: false })).toHaveLength(3)
  })

  it('renders overpayment as an advance instead of negative debt', () => {
    const screen = renderWithProviders(
      <PaymentLedgerTreatmentRow
        treatment={{ ...treatment, paid: 120, balance_delta: -20 }}
      />
    )

    expect(screen.getByText('Avans')).toBeTruthy()
    expect(screen.queryByText('-20', { exact: false })).toBeNull()
    expect(screen.getByTestId('ledger-metric-advance')).toBeTruthy()
  })
})
