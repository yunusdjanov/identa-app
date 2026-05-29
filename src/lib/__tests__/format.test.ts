import {
  formatCurrencyParts,
  formatCurrency,
  toLocalDateKey,
  fromLocalDateKey,
  isSameDay,
  addDays,
  getWeekStart,
  formatTime,
  minutesUntil,
  getRelativeBucket,
  getGreetingKey,
} from '../format'

describe('formatCurrencyParts', () => {
  it('returns 0 for non-finite values (defensive)', () => {
    // The dashboard mapper occasionally surfaced NaN before backend casing
    // was fixed — this guard is the reason cards stopped showing "не число".
    expect(formatCurrencyParts(NaN, 'uz')).toEqual({ value: '0', unit: "so'm" })
    expect(formatCurrencyParts(undefined as unknown as number, 'uz').value).toBe('0')
  })

  it('formats millions with one decimal under 10M', () => {
    const r = formatCurrencyParts(4_500_000, 'uz')
    expect(r.value).toBe('4.5')
    expect(r.unit).toBe("mln so'm")
  })

  it('drops decimal at 10M+ for compactness', () => {
    const r = formatCurrencyParts(12_300_000, 'ru')
    expect(r.value).toBe('12')
    expect(r.unit).toContain('млн')
  })

  it('formats thousands with K suffix for sub-million amounts', () => {
    const r = formatCurrencyParts(45_000, 'uz')
    expect(r.value).toBe('45')
    expect(r.unit).toBe("ming so'm")
  })

  it('preserves sign on negative balances', () => {
    expect(formatCurrencyParts(-2_500_000, 'uz').value).toBe('-2.5')
  })

  it('emits raw localized number for sub-1000 amounts', () => {
    const r = formatCurrencyParts(500, 'uz')
    expect(r.unit).toBe("so'm")
    expect(r.value).toContain('500')
  })
})

describe('formatCurrency (single string)', () => {
  it('joins value and suffix for the en locale', () => {
    expect(formatCurrency(4_500_000, 'en')).toBe('4.5M UZS')
  })
  it('handles negative numbers', () => {
    expect(formatCurrency(-1_000_000, 'en')).toBe('-1M UZS')
  })
})

describe('toLocalDateKey + fromLocalDateKey round-trip', () => {
  it('preserves the same Y-M-D across the conversion', () => {
    const d = new Date(2026, 4, 24) // May 24, 2026
    const key = toLocalDateKey(d)
    expect(key).toBe('2026-05-24')
    const back = fromLocalDateKey(key)
    expect(back.getFullYear()).toBe(2026)
    expect(back.getMonth()).toBe(4)
    expect(back.getDate()).toBe(24)
  })

  it('pads month and day to two digits', () => {
    expect(toLocalDateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('isSameDay', () => {
  it('ignores time when comparing the same calendar date', () => {
    const a = new Date(2026, 4, 24, 9, 0)
    const b = new Date(2026, 4, 24, 23, 59)
    expect(isSameDay(a, b)).toBe(true)
  })

  it('returns false across midnight boundaries', () => {
    const a = new Date(2026, 4, 24, 23, 59)
    const b = new Date(2026, 4, 25, 0, 1)
    expect(isSameDay(a, b)).toBe(false)
  })
})

describe('addDays', () => {
  it('returns a new date — does not mutate input', () => {
    const a = new Date(2026, 4, 24)
    const b = addDays(a, 3)
    expect(a.getDate()).toBe(24) // unchanged
    expect(b.getDate()).toBe(27)
  })

  it('rolls over month boundaries', () => {
    const b = addDays(new Date(2026, 4, 30), 5)
    expect(b.getMonth()).toBe(5)
    expect(b.getDate()).toBe(4)
  })
})

describe('getWeekStart', () => {
  it('returns Monday for a midweek date', () => {
    // 2026-05-24 is a Sunday → previous Monday is 2026-05-18.
    const d = new Date(2026, 4, 24)
    const ws = getWeekStart(d)
    expect(ws.getDay()).toBe(1)
    expect(ws.getDate()).toBe(18)
  })

  it('returns this Monday when passed a Wednesday', () => {
    // 2026-05-20 is a Wednesday → Monday is 2026-05-18.
    const d = new Date(2026, 4, 20)
    expect(getWeekStart(d).getDate()).toBe(18)
  })

  it('strips the time portion', () => {
    const d = new Date(2026, 4, 20, 15, 42)
    const ws = getWeekStart(d)
    expect(ws.getHours()).toBe(0)
    expect(ws.getMinutes()).toBe(0)
  })
})

describe('formatTime', () => {
  it('truncates HH:MM:SS to HH:MM', () => {
    expect(formatTime('09:30:00')).toBe('09:30')
  })
  it('passes through HH:MM as-is', () => {
    expect(formatTime('09:30')).toBe('09:30')
  })
  it('handles short input defensively', () => {
    expect(formatTime('9')).toBe('9')
  })
})

describe('minutesUntil', () => {
  it('returns positive minutes for future times', () => {
    const now = new Date(2026, 4, 24, 9, 0)
    expect(minutesUntil('10:30', now)).toBe(90)
  })

  it('returns negative minutes for past times', () => {
    const now = new Date(2026, 4, 24, 12, 0)
    expect(minutesUntil('09:00', now)).toBe(-180)
  })

  it('parses HH:MM correctly', () => {
    const now = new Date(2026, 4, 24, 0, 0)
    expect(minutesUntil('00:30', now)).toBe(30)
  })
})

describe('getRelativeBucket', () => {
  it('returns "now" for <= 5 minutes', () => {
    expect(getRelativeBucket(3).bucket).toBe('now')
    expect(getRelativeBucket(5).bucket).toBe('now')
  })

  it('returns "soon" for 6-15 minutes', () => {
    expect(getRelativeBucket(10).bucket).toBe('soon')
    expect(getRelativeBucket(15).bucket).toBe('soon')
  })

  it('rounds "minutes" bucket to nearest 5', () => {
    expect(getRelativeBucket(33)).toEqual({ bucket: 'minutes', value: 35 })
  })

  it('uses "hour" for 60-119 minutes', () => {
    expect(getRelativeBucket(75).bucket).toBe('hour')
  })

  it('returns rounded hours for 2-4h', () => {
    expect(getRelativeBucket(150)).toEqual({ bucket: 'hours', value: 3 })
  })

  it('falls back to "later" beyond 4h', () => {
    expect(getRelativeBucket(300).bucket).toBe('later')
  })
})

describe('getGreetingKey', () => {
  it('returns morning before noon', () => {
    expect(getGreetingKey(new Date(2026, 4, 24, 8))).toBe('morning')
  })
  it('returns afternoon 12-17', () => {
    expect(getGreetingKey(new Date(2026, 4, 24, 14))).toBe('afternoon')
  })
  it('returns evening 18+', () => {
    expect(getGreetingKey(new Date(2026, 4, 24, 20))).toBe('evening')
  })
})
