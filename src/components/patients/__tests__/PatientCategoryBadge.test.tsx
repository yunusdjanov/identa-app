import React from 'react'

import PatientCategoryBadge from '../PatientCategoryBadge'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'

describe('PatientCategoryBadge', () => {
  it('keeps multiple categories compact under the patient name', () => {
    const screen = renderWithProviders(
      <PatientCategoryBadge
        category={{ id: 'cat-vip', name: 'VIP', color: '#F59E0B' }}
        additionalCount={2}
      />
    )

    expect(screen.getByText('VIP +2')).toBeTruthy()
    expect(screen.getByLabelText('VIP +2')).toBeTruthy()
  })
})
