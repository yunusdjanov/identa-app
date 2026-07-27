import React from 'react'
import { fireEvent } from '@testing-library/react-native'

import PatientGeneralPhotos from '../PatientGeneralPhotos'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import type { ApiPatientClinicalPhoto } from '../../../types'

const approved: ApiPatientClinicalPhoto = {
  id: 'photo-approved',
  view_type: 'smile',
  scan_status: 'approved',
  url: 'https://cdn.example.test/approved.jpg',
  sort_order: 0,
}

const pending: ApiPatientClinicalPhoto = {
  id: 'photo-pending',
  view_type: 'smile',
  scan_status: 'pending',
  sort_order: 1,
}

describe('PatientGeneralPhotos', () => {
  it('shows existing photos plus one add tile and counts only approved photos', () => {
    const screen = renderWithProviders(
      <PatientGeneralPhotos
        photos={[approved, pending]}
        canManage
        onAdd={jest.fn()}
        onPressPhoto={jest.fn()}
      />
    )

    expect(screen.getByText('UMUMIY RASMLAR')).toBeTruthy()
    expect(screen.getByText('1/10')).toBeTruthy()
    expect(screen.getAllByTestId(/^general-photo-empty-/)).toHaveLength(1)
    expect(screen.getByText('Tekshiruvda')).toBeTruthy()
  })

  it('exposes add and preview while keeping management actions out of the grid', () => {
    const onAdd = jest.fn()
    const onPressPhoto = jest.fn()
    const screen = renderWithProviders(
      <PatientGeneralPhotos
        photos={[approved]}
        canManage
        onAdd={onAdd}
        onPressPhoto={onPressPhoto}
      />
    )

    fireEvent.press(screen.getByTestId('general-photo-empty-1'))
    fireEvent.press(screen.getByTestId('general-photo-0'))

    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onPressPhoto).toHaveBeenCalledWith(approved)
    expect(screen.queryByLabelText('Rasmni o\'chirish')).toBeNull()
  })

  it('keeps all empty slots read-only when the user cannot manage patients', () => {
    const onAdd = jest.fn()
    const screen = renderWithProviders(
      <PatientGeneralPhotos
        photos={[]}
        canManage={false}
        onAdd={onAdd}
        onPressPhoto={jest.fn()}
      />
    )

    fireEvent.press(screen.getByTestId('general-photo-empty-0'))
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('keeps preview available while management actions are disabled', () => {
    const onPressPhoto = jest.fn()
    const screen = renderWithProviders(
      <PatientGeneralPhotos
        photos={[approved]}
        canManage
        manageDisabled
        onAdd={jest.fn()}
        onPressPhoto={onPressPhoto}
      />
    )

    fireEvent.press(screen.getByTestId('general-photo-0'))
    expect(onPressPhoto).toHaveBeenCalledWith(approved)
  })
})
