import React from 'react'
import { fireEvent } from '@testing-library/react-native'

import RecentPatientsPanel from '../RecentPatientsPanel'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import type { RecentPatientItem } from '../RecentPatientsPanel'

const patients: RecentPatientItem[] = Array.from({ length: 5 }, (_, index) => ({
  id: `patient-${index + 1}`,
  full_name: `Patient ${index + 1}`,
}))

describe('RecentPatientsPanel', () => {
  it('shows only the three most recently opened patients', () => {
    const screen = renderWithProviders(
      <RecentPatientsPanel
        patients={patients}
        onSelect={jest.fn()}
        onClear={jest.fn()}
        onDismiss={jest.fn()}
      />
    )

    expect(screen.getByText('Patient 1')).toBeTruthy()
    expect(screen.getByText('Patient 3')).toBeTruthy()
    expect(screen.queryByText('Patient 4')).toBeNull()
  })

  it('supports selecting a patient and clearing the list', () => {
    const onSelect = jest.fn()
    const onClear = jest.fn()
    const onDismiss = jest.fn()
    const screen = renderWithProviders(
      <RecentPatientsPanel
        patients={patients}
        onSelect={onSelect}
        onClear={onClear}
        onDismiss={onDismiss}
      />
    )

    fireEvent.press(screen.getByText('Patient 2'))
    fireEvent.press(screen.getByText('Tozalash'))
    fireEvent.press(screen.getByLabelText('Yopish'))

    expect(onSelect).toHaveBeenCalledWith(patients[1])
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('renders a patient photo when an approved image is available', () => {
    const screen = renderWithProviders(
      <RecentPatientsPanel
        patients={[
          {
            ...patients[0]!,
            photo_url: 'https://cdn.example.test/patient.jpg',
            photo_scan_status: 'approved',
          },
        ]}
        onSelect={jest.fn()}
        onClear={jest.fn()}
        onDismiss={jest.fn()}
      />
    )

    expect(screen.getAllByLabelText('Patient 1')).toHaveLength(2)
  })
})
