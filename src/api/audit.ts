import client from './client'
import type { ApiAuditLogEntry, ApiListResponse } from '../types'

// Real endpoint exists (GET /audit-logs, AuditLogController). A small mock
// branch keeps the Action-logs sheet usable in mock mode (no backend running).
const USE_MOCK =
  process.env.EXPO_PUBLIC_MOCK_AUDIT !== 'false' &&
  process.env.EXPO_PUBLIC_USE_MOCK_API !== 'false'

export interface AuditLogQuery {
  page?: number
  per_page?: number
  search?: string
  event_type?: string
  date_from?: string
  date_to?: string
}

function mockDelay<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

function buildMockEntries(): ApiAuditLogEntry[] {
  const now = Date.now()
  const actor = { id: 'u1', name: 'Dr. Demo', role: 'dentist' }
  const mk = (
    i: number,
    event_type: string,
    entity_type: string | null,
    entity_id: string | null,
    metadata: Record<string, unknown> | null = null
  ): ApiAuditLogEntry => ({
    id: `audit-${i}`,
    event_type,
    entity_type,
    entity_id,
    actor_role: 'dentist',
    actor,
    ip_address: '127.0.0.1',
    user_agent: 'Identa Mobile',
    metadata,
    created_at: new Date(now - i * 45 * 60_000).toISOString(),
  })
  return [
    mk(1, 'patient.created', 'patient', 'p-1024'),
    mk(2, 'appointment.updated', 'appointment', 'a-552'),
    mk(3, 'payment.created', 'payment', 'pay-91'),
    mk(4, 'patient.treatment.created', 'treatment', 't-77'),
    mk(5, 'auth.permission_denied', 'route', '/patients/3f2a/odontogram', {
      required_permission: 'patients.view',
    }),
    mk(6, 'patient.archived', 'patient', 'p-1001'),
  ]
}

export async function listAuditLogs(
  params?: AuditLogQuery
): Promise<ApiListResponse<ApiAuditLogEntry>> {
  if (USE_MOCK) {
    let entries = buildMockEntries()
    const term = params?.search?.trim().toLowerCase()
    if (term) {
      entries = entries.filter(
        (e) =>
          e.event_type.toLowerCase().includes(term) ||
          (e.entity_type ?? '').toLowerCase().includes(term) ||
          (e.entity_id ?? '').toLowerCase().includes(term)
      )
    }
    if (params?.event_type && params.event_type !== 'all') {
      entries = entries.filter((e) => e.event_type === params.event_type)
    }
    const perPage = params?.per_page ?? 10
    const page = params?.page ?? 1
    const start = (page - 1) * perPage
    return mockDelay({
      data: entries.slice(start, start + perPage),
      meta: {
        pagination: {
          page,
          total_pages: Math.max(1, Math.ceil(entries.length / perPage)),
          per_page: perPage,
          total: entries.length,
        },
      },
    })
  }

  // Backend expects Laravel-style nested filter[*] params (see api/patients.ts).
  const realParams: Record<string, string | number> = {
    page: params?.page ?? 1,
    per_page: params?.per_page ?? 10,
    sort: '-created_at',
  }
  if (params?.search) realParams['filter[search]'] = params.search
  if (params?.event_type && params.event_type !== 'all') {
    realParams['filter[event_type]'] = params.event_type
  }
  if (params?.date_from) realParams['filter[date_from]'] = params.date_from
  if (params?.date_to) realParams['filter[date_to]'] = params.date_to

  const { data } = await client.get<ApiListResponse<ApiAuditLogEntry>>('/audit-logs', {
    params: realParams,
  })
  return data
}
