import MockAdapter from 'axios-mock-adapter'
import client from '../client'
import {
  createPatientTreatment,
  updatePatientTreatment,
  deletePatientTreatment,
  getPatientTreatment,
  uploadTreatmentImage,
  deleteTreatmentImage,
  resolveTreatmentImageUrl,
} from '../treatments'
import { useAuthStore } from '../../stores/auth'
import { useNetworkStore } from '../../stores/network'
import type { ApiTreatment, ApiTreatmentImage } from '../../types'

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

const sample: ApiTreatment = {
  id: 'tx-1',
  patient_id: 'p-1',
  teeth: [11, 12],
  treatment_type: 'Filling',
  treatment_date: '2026-05-24',
  cost: 100000,
  debt_amount: 100000,
  paid_amount: 40000,
  balance: 60000,
  images: [],
}

describe('treatments CRUD', () => {
  let mock: MockAdapter

  beforeEach(() => {
    mock = new MockAdapter(client)
    authed()
  })
  afterEach(() => mock.restore())

  it('creates a treatment with the documented payload shape', async () => {
    mock.onPost('/patients/p-1/treatments').reply((config) => {
      const body = JSON.parse(config.data)
      expect(body).toEqual({
        treatment_type: 'Filling',
        treatment_date: '2026-05-24',
        teeth: [11, 12],
        comment: 'note',
        debt_amount: 100000,
        paid_amount: 0,
      })
      return [201, { data: sample }]
    })

    const result = await createPatientTreatment('p-1', {
      treatment_type: 'Filling',
      treatment_date: '2026-05-24',
      teeth: [11, 12],
      comment: 'note',
      debt_amount: 100000,
      paid_amount: 0,
    })
    expect(result.id).toBe('tx-1')
    // Normalizer ensures images is always an array, even if backend omits.
    expect(Array.isArray(result.images)).toBe(true)
  })

  it('PUTs to the patient-scoped treatment URL on update', async () => {
    let urlSeen = ''
    mock.onPut(/\/patients\/.+\/treatments\/.+/).reply((config) => {
      urlSeen = config.url ?? ''
      return [200, { data: sample }]
    })
    await updatePatientTreatment('p-1', 'tx-1', {
      treatment_type: 'Filling',
      treatment_date: '2026-05-24',
      teeth: [11],
    })
    expect(urlSeen).toBe('/patients/p-1/treatments/tx-1')
  })

  it('DELETEs against the right URL', async () => {
    let urlSeen = ''
    mock.onDelete(/\/patients\/.+\/treatments\/.+/).reply((config) => {
      urlSeen = config.url ?? ''
      return [204]
    })
    await deletePatientTreatment('p-1', 'tx-1')
    expect(urlSeen).toBe('/patients/p-1/treatments/tx-1')
  })

  it('GET includes ?include_images=true so caller never sees a half-loaded record', async () => {
    let qsSeen: any = null
    mock.onGet(/\/patients\/p-1\/treatments\/tx-1/).reply((config) => {
      qsSeen = config.url
      return [200, { data: sample }]
    })
    await getPatientTreatment('p-1', 'tx-1')
    expect(qsSeen).toContain('include_images=true')
  })

  it('throws OfflineError on create when the network store says offline', async () => {
    useNetworkStore.setState({ isOnline: false })
    await expect(
      createPatientTreatment('p-1', {
        treatment_type: 'x',
        treatment_date: '2026-05-24',
        teeth: [],
      })
    ).rejects.toMatchObject({ name: 'OfflineError' })
  })
})

describe('image upload', () => {
  let mock: MockAdapter

  beforeEach(() => {
    mock = new MockAdapter(client)
    authed()
  })
  afterEach(() => mock.restore())

  it('POSTs multipart/form-data with the `image` field and lets the adapter set the boundary', async () => {
    let contentTypeSent: string | undefined
    let bodyType: string = ''
    mock.onPost(/\/images$/).reply((config) => {
      contentTypeSent = (config.headers?.['Content-Type'] ?? config.headers?.['content-type']) as
        | string
        | undefined
      bodyType = config.data?.constructor?.name ?? typeof config.data
      const img: ApiTreatmentImage = { id: 'img-1', url: 'https://cdn/x.jpg' }
      return [201, { data: img }]
    })

    const r = await uploadTreatmentImage('p-1', 'tx-1', {
      uri: 'file:///photo.jpg',
      mimeType: 'image/jpeg',
      fileName: 'photo.jpg',
      fileSize: 1024,
    })
    expect(r.id).toBe('img-1')
    expect(bodyType).toBe('FormData')
    // The critical fix: Content-Type must be undefined (or unset), NOT the
    // literal string 'multipart/form-data', so axios+XHR fill in the boundary.
    if (contentTypeSent !== undefined) {
      expect(contentTypeSent).not.toBe('multipart/form-data')
    }
  })

  it('DELETE image hits the right URL', async () => {
    let urlSeen = ''
    mock.onDelete(/\/images\/.+/).reply((config) => {
      urlSeen = config.url ?? ''
      return [204]
    })
    await deleteTreatmentImage('p-1', 'tx-1', 'img-1')
    expect(urlSeen).toBe('/patients/p-1/treatments/tx-1/images/img-1')
  })
})

describe('resolveTreatmentImageUrl', () => {
  it('returns null for rejected scan_status (content moderation)', () => {
    const img: ApiTreatmentImage = {
      id: 'x',
      url: 'a',
      thumbnail_url: 'b',
      preview_url: 'c',
      scan_status: 'rejected',
    }
    expect(resolveTreatmentImageUrl(img, 'thumbnail')).toBeNull()
    expect(resolveTreatmentImageUrl(img, 'preview')).toBeNull()
    expect(resolveTreatmentImageUrl(img, 'full')).toBeNull()
  })

  it('prefers thumbnail → preview → full when asked for thumbnail', () => {
    const img: ApiTreatmentImage = {
      id: 'x',
      url: 'full',
      thumbnail_url: 'thumb',
      preview_url: 'prev',
    }
    expect(resolveTreatmentImageUrl(img, 'thumbnail')).toBe('thumb')
  })

  it('falls back to preview when no thumbnail exists', () => {
    const img: ApiTreatmentImage = {
      id: 'x',
      url: 'full',
      preview_url: 'prev',
    }
    expect(resolveTreatmentImageUrl(img, 'thumbnail')).toBe('prev')
  })

  it('falls back to full when no thumbnail/preview', () => {
    const img: ApiTreatmentImage = { id: 'x', url: 'full' }
    expect(resolveTreatmentImageUrl(img, 'thumbnail')).toBe('full')
  })

  it('returns null when all URLs are missing', () => {
    expect(resolveTreatmentImageUrl({ id: 'x' }, 'preview')).toBeNull()
  })
})
