/**
 * Locks in the appointment write-path fixes:
 *   - updateAppointment carries patient_id (backend requires it) and maps
 *     notes → reason on the wire
 *   - listAppointments requests a high per_page so a busy day/week isn't
 *     silently truncated at the backend's default page size
 */
import MockAdapter from 'axios-mock-adapter'
import client from '../client'
import { updateAppointment, listAppointments } from '../appointments'
import { useAuthStore } from '../../stores/auth'
import { useNetworkStore } from '../../stores/network'
import type { ApiAppointment } from '../../types'

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

const sample: ApiAppointment = {
  id: 'apt-1',
  patient_id: 'p-1',
  appointment_date: '2026-05-24',
  start_time: '09:00',
  end_time: '09:30',
  status: 'scheduled',
  notes: 'Checkup',
}

describe('appointment write path', () => {
  let mock: MockAdapter

  beforeEach(() => {
    mock = new MockAdapter(client)
    authed()
  })
  afterEach(() => mock.restore())

  it('updateAppointment sends patient_id and maps notes → reason', async () => {
    let body: any
    mock.onPut('/appointments/apt-1').reply((config) => {
      body = JSON.parse(config.data)
      return [200, { data: sample }]
    })
    await updateAppointment('apt-1', {
      patient_id: 'p-1',
      appointment_date: '2026-05-24',
      start_time: '09:00',
      end_time: '09:30',
      status: 'scheduled',
      notes: 'Checkup',
    })
    expect(body.patient_id).toBe('p-1')
    // Backend expects `reason` on write; `notes` is read-only.
    expect(body.reason).toBe('Checkup')
    expect(body.notes).toBeUndefined()
  })

  it('listAppointments requests a high per_page and bracketed date filters', async () => {
    let params: any
    mock.onGet('/appointments').reply((config) => {
      params = config.params
      return [200, { data: [], meta: { pagination: { page: 1, total_pages: 1, per_page: 500, total: 0 } } }]
    })
    await listAppointments({ date: '2026-05-24' })
    expect(Number(params.per_page)).toBeGreaterThanOrEqual(100)
    expect(params['filter[date_from]']).toBe('2026-05-24')
    expect(params['filter[date_to]']).toBe('2026-05-24')
  })
})
