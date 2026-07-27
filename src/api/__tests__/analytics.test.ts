import MockAdapter from 'axios-mock-adapter'

import client from '../client'
import { getAnalyticsSummary } from '../analytics'
import { useAuthStore } from '../../stores/auth'

describe('analytics API', () => {
  const mock = new MockAdapter(client)

  beforeEach(() => {
    useAuthStore.setState({
      tokens: { access_token: 'test-token' },
      isAuthenticated: true,
    } as never)
  })

  afterEach(() => mock.reset())
  afterAll(() => mock.restore())

  it('sends bounded currency parameters and strictly maps numeric strings', async () => {
    let params: Record<string, unknown> | undefined
    mock.onGet('/analytics/summary').reply((config) => {
      params = config.params
      return [
        200,
        {
          data: {
            currency: 'USD',
            permissions: { payments: true, patients: true, appointments: true },
            kpis: {
              revenue: { current: '25.5', previous: '10' },
              debt: { current: '8.25', previous: null },
              patients: { current: 4, previous: 2 },
              visits: { current: 9, previous: 6 },
            },
            buckets: [
              {
                key: '2026-07',
                revenue: '25.5',
                debt: '8.25',
                new_patients: '4',
                cumulative_patients: '4',
              },
            ],
            appointment_status: [{ status: 'completed', count: '7' }],
            top_debtors: [{ name: 'USD Patient', phone: '+99891', debt: '8.25' }],
          },
        },
      ]
    })

    const input = {
      range: '30d' as const,
      current_from: '2026-06-16',
      current_to: '2026-07-15',
      previous_from: '2026-05-17',
      previous_to: '2026-06-15',
      currency: 'USD' as const,
    }
    const result = await getAnalyticsSummary(input)

    expect(params).toEqual(input)
    expect(result.currency).toBe('USD')
    expect(result.kpis.revenue).toEqual({ current: 25.5, previous: 10 })
    expect(result.kpis.visits.current).toBe(9)
    expect(result.buckets[0]).toMatchObject({ revenue: 25.5, cumulative_patients: 4 })
    expect(result.appointment_status).toEqual([{ status: 'completed', count: 7 }])
    expect(result.top_debtors[0].debt).toBe(8.25)
  })

  it('rejects malformed financial payloads instead of showing fake zeroes', async () => {
    mock.onGet('/analytics/summary').reply(200, {
      data: {
        currency: 'UZS',
        permissions: { payments: true, patients: true, appointments: true },
        kpis: {
          revenue: { current: 'bad', previous: 0 },
          debt: { current: 0, previous: null },
          patients: { current: 0, previous: 0 },
          visits: { current: 0, previous: 0 },
        },
        buckets: [],
        appointment_status: [],
        top_debtors: [],
      },
    })

    await expect(
      getAnalyticsSummary({
        range: '7d',
        current_from: '2026-07-09',
        current_to: '2026-07-15',
        previous_from: '2026-07-02',
        previous_to: '2026-07-08',
        currency: 'UZS',
      })
    ).rejects.toThrow('Invalid analytics response at kpis.revenue.current')
  })
})
