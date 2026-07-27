import {
  formatExpenseAmountInput,
  formatExpenseQuantityInput,
  parseDecimalInput,
  parseExpenseAmountInput,
} from '../paymentInput'

describe('payment input formatting', () => {
  it('keeps UZS amounts integer-only and groups thousands', () => {
    expect(formatExpenseAmountInput('001234567.89', 'UZS')).toBe('1 234 567')
    expect(parseExpenseAmountInput('1 234 567', 'UZS')).toBe(1_234_567)
  })

  it('limits USD amounts to two decimal digits', () => {
    expect(formatExpenseAmountInput('1234,567', 'USD')).toBe('1 234.56')
    expect(parseExpenseAmountInput('1 234.56', 'USD')).toBe(1234.56)
  })

  it('limits quantity to two decimal digits', () => {
    expect(formatExpenseQuantityInput('00012.345')).toBe('12.34')
    expect(parseDecimalInput('12.34')).toBe(12.34)
  })

  it('collapses extra decimal separators safely', () => {
    expect(formatExpenseAmountInput('1.2.3', 'USD')).toBe('1.23')
  })
})
