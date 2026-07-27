import {
  getKnownTreatmentTotal,
  getNextTreatmentPageParam,
  mergeTreatmentHistoryPages,
} from '../treatmentPagination'
import type { ApiTreatment } from '../../types'

const treatment = (id: string): ApiTreatment => ({
  id,
  patient_id: 'patient-1',
  teeth: [],
  treatment_type: 'Restoration',
  treatment_date: '2026-07-22',
  cost: 100_000,
  debt_amount: 100_000,
  paid_amount: 0,
  balance: 100_000,
  images: [],
})

const page = (
  ids: string[],
  pagination: Record<string, number> = {}
) => ({
  data: ids.map(treatment),
  meta: { pagination },
})

describe('treatment history pagination', () => {
  it('uses the backend total_pages contract when it is present', () => {
    expect(
      getNextTreatmentPageParam(
        page(['1'], { page: 2, total_pages: 3, per_page: 10, total: 21 }),
        2,
        10
      )
    ).toBe(3)
  })

  it('derives the last page from total when total_pages is omitted', () => {
    expect(
      getNextTreatmentPageParam(
        page(['11'], { page: 2, per_page: 10, total: 21 }),
        2,
        10
      )
    ).toBe(3)
  })

  it('continues after a full page when all totals are omitted', () => {
    const fullPage = page(Array.from({ length: 10 }, (_, index) => String(index + 1)))
    expect(getNextTreatmentPageParam(fullPage, 2, 10)).toBe(3)
  })

  it('stops on a short page when all totals are omitted', () => {
    expect(getNextTreatmentPageParam(page(['1', '2']), 2, 10)).toBeUndefined()
  })

  it('falls back to the requested page when page metadata is missing', () => {
    const fullPage = page(Array.from({ length: 10 }, (_, index) => String(index + 1)))
    expect(getNextTreatmentPageParam(fullPage, 4, 10)).toBe(5)
  })

  it('deduplicates overlapping pages without changing list order', () => {
    expect(
      mergeTreatmentHistoryPages([
        page(['newest', 'shared']),
        page(['shared', 'oldest']),
      ]).map((item) => item.id)
    ).toEqual(['newest', 'shared', 'oldest'])
  })

  it('returns null instead of a misleading loaded count when total is unknown', () => {
    expect(getKnownTreatmentTotal(page(['1']))).toBeNull()
    expect(getKnownTreatmentTotal(page(['1'], { total: 12 }))).toBe(12)
  })
})
