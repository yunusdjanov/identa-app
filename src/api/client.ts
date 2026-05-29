import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { API_URL } from '../constants'
import { captureError } from '../lib/sentry'

// Normalized error surface so React Query / call sites can branch on
// `kind` instead of inspecting raw axios shapes. `kind` is the only field
// callers need; the rest carry context for debug / Sentry breadcrumbs.
export type ApiErrorKind =
  | 'network'      // request never reached the server (no internet, DNS, TLS)
  | 'timeout'      // server didn't respond within axios timeout
  | 'unauthorized' // 401 / 419 — session expired
  | 'forbidden'    // 403 — user can't do this action
  | 'not_found'    // 404
  | 'validation'   // 422 — backend rejected with field errors
  | 'server'       // 5xx
  | 'unknown'      // anything else

export class ApiError extends Error {
  kind: ApiErrorKind
  status?: number
  // Field-level validation errors (Laravel-style { email: ['Invalid'], ... })
  // surfaced as a flat map for easy form binding.
  fieldErrors?: Record<string, string[]>
  // Original axios error for the rare consumer that needs raw access
  // (Sentry context, retry policy, etc.).
  cause?: AxiosError

  constructor(message: string, kind: ApiErrorKind, opts?: {
    status?: number
    fieldErrors?: Record<string, string[]>
    cause?: AxiosError
  }) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = opts?.status
    this.fieldErrors = opts?.fieldErrors
    this.cause = opts?.cause
  }
}

const client = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  // We primarily authenticate via Bearer tokens (Sanctum personal access
  // tokens). Cookies are still needed for one narrow case: the CSRF
  // bootstrap flow used by `web` middleware auth routes (login, register,
  // forgot-password, reset-password, logout, change-password). Setting
  // `withCredentials: true` lets the native cookie jar retain the
  // `identa-session` cookie set by GET /auth/csrf-token and replay it on
  // the follow-up POST, even on platforms where Set-Cookie is filtered
  // from JS-visible response headers. See src/api/csrf.ts for the wider
  // story.
  withCredentials: true,
  // 20s is generous enough for typical mobile networks and short enough
  // that a hung request becomes a `timeout` error before the user gives up.
  timeout: 20_000,
})

// Custom request config flag: marks a request as already retried after a
// token refresh so we don't loop forever.
interface RetryableConfig extends InternalAxiosRequestConfig {
  _retriedAfterRefresh?: boolean
  _skipAuthHeader?: boolean
}

// Attach the bearer token from the auth store on every outbound request.
// We resolve the token lazily so app startup order doesn't matter (the
// store can hydrate after this module loads).
client.interceptors.request.use((config) => {
  const cfg = config as RetryableConfig
  if (cfg._skipAuthHeader) return cfg
  // Dynamic require avoids a circular import at module load.
  // `getState()` returns the latest snapshot, so token rotation after
  // refresh is picked up immediately.

  const { useAuthStore } = require('../stores/auth') as typeof import('../stores/auth')
  const token = useAuthStore.getState().tokens?.access_token
  if (token) {
    cfg.headers.Authorization = `Bearer ${token}`
  }
  return cfg
})

// Pending refresh promise — coalesces concurrent 401s so we only hit
// /auth/refresh once even if 10 requests fire at the same time.
let refreshInFlight: Promise<string | null> | null = null

async function performRefresh(): Promise<string | null> {
  const { useAuthStore } = require('../stores/auth') as typeof import('../stores/auth')
  const refreshToken = useAuthStore.getState().tokens?.refresh_token
  if (!refreshToken) return null

  try {
    // Skip the auth header on the refresh call — sending the expired
    // access token would just cause another 401 loop. The refresh token
    // travels in the body per the backend contract.
    const response = await axios.post(
      `${API_URL}/auth/refresh`,
      { refresh_token: refreshToken },
      {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        timeout: 20_000,
      }
    )
    const tokens = response.data?.data?.tokens
    if (tokens?.access_token && tokens?.refresh_token) {
      useAuthStore.getState().setTokens(tokens)
      return tokens.access_token
    }
    return null
  } catch {
    return null
  }
}

client.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const normalized = normalizeError(error)
    const original = error.config as RetryableConfig | undefined

    // 401 → attempt a single refresh + retry. If refresh fails we fall
    // through to the unauthorized branch below (logout).
    if (
      normalized.kind === 'unauthorized' &&
      original &&
      !original._retriedAfterRefresh
    ) {
      original._retriedAfterRefresh = true
      refreshInFlight = refreshInFlight ?? performRefresh().finally(() => {
        refreshInFlight = null
      })
      const newToken = await refreshInFlight
      if (newToken) {
        original.headers = original.headers ?? {}
        ;(original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`
        return client(original)
      }
    }

    // Session truly expired (no refresh available, refresh failed, or
    // already retried once) — drop the session so the app falls back to
    // the login screen.
    if (normalized.kind === 'unauthorized') {
      const { useAuthStore } = require('../stores/auth') as typeof import('../stores/auth')
      useAuthStore.getState().logout()
    }

    // Account blocked/deleted mid-session: the backend returns 403 with
    // `code: 'account_inactive'` (AuthController). Treat it like a session end
    // — drop local state so the app falls back to login. Gated on the specific
    // code so ordinary permission-denied 403s don't sign the user out.
    if (
      normalized.kind === 'forbidden' &&
      (error.response?.data as { code?: string } | undefined)?.code === 'account_inactive'
    ) {
      const { useAuthStore } = require('../stores/auth') as typeof import('../stores/auth')
      useAuthStore.getState().logout()
    }

    // Report classes of error that deserve operator attention. We skip
    // network/timeout/offline (expected on bad mobile networks),
    // unauthorized (a session boundary, not a bug), validation (the user
    // typed something wrong), and not_found (often legitimate). Server
    // errors and the catch-all `unknown` get reported — those usually
    // mean a backend regression or unexpected response shape.
    if (normalized.kind === 'server' || normalized.kind === 'unknown') {
      captureError(normalized, {
        api_url: original?.url ?? error.config?.url,
        api_method: (original?.method ?? error.config?.method)?.toUpperCase(),
        api_status: normalized.status,
        api_kind: normalized.kind,
      })
    }

    return Promise.reject(normalized)
  }
)

function normalizeError(error: AxiosError): ApiError {
  // No response means the request died on the wire — timeout or network.
  if (!error.response) {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return new ApiError('Request timed out', 'timeout', { cause: error })
    }
    return new ApiError('Network error', 'network', { cause: error })
  }

  const status = error.response.status
  const data = error.response.data as any

  if (status === 401 || status === 419) {
    return new ApiError('Session expired', 'unauthorized', { status, cause: error })
  }
  if (status === 403) {
    return new ApiError('Forbidden', 'forbidden', { status, cause: error })
  }
  if (status === 404) {
    return new ApiError('Not found', 'not_found', { status, cause: error })
  }
  if (status === 422) {
    return new ApiError(data?.message ?? 'Validation failed', 'validation', {
      status,
      fieldErrors: data?.errors,
      cause: error,
    })
  }
  if (status >= 500) {
    return new ApiError(data?.message ?? 'Server error', 'server', { status, cause: error })
  }
  return new ApiError(data?.message ?? 'Request failed', 'unknown', { status, cause: error })
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError
}

export default client
