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
  resetAssistantPassword,
  updateAssistantStatus,
} from '../team'
import { useAuthStore } from '../../stores/auth'
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
  })
  afterEach(() => mock.restore())

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
})
