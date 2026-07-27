import React from 'react'
import { StyleSheet } from 'react-native'
import { fireEvent } from '@testing-library/react-native'

import PatientCard from '../PatientCard'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import type { ApiPatient } from '../../../types'

const patient: ApiPatient = {
  id: 'p-1',
  patient_id: 'P-0001',
  full_name: 'Aziz Karimov',
  phone: '+998901112233',
  secondary_phone: '+998977654321',
  categories: [
    { id: 'c-1', name: 'VIP', color: '#F59E0B' },
    { id: 'c-2', name: 'Ortodontiya', color: '#3B82F6' },
    { id: 'c-3', name: 'Nazorat', color: '#10B981' },
  ],
  created_by: { id: 'u-1', name: 'Doktor Ali', role: 'dentist' },
}

describe('PatientCard', () => {
  it('shows the secondary number that matched the search query', () => {
    const screen = renderWithProviders(
      <PatientCard patient={patient} searchQuery="7654321" />
    )

    expect(screen.getByText(/Qo'shimcha:/)).toBeTruthy()
    expect(screen.queryByText(/90 111 22 33/)).toBeNull()
  })

  it('keeps categories out of the compact patient list card', () => {
    const screen = renderWithProviders(<PatientCard patient={patient} />)
    expect(screen.queryByText('VIP +2')).toBeNull()
    expect(screen.queryByText('VIP')).toBeNull()
    expect(screen.queryByText('Ortodontiya')).toBeNull()
  })

  it('keeps initials at the previous visual size inside the larger avatar', () => {
    const screen = renderWithProviders(<PatientCard patient={patient} />)
    expect(StyleSheet.flatten(screen.getByText('AK').props.style)).toMatchObject({ fontSize: 16 })
  })

  it('opens row overflow without opening the patient card', () => {
    const onOpen = jest.fn()
    const onMore = jest.fn()
    const screen = renderWithProviders(
      <PatientCard
        patient={patient}
        onPress={onOpen}
        action={{
          accessibilityLabel: 'Boshqa amallar',
          onPress: onMore,
        }}
      />
    )

    fireEvent.press(screen.getByLabelText('Boshqa amallar'))

    expect(onMore).toHaveBeenCalledTimes(1)
    expect(onOpen).not.toHaveBeenCalled()
  })

})
