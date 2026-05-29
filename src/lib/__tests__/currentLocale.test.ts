import { getCurrentLocale, setCurrentLocale } from '../currentLocale'

describe('currentLocale (module-level mirror)', () => {
  afterEach(() => setCurrentLocale('ru'))

  it('starts with the project default locale', () => {
    // Default is 'ru' per src/constants/index.ts DEFAULT_LOCALE.
    expect(getCurrentLocale()).toBe('ru')
  })

  it('reflects setCurrentLocale immediately', () => {
    setCurrentLocale('uz')
    expect(getCurrentLocale()).toBe('uz')
    setCurrentLocale('en')
    expect(getCurrentLocale()).toBe('en')
  })
})
