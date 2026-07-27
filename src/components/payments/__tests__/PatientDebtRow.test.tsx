import React from 'react'

import PatientDebtRow from '../PatientDebtRow'
import PatientAvatar from '../../ui/PatientAvatar'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'

describe('PatientDebtRow', () => {
  it('renders UZS and USD balances separately', () => {
    const screen = renderWithProviders(
      <PatientDebtRow
        data={{
          patientId: 'p-1',
          patientName: 'Ali Valiyev',
          patientPhone: '+998901234567',
          totalDebt: 75000,
          totalPaid: 25000,
          balance: 50000,
          entryCount: 2,
          balancesByCurrency: {
            UZS: { total_debt: 75000, total_paid: 25000, balance: 50000 },
            USD: { total_debt: 100, total_paid: 40, balance: 60 },
          },
        }}
      />
    )

    expect(screen.getByText('50', { exact: false })).toBeTruthy()
    expect(screen.getByText("ming so'm", { exact: false })).toBeTruthy()
    expect(screen.getByText('60', { exact: false })).toBeTruthy()
    expect(screen.getByText('USD', { exact: false })).toBeTruthy()
    expect(screen.queryByText('Qoldiq')).toBeNull()
    expect(screen.getByText('Qarz')).toBeTruthy()
    expect(screen.getByText('2 ta yozuv')).toBeTruthy()
  })

  it('labels a negative balance as an advance without showing a minus sign', () => {
    const screen = renderWithProviders(
      <PatientDebtRow
        data={{
          patientId: 'p-2',
          patientName: 'Lola Karimova',
          totalDebt: 0,
          totalPaid: 200000,
          balance: -200000,
          entryCount: 1,
          balancesByCurrency: {
            UZS: { total_debt: 0, total_paid: 200000, balance: -200000 },
            USD: { total_debt: 0, total_paid: 0, balance: 0 },
          },
        }}
      />
    )

    expect(screen.getByText('Avans')).toBeTruthy()
    expect(screen.queryByText('-200', { exact: false })).toBeNull()
  })

  it('keeps the entry count but does not render the last ledger date', () => {
    const screen = renderWithProviders(
      <PatientDebtRow
        data={{
          patientId: 'p-4',
          patientName: 'Malika Oripova',
          totalDebt: 500000,
          totalPaid: 300000,
          balance: 200000,
          entryCount: 7,
          balancesByCurrency: {
            UZS: { total_debt: 500000, total_paid: 300000, balance: 200000 },
            USD: { total_debt: 0, total_paid: 0, balance: 0 },
          },
        }}
      />
    )

    expect(screen.getByText('7 ta yozuv')).toBeTruthy()
    expect(screen.queryByText(/Oxirgi/)).toBeNull()
  })

  it('passes the protected patient thumbnail to the shared avatar', () => {
    const photoUri = 'https://api.example.test/patients/p-3/photo?variant=thumbnail'
    const screen = renderWithProviders(
      <PatientDebtRow
        data={{
          patientId: 'p-3',
          patientName: 'Aziza Karimova',
          patientPhotoUri: photoUri,
          totalDebt: 0,
          totalPaid: 0,
          balance: 0,
          entryCount: 0,
          balancesByCurrency: {
            UZS: { total_debt: 0, total_paid: 0, balance: 0 },
            USD: { total_debt: 0, total_paid: 0, balance: 0 },
          },
        }}
      />
    )

    expect(screen.UNSAFE_getByType(PatientAvatar).props.uri).toBe(photoUri)
  })
})
