import { API_URL } from '../../constants'
import {
  getPatientPhotoThumbnailUri,
  getPatientPhotoUris,
} from '../patientPhoto'
import type { ApiPatient } from '../../types'

const patient: ApiPatient = {
  id: 'p-1',
  patient_id: 'P-0001',
  full_name: 'Aziz Karimov',
  phone: '+998901234567',
  photo_scan_status: 'approved',
  photo_thumbnail_url: 'https://api/thumb',
  photo_preview_url: 'https://api/preview',
  photo_url: 'https://api/original',
}

describe('getPatientPhotoUris', () => {
  it('keeps preview and original as fallbacks when a thumbnail URL is exposed', () => {
    expect(getPatientPhotoUris(patient)).toEqual([
      'https://api/thumb',
      'https://api/preview',
      'https://api/original',
    ])
  })

  it('skips variants the backend says are not ready', () => {
    expect(
      getPatientPhotoUris({
        ...patient,
        photo_thumbnail_ready: false,
        photo_preview_ready: false,
      })
    ).toEqual(['https://api/original'])
  })

  it('does not expose pending or rejected photos', () => {
    expect(getPatientPhotoUris({ ...patient, photo_scan_status: 'pending' })).toEqual([])
    expect(getPatientPhotoUris({ ...patient, photo_scan_status: 'rejected' })).toEqual([])
  })
})

describe('getPatientPhotoThumbnailUri', () => {
  it('builds the protected thumbnail stream without a patient-detail request', () => {
    expect(getPatientPhotoThumbnailUri('patient/1')).toBe(
      `${API_URL}/patients/patient%2F1/photo?variant=thumbnail`
    )
  })

  it('does not build an invalid media request for a missing patient id', () => {
    expect(getPatientPhotoThumbnailUri('  ')).toBeNull()
  })
})
