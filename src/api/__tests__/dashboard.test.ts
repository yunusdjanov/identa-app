import MockAdapter from 'axios-mock-adapter'
import client from '../client'
import { getDashboardSnapshot } from '../dashboard'
import { useAuthStore } from '../../stores/auth'

describe('dashboard API mapping', () => {
  const mock = new MockAdapter(client)

  beforeEach(() => {
    useAuthStore.setState({
      tokens: { access_token: 'test-token' },
      isAuthenticated: true,
    } as any)
  })

  afterEach(() => mock.reset())
  afterAll(() => mock.restore())

  it('maps date, appointments, and per-currency financials', async () => {
    mock.onGet('/dashboard/snapshot').reply(200, {
      data: {
        date: '2026-07-14',
        workingHoursEnd: '19:30:00',
        revenueThisMonth: 80000,
        outstandingDebtTotal: 400000,
        financialsByCurrency: {
          UZS: { revenueThisMonth: 80000, outstandingDebtTotal: 400000 },
          USD: { revenueThisMonth: '40.50', outstandingDebtTotal: '150.25' },
        },
        todayAppointments: [
          {
            id: 'apt-1',
            patientName: 'Test Patient',
            appointmentDate: '2026-07-14',
            startTime: '09:30:00',
            durationMinutes: 45,
            status: 'scheduled',
            reason: null,
          },
        ],
      },
    })

    const snapshot = await getDashboardSnapshot('2026-07-14')

    expect(snapshot.date).toBe('2026-07-14')
    expect(snapshot.working_hours_end).toBe('19:30')
    expect(snapshot.financials_by_currency).toEqual({
      UZS: { revenue_this_month: 80000, outstanding_debt_total: 400000 },
      USD: { revenue_this_month: 40.5, outstanding_debt_total: 150.25 },
    })
    expect(snapshot.today_appointments[0]).toMatchObject({
      patient_name: 'Test Patient',
      appointment_date: '2026-07-14',
      start_time: '09:30:00',
      duration_minutes: 45,
    })
  })

  it('falls back to legacy UZS fields during backend rollout', async () => {
    mock.onGet('/dashboard/snapshot').reply(200, {
      data: {
        date: '2026-07-14',
        revenueThisMonth: '1200',
        outstandingDebtTotal: '300',
        todayAppointments: [],
      },
    })

    const snapshot = await getDashboardSnapshot('2026-07-14')

    expect(snapshot.financials_by_currency.UZS).toEqual({
      revenue_this_month: 1200,
      outstanding_debt_total: 300,
    })
    expect(snapshot.financials_by_currency.USD).toEqual({
      revenue_this_month: 0,
      outstanding_debt_total: 0,
    })
  })
})
