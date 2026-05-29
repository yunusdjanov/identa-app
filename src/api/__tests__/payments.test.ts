import MockAdapter from 'axios-mock-adapter'
import client from '../client'
import { recordQuickPayment, deletePayment, updatePayment } from '../payments'
import { useAuthStore } from '../../stores/auth'
import { useNetworkStore } from '../../stores/network'

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

describe('payments API', () => {
  let mock: MockAdapter

  beforeEach(() => {
    mock = new MockAdapter(client)
    authed()
  })
  afterEach(() => mock.restore())

  it('recordQuickPayment posts to the patient-scoped endpoint', async () => {
    let urlSeen = ''
    let bodySeen: any = null
    mock.onPost(/\/patients\/p-1\/quick-payments/).reply((config) => {
      urlSeen = config.url ?? ''
      bodySeen = JSON.parse(config.data)
      return [
        201,
        {
          data: {
            id: 'pay-1',
            invoice_id: 'inv-1',
            patient_id: 'p-1',
            amount: 50000,
            payment_method: 'cash',
            payment_date: '2026-05-24',
            notes: null,
            created_at: '2026-05-24T00:00:00Z',
          },
        },
      ]
    })

    const result = await recordQuickPayment('p-1', {
      amount: 50000,
      payment_method: 'cash',
      payment_date: '2026-05-24',
      treatment_id: 'tx-1',
    })
    expect(urlSeen).toBe('/patients/p-1/quick-payments')
    expect(bodySeen.amount).toBe(50000)
    expect(bodySeen.treatment_id).toBe('tx-1')
    expect(result.id).toBe('pay-1')
  })

  it('deletePayment hits DELETE /payments/{id}', async () => {
    let urlSeen = ''
    let methodSeen = ''
    mock.onDelete(/\/payments\/pay-9/).reply((config) => {
      urlSeen = config.url ?? ''
      methodSeen = config.method ?? ''
      return [204]
    })
    await deletePayment('pay-9')
    expect(urlSeen).toBe('/payments/pay-9')
    expect(methodSeen).toBe('delete')
  })

  it('updatePayment PUTs the new amount/method/date', async () => {
    let bodySeen: any = null
    mock.onPut(/\/payments\/pay-1/).reply((config) => {
      bodySeen = JSON.parse(config.data)
      return [
        200,
        {
          data: {
            id: 'pay-1',
            invoice_id: 'inv-1',
            patient_id: 'p-1',
            amount: 75000,
            payment_method: 'card',
            payment_date: '2026-05-25',
            notes: 'corrected',
            created_at: '2026-05-24T00:00:00Z',
          },
        },
      ]
    })
    const r = await updatePayment('pay-1', {
      amount: 75000,
      payment_method: 'card',
      payment_date: '2026-05-25',
      notes: 'corrected',
    })
    expect(bodySeen.amount).toBe(75000)
    expect(bodySeen.payment_method).toBe('card')
    expect(r.amount).toBe(75000)
  })

  it('all three mutating calls throw OfflineError when offline', async () => {
    useNetworkStore.setState({ isOnline: false })
    await expect(
      recordQuickPayment('p-1', { amount: 1, payment_method: 'cash', payment_date: '2026-05-24' })
    ).rejects.toMatchObject({ name: 'OfflineError' })
    await expect(deletePayment('pay-1')).rejects.toMatchObject({ name: 'OfflineError' })
    await expect(
      updatePayment('pay-1', { amount: 1, payment_method: 'cash', payment_date: '2026-05-24' })
    ).rejects.toMatchObject({ name: 'OfflineError' })
  })
})
