export const TELEMETRY_REDACTED = '[scrubbed]'

const SENSITIVE_FIELD =
  /password|token|secret|authorization|cookie|csrf|patient_?name|guest_?name|full_?name|phone|email|address|birth|allerg|medicat|medical_?history|notes?|reason|comment|diagnos|treatment_?type/i

const TELEMETRY_RESOURCE_ID =
  /\/(patients|appointments|treatments|expenses)\/[^/?#]+/gi
const PAYMENT_PATIENT_ID = /\/payments\/patient\/[^/?#]+/gi

export function sanitizeTelemetryUrl(url: string): string {
  const withoutQuery = url.split(/[?#]/, 1)[0] ?? url
  return withoutQuery
    .replace(PAYMENT_PATIENT_ID, '/payments/patient/:id')
    .replace(TELEMETRY_RESOURCE_ID, '/$1/:id')
}

export function scrubTelemetryValue(
  value: unknown,
  seen: WeakSet<object> = new WeakSet()
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => scrubTelemetryValue(item, seen))
  }
  if (!value || typeof value !== 'object') return value
  if (seen.has(value)) return TELEMETRY_REDACTED
  seen.add(value)

  const out: Record<string, unknown> = {}
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_FIELD.test(key)
      ? TELEMETRY_REDACTED
      : scrubTelemetryValue(nestedValue, seen)
  }
  return out
}

/**
 * XHR breadcrumbs only need route, method, and result status for debugging.
 * Bodies and arbitrary adapter metadata are intentionally discarded because
 * appointment and patient writes contain clinical data.
 */
export function sanitizeXhrBreadcrumbData(
  data: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!data) return data

  const safe: Record<string, unknown> = {}
  if (typeof data.url === 'string') safe.url = sanitizeTelemetryUrl(data.url)
  if (typeof data.method === 'string') safe.method = data.method

  for (const key of ['status_code', 'statusCode', 'status']) {
    if (typeof data[key] === 'number') safe[key] = data[key]
  }

  return safe
}
