import client from './client'
import type { AnalyticsRange } from '../lib/analytics'
import type {
  ApiAnalyticsAppointmentStatus,
  ApiAnalyticsKpiPair,
  ApiAnalyticsSummary,
  ApiAppointment,
  DashboardCurrency,
} from '../types'

export interface AnalyticsSummaryParams {
  range: AnalyticsRange
  current_from: string
  current_to: string
  previous_from: string
  previous_to: string
  currency: DashboardCurrency
}

const APPOINTMENT_STATUSES = new Set<ApiAppointment['status']>([
  'scheduled',
  'completed',
  'cancelled',
  'no_show',
])

function contractError(path: string): never {
  throw new Error(`Invalid analytics response at ${path}`)
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return contractError(path)
  }
  return value as Record<string, unknown>
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) return contractError(path)
  return value
}

function string(value: unknown, path: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.trim() === '')) {
    return contractError(path)
  }
  return value
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') return contractError(path)
  return value
}

function number(value: unknown, path: string): number {
  if (
    !(
      typeof value === 'number' ||
      (typeof value === 'string' && value.trim() !== '')
    )
  ) {
    return contractError(path)
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return contractError(path)
  return parsed
}

function nullableNumber(value: unknown, path: string): number | null {
  return value === null ? null : number(value, path)
}

function currency(value: unknown): DashboardCurrency {
  return value === 'UZS' || value === 'USD'
    ? value
    : contractError('currency')
}

function kpiPair(value: unknown, path: string): ApiAnalyticsKpiPair {
  const row = record(value, path)
  return {
    current: number(row.current, `${path}.current`),
    previous: number(row.previous, `${path}.previous`),
  }
}

function mapAnalyticsSummary(value: unknown): ApiAnalyticsSummary {
  const raw = record(value, 'data')
  const permissions = record(raw.permissions, 'permissions')
  const kpis = record(raw.kpis, 'kpis')
  const debt = record(kpis.debt, 'kpis.debt')

  const appointmentStatus: ApiAnalyticsAppointmentStatus[] = array(
    raw.appointment_status,
    'appointment_status'
  ).map((value, index) => {
    const row = record(value, `appointment_status.${index}`)
    const status = string(row.status, `appointment_status.${index}.status`)
    if (!APPOINTMENT_STATUSES.has(status as ApiAppointment['status'])) {
      return contractError(`appointment_status.${index}.status`)
    }
    return {
      status: status as ApiAppointment['status'],
      count: number(row.count, `appointment_status.${index}.count`),
    }
  })

  return {
    currency: currency(raw.currency),
    permissions: {
      payments: boolean(permissions.payments, 'permissions.payments'),
      patients: boolean(permissions.patients, 'permissions.patients'),
      appointments: boolean(permissions.appointments, 'permissions.appointments'),
    },
    kpis: {
      revenue: kpiPair(kpis.revenue, 'kpis.revenue'),
      debt: {
        current: number(debt.current, 'kpis.debt.current'),
        previous: nullableNumber(debt.previous, 'kpis.debt.previous'),
      },
      patients: kpiPair(kpis.patients, 'kpis.patients'),
      visits: kpiPair(kpis.visits, 'kpis.visits'),
    },
    buckets: array(raw.buckets, 'buckets').map((value, index) => {
      const bucket = record(value, `buckets.${index}`)
      return {
        key: string(bucket.key, `buckets.${index}.key`),
        revenue: number(bucket.revenue, `buckets.${index}.revenue`),
        debt: number(bucket.debt, `buckets.${index}.debt`),
        new_patients: number(bucket.new_patients, `buckets.${index}.new_patients`),
        cumulative_patients: number(
          bucket.cumulative_patients,
          `buckets.${index}.cumulative_patients`
        ),
      }
    }),
    appointment_status: appointmentStatus,
    top_debtors: array(raw.top_debtors, 'top_debtors').map((value, index) => {
      const debtor = record(value, `top_debtors.${index}`)
      return {
        name: string(debtor.name, `top_debtors.${index}.name`),
        phone: string(debtor.phone, `top_debtors.${index}.phone`, true),
        debt: number(debtor.debt, `top_debtors.${index}.debt`),
      }
    }),
  }
}

export async function getAnalyticsSummary(
  params: AnalyticsSummaryParams
): Promise<ApiAnalyticsSummary> {
  const response = await client.get<{ data: unknown }>('/analytics/summary', {
    params,
  })
  return mapAnalyticsSummary(response.data.data)
}
