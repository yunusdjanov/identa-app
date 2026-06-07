import {
  computeDelta,
  outstandingBalance,
  withinLocalBounds,
  getRangeBounds,
  getPreviousRangeBounds,
  computeAnalyticsKpis,
  computeAppointmentStatusCounts,
  computeTopDebtors,
} from '../analytics'

describe('computeDelta', () => {
  it('returns null when there is no baseline', () => {
    expect(computeDelta(10, 0)).toBeNull()
  })
  it('computes percentage change', () => {
    expect(computeDelta(15, 10)).toBe(50)
    expect(computeDelta(5, 10)).toBe(-50)
  })
})

describe('outstandingBalance', () => {
  it('is debt minus paid, floored at 0', () => {
    expect(outstandingBalance({ debt_amount: 100, paid_amount: 30 })).toBe(70)
    expect(outstandingBalance({ debt_amount: 30, paid_amount: 100 })).toBe(0)
    expect(outstandingBalance({})).toBe(0)
  })
})

describe('withinLocalBounds', () => {
  it('parses YYYY-MM-DD as local midnight and includes both ends', () => {
    const start = new Date(2026, 5, 1, 0, 0, 0, 0)
    const end = new Date(2026, 5, 30, 23, 59, 59, 999)
    expect(withinLocalBounds('2026-06-01', start, end)).toBe(true)
    expect(withinLocalBounds('2026-06-30', start, end)).toBe(true)
    expect(withinLocalBounds('2026-05-31', start, end)).toBe(false)
    expect(withinLocalBounds(null, start, end)).toBe(false)
  })
})

describe('range bounds', () => {
  const now = new Date(2026, 5, 15, 12, 0, 0)
  it('30d window ends today and spans 30 days back', () => {
    const b = getRangeBounds('30d', now)
    expect(b.start.getMonth()).toBe(4) // May
    expect(b.start.getDate()).toBe(17)
    expect(b.end.getDate()).toBe(15)
  })
  it('previous window sits immediately before the current one', () => {
    const cur = getRangeBounds('30d', now)
    const prev = getPreviousRangeBounds('30d', now)
    expect(prev.end.getTime()).toBeLessThan(cur.start.getTime())
  })
  it('ytd starts Jan 1', () => {
    const b = getRangeBounds('ytd', now)
    expect(b.start.getMonth()).toBe(0)
    expect(b.start.getDate()).toBe(1)
  })
})

describe('computeAnalyticsKpis', () => {
  const now = new Date(2026, 5, 15, 12, 0, 0) // Jun 15, 2026 noon

  const result = computeAnalyticsKpis({
    range: '30d',
    now,
    outstandingDebtTotal: 1234,
    treatments: [
      { treatment_date: '2026-06-10', paid_amount: 1000, debt_amount: 1000 }, // current
      { treatment_date: '2026-05-01', paid_amount: 500, debt_amount: 500 }, // previous
      { treatment_date: '2026-06-10', paid_amount: 0, debt_amount: 0 }, // ignored (no paid)
    ],
    patients: [
      { created_at: '2026-06-01' }, // current
      { created_at: '2026-04-20' }, // previous
    ],
    appointments: [
      { appointment_date: '2026-06-10', status: 'completed' }, // current, past
      { appointment_date: '2026-06-12', status: 'scheduled' }, // current, past
      { appointment_date: '2026-06-15', status: 'completed' }, // current but FUTURE (excluded)
      { appointment_date: '2026-05-01', status: 'completed' }, // previous, past
    ],
  })

  it('revenue sums paid in current vs previous window', () => {
    expect(result.revenue.current).toBe(1000)
    expect(result.revenue.previous).toBe(500)
    expect(result.revenue.delta).toBe(100)
  })

  it('debt is the snapshot total with no delta', () => {
    expect(result.debt.current).toBe(1234)
    expect(result.debt.delta).toBeNull()
  })

  it('counts new patients per window', () => {
    expect(result.patients.current).toBe(1)
    expect(result.patients.previous).toBe(1)
    expect(result.patients.delta).toBe(0)
  })

  it('completion rate excludes future appointments from the denominator', () => {
    // current: Jun10 (done) + Jun12 (scheduled) = 2 past; Jun15 is future → excluded
    expect(result.completion.counts).toEqual({ completed: 1, total: 2 })
    expect(result.completion.current).toBe(50)
    // previous: May1 done → 100%; delta = (50-100)/100*100
    expect(result.completion.delta).toBe(-50)
  })
})

describe('computeAppointmentStatusCounts', () => {
  const now = new Date(2026, 5, 15, 12, 0, 0)
  it('counts statuses within the range only', () => {
    const counts = computeAppointmentStatusCounts(
      [
        { appointment_date: '2026-06-10', status: 'completed' },
        { appointment_date: '2026-06-12', status: 'scheduled' },
        { appointment_date: '2026-06-13', status: 'cancelled' },
        { appointment_date: '2026-06-14', status: 'no_show' },
        { appointment_date: '2026-05-01', status: 'completed' }, // out of 30d range
      ],
      '30d',
      now
    )
    expect(counts).toEqual({ scheduled: 1, completed: 1, cancelled: 1, no_show: 1 })
  })
})

describe('computeTopDebtors', () => {
  const now = new Date(2026, 5, 15, 12, 0, 0)
  it('aggregates outstanding balance per patient, desc, in range', () => {
    const top = computeTopDebtors(
      [
        { treatment_date: '2026-06-10', debt_amount: 1000, paid_amount: 200, patient_id: 'A', patient_name: 'Alice' },
        { treatment_date: '2026-06-11', debt_amount: 500, paid_amount: 0, patient_id: 'A', patient_name: 'Alice' },
        { treatment_date: '2026-06-10', debt_amount: 300, paid_amount: 300, patient_id: 'B', patient_name: 'Bob' }, // 0 → excluded
        { treatment_date: '2026-06-12', debt_amount: 400, paid_amount: 0, patient_id: 'C', patient_name: 'Carol' },
        { treatment_date: '2026-05-01', debt_amount: 9999, paid_amount: 0, patient_id: 'A', patient_name: 'Alice' }, // out of range
      ],
      '30d',
      now
    )
    expect(top).toEqual([
      { patientId: 'A', name: 'Alice', debt: 1300 },
      { patientId: 'C', name: 'Carol', debt: 400 },
    ])
  })
})
