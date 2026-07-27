/**
 * Locks in the team write-path fixes + new features:
 *   - createAssistant sends password_confirmation (backend `confirmed` rule)
 *   - resetAssistantPassword posts new_password + confirmation
 *   - updateAssistantStatus PATCHes the status endpoint
 */
import MockAdapter from 'axios-mock-adapter'
import client from '../client'
import {
  createAssistant,
  deleteAssistant,
  listAssistants,
  resetAssistantPassword,
  updateAssistant,
  updateAssistantStatus,
} from '../team'
import { useAuthStore } from '../../stores/auth'
import { useNetworkStore } from '../../stores/network'
import type { ApiAssistant } from '../../types'

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

const sample: ApiAssistant = {
  id: 'as-1',
  name: 'Madina',
  email: 'madina@x',
  account_status: 'active',
  assistant_permissions: ['patients.view'],
}

describe('team mutations', () => {
  let mock: MockAdapter

  beforeEach(() => {
    mock = new MockAdapter(client)
    authed()
    useNetworkStore.setState({ isOnline: true })
  })
  afterEach(() => {
    mock.restore()
    useNetworkStore.setState({ isOnline: true })
  })

  it('listAssistants sends canonical pagination parameters', async () => {
    let params: Record<string, number> | undefined
    mock.onGet('/team/assistants').reply((config) => {
      params = config.params
      return [200, {
        data: [sample],
        meta: { pagination: { page: 2, total_pages: 3, per_page: 25, total: 60 } },
      }]
    })

    const response = await listAssistants(2, 25)

    expect(params).toEqual({ page: 2, per_page: 25 })
    expect(response.meta.pagination.total_pages).toBe(3)
  })

  it('createAssistant sends password_confirmation matching the password', async () => {
    let body: any
    mock.onPost('/team/assistants').reply((config) => {
      body = JSON.parse(config.data)
      return [201, { data: sample }]
    })
    await createAssistant({
      name: 'Madina',
      email: 'madina@x',
      password: 'secret12',
      permissions: ['patients.view'],
    })
    expect(body.password).toBe('secret12')
    expect(body.password_confirmation).toBe('secret12')
    expect(body.permissions).toEqual(['patients.view'])
  })

  it('resetAssistantPassword posts new_password + new_password_confirmation', async () => {
    let url = ''
    let body: any
    mock.onPost('/team/assistants/as-1/reset-password').reply((config) => {
      url = config.url ?? ''
      body = JSON.parse(config.data)
      return [200, {}]
    })
    await resetAssistantPassword('as-1', 'newpass12')
    expect(url).toBe('/team/assistants/as-1/reset-password')
    expect(body).toEqual({
      new_password: 'newpass12',
      new_password_confirmation: 'newpass12',
    })
  })

  it('updateAssistantStatus PATCHes the status endpoint with {status}', async () => {
    let url = ''
    let body: any
    mock.onPatch('/team/assistants/as-1/status').reply((config) => {
      url = config.url ?? ''
      body = JSON.parse(config.data)
      return [200, { data: { ...sample, account_status: 'blocked' } }]
    })
    const r = await updateAssistantStatus('as-1', 'blocked')
    expect(url).toBe('/team/assistants/as-1/status')
    expect(body.status).toBe('blocked')
    expect(r.account_status).toBe('blocked')
  })

  it('sends null when an existing assistant phone is cleared', async () => {
    let body: any
    mock.onPut('/team/assistants/as-1').reply((config) => {
      body = JSON.parse(config.data)
      return [200, { data: { ...sample, phone: null } }]
    })

    await updateAssistant('as-1', {
      name: 'Madina',
      email: 'madina@x',
      phone: null,
      permissions: ['patients.view'],
    })

    expect(body.phone).toBeNull()
  })

  it('blocks every team mutation while offline', async () => {
    useNetworkStore.setState({ isOnline: false })
    const payload = {
      name: 'Madina',
      email: 'madina@x',
      password: 'secret12',
      permissions: ['patients.view'],
    }

    await expect(createAssistant(payload)).rejects.toMatchObject({ isOfflineError: true })
    await expect(updateAssistant('as-1', payload)).rejects.toMatchObject({ isOfflineError: true })
    await expect(updateAssistantStatus('as-1', 'blocked')).rejects.toMatchObject({ isOfflineError: true })
    await expect(resetAssistantPassword('as-1', 'newpass12')).rejects.toMatchObject({ isOfflineError: true })
    await expect(deleteAssistant('as-1')).rejects.toMatchObject({ isOfflineError: true })
    expect(mock.history.post).toHaveLength(0)
    expect(mock.history.put).toHaveLength(0)
    expect(mock.history.patch).toHaveLength(0)
    expect(mock.history.delete).toHaveLength(0)
  })
})
