import React from 'react'
import { Image } from 'react-native'
import { fireEvent, render, waitFor } from '@testing-library/react-native'

import PatientAvatar from '../PatientAvatar'
import { API_URL } from '../../../constants'
import { loadProtectedPatientPhoto } from '../../../lib/protectedPatientPhoto'
import { useAuthStore } from '../../../stores/auth'

jest.mock('../../../lib/protectedPatientPhoto', () => ({
  ...jest.requireActual('../../../lib/protectedPatientPhoto'),
  loadProtectedPatientPhoto: jest.fn(),
  clearProtectedPatientPhotoCache: jest.fn(() => Promise.resolve()),
}))

describe('PatientAvatar', () => {
  const mockLoadProtectedPatientPhoto = jest.mocked(loadProtectedPatientPhoto)

  beforeEach(() => {
    mockLoadProtectedPatientPhoto.mockReset()
    mockLoadProtectedPatientPhoto.mockResolvedValue('file:///cache/patient-photo.img')
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

  it('downloads protected patient photos before rendering a local image', async () => {
    const remoteUri = `${API_URL}/patients/p-1/photo`
    const screen = render(<PatientAvatar name="Aziz Karimov" uri={remoteUri} />)

    await waitFor(() => {
      expect(screen.UNSAFE_getByType(Image).props.source).toEqual({
        uri: 'file:///cache/patient-photo.img',
        headers: undefined,
      })
    })
    expect(mockLoadProtectedPatientPhoto).toHaveBeenCalledWith(
      remoteUri,
      'access-token',
      'user-1'
    )
  })

  it('falls back to initials when the downloaded image cannot be decoded', async () => {
    const screen = render(
      <PatientAvatar name="Aziz Karimov" uri={`${API_URL}/patients/p-1/photo`} />
    )

    await waitFor(() => expect(screen.UNSAFE_getByType(Image)).toBeTruthy())
    fireEvent(screen.UNSAFE_getByType(Image), 'error')

    expect(screen.getByText('AK')).toBeTruthy()
  })

  it('falls back from an unavailable thumbnail to the original photo', async () => {
    const thumbnail = `${API_URL}/patients/p-1/photo?variant=thumbnail`
    const original = `${API_URL}/patients/p-1/photo`
    mockLoadProtectedPatientPhoto
      .mockRejectedValueOnce(new Error('thumbnail missing'))
      .mockResolvedValueOnce('file:///cache/original.img')

    const screen = render(
      <PatientAvatar name="Aziz Karimov" uri={[thumbnail, original]} />
    )

    await waitFor(() => {
      expect(mockLoadProtectedPatientPhoto).toHaveBeenCalledTimes(2)
      expect(screen.UNSAFE_getByType(Image).props.source.uri).toBe('file:///cache/original.img')
    })
    expect(mockLoadProtectedPatientPhoto).toHaveBeenNthCalledWith(
      2,
      original,
      'access-token',
      'user-1'
    )
  })

  it('rebases backend-generated photo URLs before authenticated download', async () => {
    const screen = render(
      <PatientAvatar
        name="Aziz Karimov"
        uri="http://internal-backend:8000/api/v1/patients/p-1/photo?v=1"
      />
    )

    await waitFor(() => expect(screen.UNSAFE_getByType(Image)).toBeTruthy())
    expect(mockLoadProtectedPatientPhoto).toHaveBeenCalledWith(
      `${API_URL}/patients/p-1/photo?v=1`,
      'access-token',
      'user-1'
    )
  })

  it('does not send external images through the authenticated downloader', () => {
    const screen = render(
      <PatientAvatar name="Aziz Karimov" uri="https://cdn.example.com/patient.jpg" />
    )

    expect(screen.UNSAFE_getByType(Image).props.source).toEqual({
      uri: 'https://cdn.example.com/patient.jpg',
      headers: undefined,
    })
    expect(mockLoadProtectedPatientPhoto).not.toHaveBeenCalled()
  })
})
