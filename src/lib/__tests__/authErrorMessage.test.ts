import { ApiError } from '../../api/client'
import { getAuthErrorMessage } from '../authErrorMessage'

const t = (key: string) => `translated:${key}`

describe('getAuthErrorMessage', () => {
  it.each([
    ['network', 'login.errors.network'],
    ['timeout', 'login.errors.timeout'],
    ['rate_limited', 'login.errors.tooManyAttempts'],
    ['server', 'login.errors.server'],
  ] as const)('maps %s errors to an actionable message', (kind, key) => {
    expect(getAuthErrorMessage(new ApiError('failure', kind), t, 'fallback')).toBe(
      `translated:${key}`
    )
  })

  it.each(['validation', 'unauthorized', 'forbidden', 'not_found', 'unknown'] as const)(
    'keeps %s auth errors generic',
    (kind) => {
      expect(getAuthErrorMessage(new ApiError('sensitive detail', kind), t, 'auth.failed')).toBe(
        'translated:auth.failed'
      )
    }
  )

  it('uses the fallback for non-API failures', () => {
    expect(getAuthErrorMessage(new Error('unexpected'), t, 'auth.failed')).toBe(
      'translated:auth.failed'
    )
  })
})
