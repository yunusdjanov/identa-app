import React from 'react'
import { fireEvent } from '@testing-library/react-native'

import LightboxViewer from '../LightboxViewer'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'

describe('LightboxViewer', () => {
  it('places optional image management behind the top overflow action', () => {
    const onMore = jest.fn()
    const screen = renderWithProviders(
      <LightboxViewer
        visible
        uris={['file:///photo.jpg']}
        onClose={jest.fn()}
        moreLabel="Rasm amallari"
        onMore={onMore}
      />
    )

    fireEvent.press(screen.getByLabelText('Rasm amallari'))
    expect(onMore).toHaveBeenCalledTimes(1)
  })

  it('does not render an overflow action for read-only previews', () => {
    const screen = renderWithProviders(
      <LightboxViewer
        visible
        uris={['file:///photo.jpg']}
        onClose={jest.fn()}
      />
    )

    expect(screen.queryByLabelText('Boshqa amallar')).toBeNull()
  })
})
