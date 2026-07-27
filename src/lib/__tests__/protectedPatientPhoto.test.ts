import * as FileSystem from 'expo-file-system/legacy'

import {
  clearProtectedPatientPhotoCache,
  loadProtectedPatientPhoto,
  normalizeProtectedPatientMediaUri,
} from '../protectedPatientPhoto'
import { API_URL } from '../../constants'

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  makeDirectoryAsync: jest.fn(() => Promise.resolve()),
  getInfoAsync: jest.fn(),
  downloadAsync: jest.fn(),
  deleteAsync: jest.fn(() => Promise.resolve()),
}))

describe('protected patient photo cache', () => {
  const mockMakeDirectory = jest.mocked(FileSystem.makeDirectoryAsync)
  const mockGetInfo = jest.mocked(FileSystem.getInfoAsync)
  const mockDownload = jest.mocked(FileSystem.downloadAsync)
  const mockDelete = jest.mocked(FileSystem.deleteAsync)

  beforeEach(async () => {
    mockMakeDirectory.mockResolvedValue(undefined)
    mockGetInfo.mockResolvedValue({ exists: false, isDirectory: false } as never)
    mockDownload.mockResolvedValue({
      uri: 'file:///cache/identa-patient-photos/downloaded.img',
      status: 200,
      headers: {},
      mimeType: 'image/jpeg',
    })
    mockDelete.mockResolvedValue(undefined)
    await clearProtectedPatientPhotoCache()
    jest.clearAllMocks()
  })

  it('downloads protected media with Bearer authentication', async () => {
    const remoteUri = 'https://api.identa.test/api/v1/patients/p-1/photo?v=1'

    const localUri = await loadProtectedPatientPhoto(remoteUri, 'secret-token', 'user-1')

    expect(mockDownload).toHaveBeenCalledWith(
      remoteUri,
      expect.stringMatching(/^file:\/\/\/cache\/identa-patient-photos\/.+\.img$/),
      {
        headers: {
          Authorization: 'Bearer secret-token',
          Accept: 'image/*',
        },
      }
    )
    expect(localUri).toBe('file:///cache/identa-patient-photos/downloaded.img')
  })

  it('reuses an existing local file without another network request', async () => {
    mockGetInfo.mockResolvedValue({ exists: true, isDirectory: false, size: 1200 } as never)

    const localUri = await loadProtectedPatientPhoto(
      'https://api.identa.test/api/v1/patients/p-2/photo?v=1',
      'secret-token',
      'user-1'
    )

    expect(localUri).toMatch(/^file:\/\/\/cache\/identa-patient-photos\/.+\.img$/)
    expect(mockDownload).not.toHaveBeenCalled()
  })

  it('deletes an unauthorized download instead of exposing it as an image', async () => {
    mockDownload.mockResolvedValue({
      uri: 'file:///cache/identa-patient-photos/failed.img',
      status: 401,
      headers: {},
      mimeType: 'application/json',
    })

    await expect(
      loadProtectedPatientPhoto(
        'https://api.identa.test/api/v1/patients/p-3/photo?v=1',
        'expired-token',
        'user-1'
      )
    ).rejects.toThrow('Patient photo download failed (401)')
    expect(mockDelete).toHaveBeenCalledWith(expect.stringMatching(/\.img$/), {
      idempotent: true,
    })
  })

  it('removes a partial file when the network download throws', async () => {
    mockDownload.mockRejectedValue(new Error('network interrupted'))

    await expect(
      loadProtectedPatientPhoto(
        'https://api.identa.test/api/v1/patients/p-4/photo?v=1',
        'secret-token',
        'user-1'
      )
    ).rejects.toThrow('network interrupted')
    expect(mockDelete).toHaveBeenCalledWith(expect.stringMatching(/\.img$/), {
      idempotent: true,
    })
  })

  it('clears cached patient media on logout', async () => {
    await clearProtectedPatientPhotoCache()

    expect(mockDelete).toHaveBeenCalledWith('file:///cache/identa-patient-photos/', {
      idempotent: true,
    })
  })

  it('rebases protected patient media onto the configured API origin', () => {
    expect(normalizeProtectedPatientMediaUri(
      'http://internal-backend:8000/api/v1/patients/p-1/oral-photos/smile/photo-1?v=2'
    )).toBe(`${API_URL}/patients/p-1/oral-photos/smile/photo-1?v=2`)
  })

  it('does not rewrite unrelated external media URLs', () => {
    const external = 'https://cdn.example.test/assets/photo.jpg'
    expect(normalizeProtectedPatientMediaUri(external)).toBe(external)
  })
})
