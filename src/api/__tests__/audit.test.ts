/**
 * Locks the audit-logs query contract:
 *   - bracketed filter[*] params + sort + pagination
 *   - event_type filter omitted when 'all'
 * (Jest sets EXPO_PUBLIC_USE_MOCK_API=false, so the real axios branch runs.)
 */
import MockAdapter from 'axios-mock-adapter'
import client from '../client'
import { listAuditLogs } from '../audit'
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

describe('listAuditLogs', () => {
  let mock: MockAdapter

  beforeEach(() => {
    mock = new MockAdapter(client)
    authed()
  })
  afterEach(() => mock.restore())

  it('sends bracketed filter params + sort + pagination', async () => {
    let params: any
    mock.onGet('/audit-logs').reply((config) => {
      params = config.params
      return [200, { data: [], meta: { pagination: { page: 2, total_pages: 3 } } }]
    })

    const res = await listAuditLogs({
      page: 2,
      per_page: 10,
      search: 'patient',
      event_type: 'patient.created',
      date_from: '2026-01-01',
      date_to: '2026-02-01',
    })

    expect(params['filter[search]']).toBe('patient')
    expect(params['filter[event_type]']).toBe('patient.created')
    expect(params['filter[date_from]']).toBe('2026-01-01')
    expect(params['filter[date_to]']).toBe('2026-02-01')
    expect(params.sort).toBe('-created_at')
    expect(params.page).toBe(2)
    expect(params.per_page).toBe(10)
    expect(res.meta.pagination.total_pages).toBe(3)
  })

  it("omits the event_type filter when 'all'", async () => {
    let params: any
    mock.onGet('/audit-logs').reply((config) => {
      params = config.params
      return [200, { data: [], meta: { pagination: { page: 1, total_pages: 1 } } }]
    })

    await listAuditLogs({ event_type: 'all' })

    expect(params['filter[event_type]']).toBeUndefined()
    expect(params.sort).toBe('-created_at')
  })
})
