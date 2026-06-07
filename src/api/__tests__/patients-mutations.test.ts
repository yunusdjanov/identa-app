/**
 * Locks in the patient write-path fixes + new features:
 *   - createPatient sends `category_id` (single), not the ignored `categories`
 *   - archive / restore / permanent (force) delete hit the right URLs
 *   - photo upload is multipart with the `photo` field (no literal CT)
 */
import MockAdapter from 'axios-mock-adapter'
import client from '../client'
import {
  createPatient,
  archivePatient,
  restorePatient,
  forceDeletePatient,
  uploadPatientPhoto,
  deletePatientPhoto,
} from '../patients'
import { useAuthStore } from '../../stores/auth'
import { useNetworkStore } from '../../stores/network'
import type { ApiPatient } from '../../types'

function authed() {
  useAuthStore.setState({
    user: { id: '1', name: 'T', email: 't@t', role: 'dentist', account_status: 'active' },
    tokens: {
      access_token: 'a',
      refresh_token: 'r',
      token_type: 'Bearer',
      expires_in: 900,
      refresh_expires_in: 2592000,
    },
    isAuthenticated: true,
    isHydrating: false,
  } as any)
  useNetworkStore.setState({ isOnline: true })
}

const sample: ApiPatient = {
  id: 'p-1',
  patient_id: 'P-0001',
  full_name: 'Aziz Karimov',
  phone: '+998901234567',
}

describe('patient mutations', () => {
  let mock: MockAdapter

  beforeEach(() => {
    mock = new MockAdapter(client)
    authed()
  })
  afterEach(() => mock.restore())

  it('createPatient sends category_id (single), never a categories array', async () => {
    let body: any
    mock.onPost('/patients').reply((config) => {
      body = JSON.parse(config.data)
      return [201, { data: sample }]
    })
    await createPatient({ full_name: 'Aziz', phone: '+998901234567', category_id: 'cat-1' })
    expect(body.category_id).toBe('cat-1')
    expect(body.categories).toBeUndefined()
  })

  it('createPatient passes category_id: null to clear the category', async () => {
    let body: any
    mock.onPost('/patients').reply((config) => {
      body = JSON.parse(config.data)
      return [201, { data: sample }]
    })
    await createPatient({ full_name: 'X', phone: '+998901112233', category_id: null })
    expect(body.category_id).toBeNull()
  })

  it('archivePatient DELETEs /patients/{id}', async () => {
    let url = ''
    mock.onDelete('/patients/p-1').reply((config) => {
      url = config.url ?? ''
      return [204]
    })
    await archivePatient('p-1')
    expect(url).toBe('/patients/p-1')
  })

  it('restorePatient POSTs /patients/{id}/restore', async () => {
    let url = ''
    mock.onPost('/patients/p-1/restore').reply((config) => {
      url = config.url ?? ''
      return [200, { data: sample }]
    })
    const r = await restorePatient('p-1')
    expect(url).toBe('/patients/p-1/restore')
    expect(r.id).toBe('p-1')
  })

  it('forceDeletePatient DELETEs /patients/{id}/force', async () => {
    let url = ''
    mock.onDelete('/patients/p-1/force').reply((config) => {
      url = config.url ?? ''
      return [204]
    })
    await forceDeletePatient('p-1')
    expect(url).toBe('/patients/p-1/force')
  })

  it('uploadPatientPhoto POSTs multipart with the `photo` field, no literal multipart CT', async () => {
    let bodyType = ''
    let contentType: string | undefined
    mock.onPost('/patients/p-1/photo').reply((config) => {
      bodyType = config.data?.constructor?.name ?? typeof config.data
      contentType = (config.headers?.['Content-Type'] ?? config.headers?.['content-type']) as
        | string
        | undefined
      return [201, { data: { ...sample, photo_url: 'https://cdn/p.jpg' } }]
    })
    const r = await uploadPatientPhoto('p-1', {
      uri: 'file:///p.jpg',
      mimeType: 'image/jpeg',
      fileName: 'p.jpg',
      fileSize: 100,
    })
    expect(r.photo_url).toBe('https://cdn/p.jpg')
    expect(bodyType).toBe('FormData')
    if (contentType !== undefined) {
      expect(contentType).not.toBe('multipart/form-data')
    }
  })

  it('deletePatientPhoto DELETEs /patients/{id}/photo', async () => {
    let url = ''
    mock.onDelete('/patients/p-1/photo').reply((config) => {
      url = config.url ?? ''
      return [204]
    })
    await deletePatientPhoto('p-1')
    expect(url).toBe('/patients/p-1/photo')
  })

  it('archive is offline-guarded', async () => {
    useNetworkStore.setState({ isOnline: false })
    await expect(archivePatient('p-1')).rejects.toMatchObject({ name: 'OfflineError' })
  })
})
