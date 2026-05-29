import MockAdapter from 'axios-mock-adapter'
import client from '../client'
import {
  listPatientOdontogram,
  getPatientOdontogramSummary,
} from '../odontogram'
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

describe('odontogram API', () => {
  let mock: MockAdapter

  beforeEach(() => {
    mock = new MockAdapter(client)
    authed()
  })
  afterEach(() => mock.restore())

  it('listPatientOdontogram returns the data array (strips envelope)', async () => {
    mock.onGet('/patients/p-1/odontogram').reply(200, {
      data: [
        {
          id: 'e-1',
          patient_id: 'p-1',
          tooth_number: 11,
          condition_type: 'filling',
          condition_date: '2026-04-10',
        },
      ],
    })
    const r = await listPatientOdontogram('p-1')
    expect(Array.isArray(r)).toBe(true)
    expect(r[0].tooth_number).toBe(11)
    expect(r[0].condition_type).toBe('filling')
  })

  it('getPatientOdontogramSummary returns the data object (strips envelope)', async () => {
    mock.onGet('/patients/p-1/odontogram/summary').reply(200, {
      data: {
        total_entries: 4,
        affected_teeth_count: 4,
        latest_conditions: [
          { tooth_number: 11, condition_type: 'filling', history_count: 1, condition_date: '2026-04-10' },
        ],
      },
    })
    const r = await getPatientOdontogramSummary('p-1')
    expect(r.total_entries).toBe(4)
    expect(r.affected_teeth_count).toBe(4)
    expect(r.latest_conditions).toHaveLength(1)
    expect(r.latest_conditions[0].condition_type).toBe('filling')
  })

  it('surfaces backend errors as ApiError (via the client interceptor)', async () => {
    mock.onGet('/patients/p-1/odontogram').reply(500, { message: 'oops' })
    await expect(listPatientOdontogram('p-1')).rejects.toMatchObject({
      kind: 'server',
      status: 500,
    })
  })
})
