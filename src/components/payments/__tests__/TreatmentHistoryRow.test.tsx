import React from 'react'
import { fireEvent } from '@testing-library/react-native'

import TreatmentHistoryRow from '../TreatmentHistoryRow'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import type { ApiTreatment } from '../../../types'

const treatment: ApiTreatment = {
  id: 'tx-1',
  patient_id: 'p-1',
  patient_name: 'Ali Valiyev',
  teeth: [11],
  treatment_type: 'Plomba',
  treatment_date: '2026-07-15',
  cost: 100,
  debt_amount: 100,
  paid_amount: 40,
  balance: 60,
  currency: 'USD',
  images: [],
  description: 'Old tish restavratsiyasi',
}

describe('TreatmentHistoryRow', () => {
  it('shows the treatment without financial labels when payments.view is unavailable', () => {
    const screen = renderWithProviders(
      <TreatmentHistoryRow treatment={treatment} showFinancials={false} />
    )

    expect(screen.getByText('Plomba')).toBeTruthy()
    expect(screen.getByText('Old tish restavratsiyasi', { exact: false })).toBeTruthy()
    expect(screen.queryByText('Ali Valiyev')).toBeNull()
    expect(screen.queryByText('Summa')).toBeNull()
    expect(screen.queryByText("To'langan")).toBeNull()
    expect(screen.queryByText('USD', { exact: false })).toBeNull()
  })

  it('shows one aligned amount, paid and remaining finance bar in treatment currency', () => {
    const screen = renderWithProviders(<TreatmentHistoryRow treatment={treatment} />)

    expect(screen.getByText('Summa')).toBeTruthy()
    expect(screen.getByText("To'langan")).toBeTruthy()
    expect(screen.getByText('Qoldiq')).toBeTruthy()
    expect(screen.getByTestId('treatment-finance-work')).toBeTruthy()
    expect(screen.getByTestId('treatment-finance-paid')).toBeTruthy()
    expect(screen.getByTestId('treatment-finance-remaining')).toBeTruthy()
    expect(screen.getByTestId('treatment-finance-bar')).toBeTruthy()
    expect(screen.getByTestId('treatment-meta-row')).toBeTruthy()
    expect(screen.getAllByText('USD', { exact: false })).toHaveLength(3)
  })

  it('exposes direct edit and secondary actions beside the compact finance strip', () => {
    const onEdit = jest.fn()
    const onDeleteActions = jest.fn()
    const screen = renderWithProviders(
      <TreatmentHistoryRow
        treatment={treatment}
        onEdit={onEdit}
        onDeleteActions={onDeleteActions}
      />
    )

    fireEvent.press(screen.getByRole('button', { name: 'Tahrirlash: Plomba' }))
    fireEvent.press(screen.getByRole('button', { name: 'Boshqa amallar: Plomba' }))

    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onDeleteActions).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('treatment-row-footer')).toBeTruthy()
    expect(screen.queryByLabelText('icon-chevron-forward')).toBeNull()
    expect(screen.queryByText('Tishlar', { exact: false })).toBeNull()
  })
})
