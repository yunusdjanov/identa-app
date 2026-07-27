import {
  getPatientInactiveBefore,
  isPatientCategoryFilter,
} from '../patientFilters'

describe('patient filters', () => {
  it('distinguishes backend category ids from built-in filters', () => {
    expect(isPatientCategoryFilter('cat-vip')).toBe(true)
    expect(isPatientCategoryFilter('all')).toBe(false)
    expect(isPatientCategoryFilter('archived')).toBe(false)
    expect(isPatientCategoryFilter('inactive')).toBe(false)
  })

  it('builds calendar-safe inactivity cutoffs', () => {
    const monthEnd = new Date(2026, 7, 31)

    expect(getPatientInactiveBefore('inactive', monthEnd)).toBe('2026-02-28')
    expect(getPatientInactiveBefore('inactive_1y', monthEnd)).toBe('2025-08-31')
    expect(getPatientInactiveBefore('all', monthEnd)).toBeUndefined()
  })
})
