import * as Sentry from '@sentry/react-native'
import Constants from 'expo-constants'
import {
  TELEMETRY_REDACTED,
  sanitizeTelemetryUrl,
  sanitizeXhrBreadcrumbData,
  scrubTelemetryValue,
} from './telemetryPrivacy'

// Mobile client crash + error reporter.
//
// Wiring overview:
//   • init() runs once at module load (called from App.tsx)
//   • DSN comes from EXPO_PUBLIC_SENTRY_DSN env var; if absent, init becomes
//     a no-op so dev doesn't ship breadcrumbs to a stranger's project.
//   • The backend already reports through the same Sentry org (see
//     backend/bootstrap/app.php → Integration::handles($exceptions)).
//     Use the SAME project so a single trace links server stack ↔ client
//     stack for the same request id.
//   • EAS Build's `@sentry/react-native/expo` config plugin handles source
//     map upload — it needs SENTRY_AUTH_TOKEN as an EAS secret and the
//     organization/project from app.json's plugin block.

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN
// `expo-constants` reads the running release channel / runtime version so
// the Sentry "Environment" facet shows preview vs production vs dev.
const RELEASE_CHANNEL =
  // EAS runtime version reflects what was actually built into the binary.
  (Constants.expoConfig as { runtimeVersion?: string })?.runtimeVersion ??
  (Constants.expoConfig?.version ?? 'unknown')

let initialized = false

export function initSentry(): void {
  if (initialized || !DSN) return
  initialized = true

  Sentry.init({
    dsn: DSN,
    // Sentry's React Native SDK ships a few performance hooks by default.
    // We start conservative: capture all unhandled JS errors and 10% of
    // navigation transactions. Crank tracesSampleRate up later once we
    // have a baseline of how chatty production really is.
    tracesSampleRate: 0.1,
    // Keep a generous breadcrumb buffer — they're the most useful context
    // when triaging a crash, and the cost is just a JS array.
    maxBreadcrumbs: 80,
    // Tag every event with the running channel so the Sentry UI can split
    // staging-only noise from real production issues at a glance.
    environment: __DEV__ ? 'development' : RELEASE_CHANNEL,
    // Strip anything that smells like a token or password from the payload
    // before it leaves the device. This is in addition to Sentry's
    // default data scrubbing in the project settings.
    beforeSend(event) {
      return scrubSensitive(event)
    },
    beforeBreadcrumb(crumb) {
      if (crumb.category === 'xhr') {
        return {
          ...crumb,
          data: sanitizeXhrBreadcrumbData(
            crumb.data as Record<string, unknown> | undefined
          ),
        }
      }
      return crumb
    },
    // We attach user context manually on login (see setSentryUser); don't
    // let Sentry auto-collect device identifiers as a substitute, since
    // those would correlate sessions across logins.
    sendDefaultPii: false,
  })
}

// Called from the auth flow on successful login. Sets the user.id only —
// not name/email — so PII never leaves the device. The id is enough to
// correlate a Sentry event back to a specific clinic in your backend
// audit logs.
export function setSentryUser(userId: string | null): void {
  if (!initialized) return
  if (userId) {
    Sentry.setUser({ id: userId })
  } else {
    Sentry.setUser(null)
  }
}

// Manual capture for branches where we'd otherwise swallow an error
// (network 5xx, mutation rejection that the UI handles inline, etc.).
// Sentry captures unhandled rejections automatically, so only call this
// when you specifically WANT a report for a caught error.
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return
  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value)
      })
      Sentry.captureException(error)
    })
  } else {
    Sentry.captureException(error)
  }
}

// Re-export Sentry.wrap so App.tsx can wrap the root component without
// importing the SDK directly — keeps the Sentry coupling in this file.
export const wrapApp = Sentry.wrap

interface ScrubbableEvent {
  request?: { data?: unknown; headers?: Record<string, string>; url?: string }
  extra?: Record<string, unknown>
}

function scrubSensitive<T extends ScrubbableEvent>(event: T): T {
  // Strip Authorization headers regardless of casing
  if (event.request?.headers) {
    const headers = { ...event.request.headers }
    for (const key of Object.keys(headers)) {
      if (/authorization|cookie|x-csrf-token|x-xsrf-token/i.test(key)) {
        headers[key] = '[scrubbed]'
      }
    }
    event.request.headers = headers
  }
  if (event.request?.url) {
    event.request.url = sanitizeTelemetryUrl(event.request.url)
  }
  // String request bodies cannot be inspected safely. Structured values are
  // recursively scrubbed, including clinical fields nested in arrays.
  if (event.request?.data != null) {
    event.request.data =
      typeof event.request.data === 'string'
        ? TELEMETRY_REDACTED
        : scrubTelemetryValue(event.request.data)
  }
  if (event.extra && typeof event.extra === 'object') {
    event.extra = scrubTelemetryValue(event.extra) as Record<string, unknown>
  }
  return event
}
