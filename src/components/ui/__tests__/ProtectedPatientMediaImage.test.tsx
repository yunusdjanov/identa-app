import React from 'react'
import { Image } from 'react-native'
import { render, waitFor } from '@testing-library/react-native'

import ProtectedPatientMediaImage from '../ProtectedPatientMediaImage'
import { API_URL } from '../../../constants'
import { loadProtectedPatientPhoto } from '../../../lib/protectedPatientPhoto'
import { useAuthStore } from '../../../stores/auth'

jest.mock('../../../lib/protectedPatientPhoto', () => ({
  ...jest.requireActual('../../../lib/protectedPatientPhoto'),
  loadProtectedPatientPhoto: jest.fn(),
  clearProtectedPatientPhotoCache: jest.fn(() => Promise.resolve()),
}))

describe('ProtectedPatientMediaImage', () => {
  const mockLoad = jest.mocked(loadProtectedPatientPhoto)

  beforeEach(() => {
    mockLoad.mockReset()
    mockLoad.mockResolvedValue('file:///cache/treatment-image.img')
    useAuthStore.setState({
      user: {
        id: 'user-1',
        name: 'Dentist',
        email: 'dentist@example.test',
        role: 'dentist',
        account_status: 'active',
      },
      tokens: {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        token_type: 'Bearer',
        expires_in: 900,
        refresh_expires_in: 2592000,
      },
    })
  })

  it('downloads same-origin patient media before rendering it', async () => {
    const remoteUri = `${API_URL}/patients/p-1/treatments/t-1/images/i-1`
    const screen = render(
      <ProtectedPatientMediaImage uri={remoteUri} style={{ width: 60, height: 60 }} />
    )

    await waitFor(() => {
      expect(screen.UNSAFE_getByType(Image).props.source).toEqual({
        uri: 'file:///cache/treatment-image.img',
      })
    })
    expect(mockLoad).toHaveBeenCalledWith(remoteUri, 'access-token', 'user-1')
  })

  it('renders external signed media directly without exposing the bearer token', () => {
    const uri = 'https://cdn.example.test/signed-patient-image.jpg'
    const screen = render(
      <ProtectedPatientMediaImage uri={uri} style={{ width: 60, height: 60 }} />
    )

    expect(screen.UNSAFE_getByType(Image).props.source).toEqual({ uri })
    expect(mockLoad).not.toHaveBeenCalled()
  })
})
