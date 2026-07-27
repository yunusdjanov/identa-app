import axios from 'axios'
import { API_URL } from '../constants'
import { getCurrentLocale } from '../lib/currentLocale'

// Why this file exists:
// The Laravel backend's auth routes — login, register, forgot-password,
// reset-password, google, logout, change-password — live in the `web`
// middleware group (see backend/routes/api.php). That group always enforces
// CSRF for POST/PUT/PATCH/DELETE, even for mobile clients.
//
// The bootstrap dance the backend expects:
//   1) GET  /auth/csrf-token       → returns `{token: <plain>}` + sets
//                                    `identa-session` cookie via Set-Cookie
//   2) POST /auth/<route>          → echo `X-CSRF-TOKEN: <plain>` header
//                                    plus `Cookie: identa-session=<value>`
//
// After login the Bearer token takes over for everything else, so this dance
// is only needed for the web-middleware auth endpoints.
//
// We use bare axios (not the shared `client`) so the request interceptor
// doesn't accidentally attach a Bearer header during the bootstrap. We also
// memoize the handshake for `CSRF_TTL_MS` to avoid an extra round-trip on
// every register-then-login chain.

interface CsrfHandshake {
  token: string
  // "identa-session=<encrypted-value>" — ready to drop into a Cookie header.
  // Empty string is a valid sentinel meaning "no session cookie was set"
  // (defensive fallback; the live backend always returns one).
  sessionCookie: string
  acquiredAt: number
}

// 10 min is comfortably inside Laravel's default 120-min session lifetime
// while still being short enough that a stale handshake fails fast and
// triggers a fresh fetch, rather than wasting a POST attempt.
const CSRF_TTL_MS = 10 * 60 * 1000

let cached: CsrfHandshake | null = null
let inFlight: Promise<CsrfHandshake> | null = null

export function clearCsrf(): void {
  cached = null
}

function extractSessionCookie(setCookie: unknown): string {
  // axios exposes Set-Cookie as either a string or string[] depending on
  // platform/transport. Normalize to an array and scan for the session cookie.
  const arr: string[] = Array.isArray(setCookie)
    ? (setCookie as string[])
    : typeof setCookie === 'string'
      ? [setCookie]
      : []

  // Preferred: backend's named session cookie (SESSION_COOKIE env on Laravel
  // side, defaults to `identa-session` for this deployment).
  for (const raw of arr) {
    const match = /^\s*([^=;\s]+)\s*=\s*([^;]+)/.exec(raw)
    if (!match) continue
    const name = match[1]!
    if (name === 'identa-session') {
      return `${name}=${match[2]!}`
    }
  }

  // Fallback: pick the first non-XSRF cookie. Covers backends that rename
  // the session cookie without our prior knowledge.
  for (const raw of arr) {
    const match = /^\s*([^=;\s]+)\s*=\s*([^;]+)/.exec(raw)
    if (!match) continue
    const name = match[1]!
    if (name && name !== 'XSRF-TOKEN') {
      return `${name}=${match[2]!}`
    }
  }

  return ''
}

async function fetchCsrf(): Promise<CsrfHandshake> {
  // Bare axios call — bypasses our authenticated client so no Bearer header
  // sneaks in. The csrf-token route itself doesn't require auth.
  //
  // `withCredentials: true` is a defense-in-depth measure:
  //   • Manual cookie extraction (below) works on iOS but is often blocked
  //     on RN Android — newer RN strips Set-Cookie out of the JS-visible
  //     response headers for security reasons.
  //   • Setting withCredentials prompts the system's native cookie store
  //     (NSHTTPCookieStorage / OkHttp CookieJar) to retain the cookie and
  //     auto-attach it on the next same-origin request, even if we never
  //     see the value in JS-land.
  const response = await axios.get(`${API_URL}/auth/csrf-token`, {
    headers: { Accept: 'application/json', 'Accept-Language': getCurrentLocale() },
    timeout: 20_000,
    withCredentials: true,
  })

  const token = (response.data as { token?: string } | null)?.token
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('CSRF token missing from /auth/csrf-token response')
  }

  const sessionCookie = extractSessionCookie(
    (response.headers as Record<string, unknown>)['set-cookie']
  )

  return { token, sessionCookie, acquiredAt: Date.now() }
}

// Returns a cached handshake if it's still fresh, otherwise fetches one.
// Concurrent callers are coalesced onto a single in-flight request — useful
// when the register-then-login chain fires both calls simultaneously.
export async function acquireCsrf(forceRefresh = false): Promise<CsrfHandshake> {
  if (!forceRefresh && cached && Date.now() - cached.acquiredAt < CSRF_TTL_MS) {
    return cached
  }
  if (inFlight) return inFlight
  inFlight = fetchCsrf()
    .then((result) => {
      cached = result
      return result
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

// Headers to attach to a CSRF-protected POST. Caller decides which routes
// need them — typically anything under `/auth/*` except `/auth/refresh`
// (which lives outside the `web` middleware).
export function csrfHeaders(handshake: CsrfHandshake): Record<string, string> {
  const headers: Record<string, string> = {
    'X-CSRF-TOKEN': handshake.token,
  }
  // The `Cookie` header is the linchpin — Laravel matches the header token
  // against the session's stored `_token`, and it needs the session cookie
  // to locate that session in the first place.
  if (handshake.sessionCookie) {
    headers.Cookie = handshake.sessionCookie
  }
  return headers
}
