/**
 * Targeted test for the patient-search URL serialization. Bug #10 from the
 * smoke test was reported as "search doesn't work" — this test pins the
 * exact param shape we send to the backend so a future refactor can't
 * accidentally break it again.
 */
import MockAdapter from 'axios-mock-adapter'
import client from '../client'
import { listPatients } from '../patients'
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
    // Force the real-backend code path (this slice has a mock fork).
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

  it("doesn't apply category filter when 'all' is passed", async () => {
    let paramsSeen: any = null
    mock.onGet('/patients').reply((config) => {
      paramsSeen = config.params
      return [200, { data: [], meta: { pagination: { current_page: 1, last_page: 1, per_page: 10, total: 0 } } }]
    })
    await listPatients({ category_id: 'all' })
    expect('filter[category_id]' in paramsSeen).toBe(false)
  })
})
