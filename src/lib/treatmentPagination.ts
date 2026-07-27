import type { ApiTreatment, PaginationMeta } from '../types'

type TreatmentHistoryPage = {
  data?: ApiTreatment[] | null
  meta?: {
    pagination?: Partial<PaginationMeta> | null
  } | null
}

function asPositiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : null
}

function asNonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : null
}

/**
 * Resolves the next history page across both current and legacy paginator
 * shapes. When the backend omits totals, a full page means there may be more;
 * the first short (or empty) page safely ends pagination.
 */
export function getNextTreatmentPageParam(
  lastPage: TreatmentHistoryPage,
  lastRequestedPage: number,
  fallbackPageSize: number
): number | undefined {
  const pagination = lastPage.meta?.pagination
  const currentPage =
    asPositiveInteger(pagination?.page) ??
    asPositiveInteger(pagination?.current_page) ??
    asPositiveInteger(lastRequestedPage) ??
    1
  const pageSize =
    asPositiveInteger(pagination?.per_page) ??
    asPositiveInteger(fallbackPageSize) ??
    1
  const explicitTotalPages =
    asNonNegativeInteger(pagination?.total_pages) ??
    asNonNegativeInteger(pagination?.last_page)

  if (explicitTotalPages !== null) {
    return currentPage < explicitTotalPages ? currentPage + 1 : undefined
  }

  const total = asNonNegativeInteger(pagination?.total)
  if (total !== null) {
    const derivedTotalPages = Math.ceil(total / pageSize)
    return currentPage < derivedTotalPages ? currentPage + 1 : undefined
  }

  const loadedCount = Array.isArray(lastPage.data) ? lastPage.data.length : 0
  return loadedCount >= pageSize ? currentPage + 1 : undefined
}

/** Keeps page order stable while protecting the UI from overlapping pages. */
export function mergeTreatmentHistoryPages(
  pages: readonly TreatmentHistoryPage[] | undefined
): ApiTreatment[] {
  if (!pages) return []

  const seenIds = new Set<string>()
  const treatments: ApiTreatment[] = []

  for (const page of pages) {
    for (const treatment of page.data ?? []) {
      if (seenIds.has(treatment.id)) continue
      seenIds.add(treatment.id)
      treatments.push(treatment)
    }
  }

  return treatments
}

export function getKnownTreatmentTotal(page: TreatmentHistoryPage | undefined): number | null {
  return asNonNegativeInteger(page?.meta?.pagination?.total)
}
