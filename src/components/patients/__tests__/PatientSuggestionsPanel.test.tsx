import React from 'react'
import { fireEvent } from '@testing-library/react-native'

import PatientSuggestionsPanel from '../PatientSuggestionsPanel'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'

describe('PatientSuggestionsPanel', () => {
  it('renders a compact three-patient directory result with optional contact details', () => {
    const onSelect = jest.fn()
    const patients = Array.from({ length: 4 }, (_, index) => ({
      id: `patient-${index + 1}`,
      full_name: `Patient ${index + 1}`,
      phone: `+99890000000${index + 1}`,
    }))
    const screen = renderWithProviders(
      <PatientSuggestionsPanel
        patients={patients}
        title="Yaqinda yangilanganlar"
        onSelect={onSelect}
      />
    )

    expect(screen.getByText('Yaqinda yangilanganlar')).toBeTruthy()
    expect(screen.getByText('+998900000001')).toBeTruthy()
    expect(screen.getByText('Patient 3')).toBeTruthy()
    expect(screen.queryByText('Patient 4')).toBeNull()
    expect(screen.queryByText('Tozalash')).toBeNull()

    fireEvent.press(screen.getByLabelText('Patient 2, +998900000002'))
    expect(onSelect).toHaveBeenCalledWith(patients[1])
  })
})
