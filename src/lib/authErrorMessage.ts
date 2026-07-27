import { isApiError } from '../api/client'

type Translate = (key: string) => string

export function getAuthErrorMessage(
  error: unknown,
  t: Translate,
  fallbackKey: string
): string {
  if (!isApiError(error)) return t(fallbackKey)

  switch (error.kind) {
    case 'network':
      return t('login.errors.network')
    case 'timeout':
      return t('login.errors.timeout')
    case 'rate_limited':
      return t('login.errors.tooManyAttempts')
    case 'server':
      return t('login.errors.server')
    default:
      return t(fallbackKey)
  }
}
