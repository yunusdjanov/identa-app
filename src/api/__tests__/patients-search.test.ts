/**
 * Targeted test for the patient-search URL serialization. Bug #10 from the
 * smoke test was reported as "search doesn't work" — this test pins the
 * exact param shape we send to the backend so a future refactor can't
 * accidentally break it again.
 */
import MockAdapter from 'axios-mock-adapter'
import client from '../client'
import {
  clearRecentPatients,
  getPatient,
  listPatients,
  listPatientsForExport,
  listRecentPatients,
  lookupPatients,
} from '../patients'
import { useAuthStore } from '../../stores/auth'

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
}

describe('listPatients param serialization', () => {
  let mock: MockAdapter
  const origEnv = process.env.EXPO_PUBLIC_USE_MOCK_API

  beforeAll(() => {
    // Keep this suite explicit even though patient mocks are opt-in.
    process.env.EXPO_PUBLIC_USE_MOCK_API = 'false'
    process.env.EXPO_PUBLIC_MOCK_PATIENTS = 'false'
  })
  afterAll(() => {
    process.env.EXPO_PUBLIC_USE_MOCK_API = origEnv
    delete process.env.EXPO_PUBLIC_MOCK_PATIENTS
  })

  beforeEach(() => {
    mock = new MockAdapter(client)
    authed()
  })
  afterEach(() => mock.restore())

  it('sends search through the Laravel-style filter[search] param', async () => {
    let paramsSeen: any = null
    let urlSeen = ''
    mock.onGet('/patients').reply((config) => {
      paramsSeen = config.params
      urlSeen = config.url ?? ''
      return [200, { data: [], meta: { pagination: { current_page: 1, last_page: 1, per_page: 100, total: 0 } } }]
    })

    await listPatients({ search: 'Test', per_page: 100 })
    expect(paramsSeen['filter[search]']).toBe('Test')
    expect(paramsSeen.per_page).toBe(100)
  })

  it('omits filter[search] when the search input is empty', async () => {
    let paramsSeen: any = null
    mock.onGet('/patients').reply((config) => {
      paramsSeen = config.params
      return [200, { data: [], meta: { pagination: { current_page: 1, last_page: 1, per_page: 10, total: 0 } } }]
    })
    await listPatients({})
    expect('filter[search]' in paramsSeen).toBe(false)
  })

  it('translates category_id into filter[category_id]', async () => {
    let paramsSeen: any = null
    mock.onGet('/patients').reply((config) => {
      paramsSeen = config.params
      return [200, { data: [], meta: { pagination: { current_page: 1, last_page: 1, per_page: 10, total: 0 } } }]
    })
    await listPatients({ category_id: 'cat-1' })
    expect(paramsSeen['filter[category_id]']).toBe('cat-1')
  })

  it('uses the compact patient lookup endpoint for appointment selectors', async () => {
    let paramsSeen: any = null
    let signalSeen: unknown
    mock.onGet('/lookups/patients').reply((config) => {
      paramsSeen = config.params
      signalSeen = config.signal
      return [
        200,
        {
          data: [
            {
              id: 'p-1',
              patient_id: 'P-1',
              full_name: 'Ali Karimov',
              phone: '+998901234567',
              secondary_phone: null,
            },
          ],
          meta: { pagination: { current_page: 1, last_page: 1, per_page: 20, total: 1 } },
        },
      ]
    })

    const controller = new AbortController()
    const response = await lookupPatients(
      { search: 'Ali', sort: '-updated_at', page: 1, per_page: 20 },
      { signal: controller.signal }
    )

    expect(paramsSeen).toEqual({
      'filter[search]': 'Ali',
      sort: '-updated_at',
      page: 1,
      per_page: 20,
    })
    expect(signalSeen).toBe(controller.signal)
    expect(response.data[0]).toMatchObject({
      id: 'p-1',
      full_name: 'Ali Karimov',
      phone: '+998901234567',
    })
  })

  it('sends pagination and alphabetical sort to the backend', async () => {
    let paramsSeen: any = null
    mock.onGet('/patients').reply((config) => {
      paramsSeen = config.params
      return [
        200,
        {
          data: [],
          meta: { pagination: { page: 2, total_pages: 4, per_page: 30, total: 100 } },
        },
      ]
    })

    await listPatients({ page: 2, per_page: 30, sort: 'full_name' })

    expect(paramsSeen.page).toBe(2)
    expect(paramsSeen.per_page).toBe(30)
    expect(paramsSeen.sort).toBe('full_name')
  })

  it('loads every bounded page for a filtered patient export', async () => {
    const requestedPages: number[] = []
    mock.onGet('/patients').reply((config) => {
      const page = Number(config.params.page)
      requestedPages.push(page)
      const data =
        page === 1
          ? [
              { id: 'p-1', full_name: 'Ali Karimov' },
              { id: 'p-duplicate', full_name: 'Shared row' },
            ]
          : [
              { id: 'p-duplicate', full_name: 'Shared row' },
              { id: 'p-2', full_name: 'Vali Karimov' },
            ]
      return [
        200,
        {
          data,
          meta: {
            pagination: {
              current_page: page,
              last_page: 2,
              per_page: 100,
              total: 3,
            },
          },
        },
      ]
    })

    const result = await listPatientsForExport({
      search: 'Karimov',
      category_id: 'cat-1',
      sort: '-updated_at',
    })

    expect(requestedPages).toEqual([1, 2])
    expect(result.map((patient) => patient.id)).toEqual([
      'p-1',
      'p-duplicate',
      'p-2',
    ])
    expect(mock.history.get).toHaveLength(2)
    expect(mock.history.get[1]?.params).toMatchObject({
      'filter[search]': 'Karimov',
      'filter[category_id]': 'cat-1',
      sort: '-updated_at',
      page: 2,
      per_page: 100,
    })
  })

  it("doesn't apply category filter when 'all' is passed", async () => {
    let paramsSeen: any = null
    mock.onGet('/patients').reply((config) => {
      paramsSeen = config.params
      return [200, { data: [], meta: { pagination: { current_page: 1, last_page: 1, per_page: 10, total: 0 } } }]
    })
    await listPatients({ category_id: 'all' })
    expect('filter[category_id]' in paramsSeen).toBe(false)
  })

  it('marks a patient detail request as recently viewed when requested', async () => {
    let paramsSeen: any = null
    mock.onGet('/patients/p-1').reply((config) => {
      paramsSeen = config.params
      return [
        200,
        { data: { id: 'p-1', patient_id: 'P-1', full_name: 'Test Patient', phone: null } },
      ]
    })

    await getPatient('p-1', { rememberRecent: true })

    expect(paramsSeen.remember_recent).toBe(1)
  })

  it('lists and clears profile-scoped recent patients', async () => {
    mock.onGet('/patients/recent').reply(200, {
      data: [{ id: 'p-1', full_name: 'Test Patient' }],
    })
    mock.onDelete('/patients/recent').reply(204)

    await expect(listRecentPatients()).resolves.toEqual([
      { id: 'p-1', full_name: 'Test Patient' },
    ])
    await expect(clearRecentPatients()).resolves.toBeUndefined()
  })
})
