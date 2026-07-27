/**
 * Locks in the appointment write-path fixes:
 *   - updateAppointment carries patient_id (backend requires it) and maps
 *     notes → reason on the wire
 *   - listAppointments requests a high per_page so a busy day/week isn't
 *     silently truncated at the backend's default page size
 */
import MockAdapter from 'axios-mock-adapter'
import client from '../client'
import {
  createAppointment,
  createPatientCardFromGuest,
  updateAppointment,
  updateAppointmentStatus,
  listAppointments,
} from '../appointments'
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

  it('merges every backend page for calendar range queries', async () => {
    mock.onGet('/appointments').reply((config) => {
      const page = Number(config.params?.page ?? 1)
      return [
        200,
        {
          data: [{ ...sample, id: `apt-${page}` }],
          meta: {
            pagination: {
              page,
              total_pages: 2,
              per_page: 1,
              total: 2,
            },
          },
        },
      ]
    })

    const result = await listAppointments({
      start_date: '2026-05-24',
      end_date: '2026-05-30',
    })

    expect(result.data.map((appointment) => appointment.id)).toEqual(['apt-1', 'apt-2'])
    expect(result.meta.pagination.total_pages).toBe(1)
  })

  it('updates status through the partial status endpoint', async () => {
    let body: any
    mock.onPatch('/appointments/apt-1/status').reply((config) => {
      body = JSON.parse(config.data)
      return [200, { data: { ...sample, status: 'completed' } }]
    })

    const updated = await updateAppointmentStatus('apt-1', 'completed')

    expect(body).toEqual({ status: 'completed' })
    expect(updated.status).toBe('completed')
  })

  it('creates a guest appointment with the backend guest fields', async () => {
    let body: any
    const guest = {
      ...sample,
      patient_id: null,
      patient_name: 'Ali Valiyev',
      guest_name: 'Ali Valiyev',
      guest_phone: '+998901234567',
      is_guest: true,
    }
    mock.onPost('/appointments').reply((config) => {
      body = JSON.parse(config.data)
      return [201, { data: guest }]
    })

    await createAppointment({
      patient_id: null,
      guest_name: 'Ali Valiyev',
      guest_phone: '+998901234567',
      appointment_date: sample.appointment_date,
      start_time: sample.start_time,
      end_time: sample.end_time,
      status: 'scheduled',
      notes: 'Consultation',
    })

    expect(body).toMatchObject({
      patient_id: null,
      guest_name: 'Ali Valiyev',
      guest_phone: '+998901234567',
      reason: 'Consultation',
    })
  })

  it('creates a patient card from the guest identity', async () => {
    let body: any
    const appointment: ApiAppointment = {
      ...sample,
      patient_id: null,
      patient_name: 'Ali Valiyev',
      guest_name: 'Ali Valiyev',
      guest_phone: '+998901234567',
      is_guest: true,
    }
    mock.onPost('/appointments/apt-1/patient-card').reply((config) => {
      body = JSON.parse(config.data)
      return [201, {
        data: {
          appointment: { ...appointment, patient_id: 'p-2', is_guest: false },
          patient: {
            id: 'p-2',
            patient_id: 'P-0002',
            full_name: 'Ali Valiyev',
            phone: '+998901234567',
          },
        },
      }]
    })

    const result = await createPatientCardFromGuest(appointment)

    expect(body).toEqual({ full_name: 'Ali Valiyev', phone: '+998901234567' })
    expect(result.patient.id).toBe('p-2')
  })
})
