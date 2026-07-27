import { formatStoredPhone, getPhoneCallUrl, getTelegramPhoneUrl } from '../phoneFormat'

describe('formatStoredPhone', () => {
  it('formats stored Uzbek numbers consistently for read-only views', () => {
    expect(formatStoredPhone('+998901234567')).toBe('+998 90 123 45 67')
  })
})

describe('getTelegramPhoneUrl', () => {
  it('builds an official Telegram phone link from a formatted number', () => {
    expect(getTelegramPhoneUrl('+998 90 123 45 67')).toBe('https://t.me/+998901234567')
  })

  it('uses the primary number from legacy pipe-separated values', () => {
    expect(getTelegramPhoneUrl('+998901234567 | ext. 12')).toBe(
      'https://t.me/+998901234567'
    )
  })

  it('rejects missing, incomplete, and overlong numbers', () => {
    expect(getTelegramPhoneUrl(null)).toBeNull()
    expect(getTelegramPhoneUrl('12345')).toBeNull()
    expect(getTelegramPhoneUrl('+1234567890123456')).toBeNull()
  })
})

describe('getPhoneCallUrl', () => {
  it('normalizes formatting while keeping an international prefix', () => {
    expect(getPhoneCallUrl('+998 90 123 45 67')).toBe('tel:+998901234567')
    expect(getPhoneCallUrl('998 (90) 123-45-67')).toBe('tel:+998901234567')
  })

  it('keeps legacy local numbers local and rejects incomplete values', () => {
    expect(getPhoneCallUrl('90 123 45 67')).toBe('tel:901234567')
    expect(getPhoneCallUrl('123')).toBeNull()
  })
})
