/**
 * Tests for the axios client error normalization layer. Covers every
 * `ApiError.kind` branch in `normalizeError`, plus the 401 refresh-retry
 * coalescing.
 */
import MockAdapter from 'axios-mock-adapter'
import client, { ApiError, isApiError } from '../client'
import { useAuthStore } from '../../stores/auth'

// Helper: prime the auth store with a token so the request interceptor
// attaches it without going through the real login flow.
function setTokens(access: string, refresh = 'r-init') {
  useAuthStore.setState({
    user: { id: '1', name: 'T', email: 't@t', role: 'dentist', account_status: 'active' },
    tokens: {
      access_token: access,
      refresh_token: refresh,
      token_type: 'Bearer',
      expires_in: 900,
      refresh_expires_in: 2592000,
    },
    isAuthenticated: true,
    isHydrating: false,
  } as any)
}

function clearAuth() {
  useAuthStore.setState({
    user: null,
    tokens: null,
    isAuthenticated: false,
    isHydrating: false,
  } as any)
}

describe('ApiError + normalizeError', () => {
  let mock: MockAdapter

  beforeEach(() => {
    mock = new MockAdapter(client)
    setTokens('access-1')
  })

  afterEach(() => {
    mock.restore()
    clearAuth()
  })

  it('attaches the Bearer token from the auth store', async () => {
    mock.onGet('/auth/me').reply((config) => {
      expect(config.headers?.Authorization).toBe('Bearer access-1')
      return [200, { data: { id: '1' } }]
    })
    await client.get('/auth/me')
  })

  it('normalizes a network failure to kind=network', async () => {
    mock.onGet('/x').networkError()
    await expect(client.get('/x')).rejects.toMatchObject({
      kind: 'network',
    })
  })

  it('normalizes a timeout to kind=timeout', async () => {
    mock.onGet('/slow').timeout()
    const err: ApiError = await client.get('/slow').catch((e) => e)
    expect(isApiError(err)).toBe(true)
    expect(err.kind).toBe('timeout')
  })

  it('normalizes 403 to forbidden', async () => {
    mock.onGet('/forbidden').reply(403, { message: 'No.' })
    await expect(client.get('/forbidden')).rejects.toMatchObject({
      kind: 'forbidden',
      status: 403,
    })
  })

  it('normalizes 404 to not_found', async () => {
    mock.onGet('/missing').reply(404, {})
    await expect(client.get('/missing')).rejects.toMatchObject({ kind: 'not_found' })
  })

  it('normalizes 422 to validation and surfaces field errors', async () => {
    mock.onPost('/things').reply(422, {
      message: 'invalid',
      errors: { name: ['Required'], email: ['Bad format'] },
    })
    const err: ApiError = await client.post('/things', {}).catch((e) => e)
    expect(err.kind).toBe('validation')
    expect(err.fieldErrors).toEqual({ name: ['Required'], email: ['Bad format'] })
  })

  it('normalizes 5xx to server', async () => {
    mock.onGet('/down').reply(503, { message: 'try later' })
    await expect(client.get('/down')).rejects.toMatchObject({
      kind: 'server',
      status: 503,
    })
  })

  it('normalizes unmapped status to unknown', async () => {
    mock.onGet('/teapot').reply(418, { message: 'no coffee' })
    await expect(client.get('/teapot')).rejects.toMatchObject({ kind: 'unknown' })
  })
})

describe('401 → refresh → retry', () => {
  let mock: MockAdapter

  beforeEach(() => {
    mock = new MockAdapter(client)
    setTokens('expired-access', 'good-refresh')
  })

  afterEach(() => {
    mock.restore()
    clearAuth()
  })

  it('refreshes the token on 401 and retries the original request once', async () => {
    // First call: 401. Refresh: success. Retry: 200.
    let firstCall = true
    mock.onGet('/secret').reply((config) => {
      const auth = config.headers?.Authorization
      if (firstCall) {
        firstCall = false
        return [401, { message: 'expired' }]
      }
      // Retry should carry the NEW token from the refresh response.
      expect(auth).toBe('Bearer new-access')
      return [200, { data: 'ok' }]
    })

    // Refresh endpoint is hit directly on the axios singleton via baseURL
    // (the interceptor uses axios.post, not the client instance, so we
    // intercept against the singleton via passThrough).
    // axios-mock-adapter on `client` doesn't intercept the refresh call
    // — we need to mock the singleton too. Reach in via require:
    const axios = require('axios')
    const singletonMock = new MockAdapter(axios)
    singletonMock.onPost(/auth\/refresh$/).reply(200, {
      data: {
        tokens: {
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          token_type: 'Bearer',
          expires_in: 900,
          refresh_expires_in: 2592000,
        },
      },
    })

    const res = await client.get('/secret')
    expect(res.data).toEqual({ data: 'ok' })
    expect(useAuthStore.getState().tokens?.access_token).toBe('new-access')
    singletonMock.restore()
  })

  it('logs out when refresh fails (no refresh token)', async () => {
    setTokens('expired-access', '') // no refresh token
    mock.onGet('/secret').reply(401, { message: 'expired' })

    await expect(client.get('/secret')).rejects.toMatchObject({ kind: 'unauthorized' })
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })
})
