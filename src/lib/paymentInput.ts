import type { MoneyCurrency } from '../api/payments'

export function normalizeDecimalInput(value: string, maxFractionDigits: number): string {
  const normalized = value
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace(/[^\d.]/g, '')
  const [rawWhole = '', ...rawDecimals] = normalized.split('.')
  const whole = rawWhole.replace(/^0+(?=\d)/, '')
  const decimal = rawDecimals.join('').slice(0, maxFractionDigits)
  const groupedWhole = (whole || (normalized.startsWith('0') ? '0' : '')).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ' '
  )

  if (maxFractionDigits > 0 && normalized.includes('.')) {
    return `${groupedWhole || '0'}.${decimal}`
  }

  return groupedWhole
}

export function formatExpenseAmountInput(value: string, currency: MoneyCurrency): string {
  return normalizeDecimalInput(value, currency === 'USD' ? 2 : 0)
}

export function formatExpenseQuantityInput(value: string): string {
  return normalizeDecimalInput(value, 2)
}

export function parseDecimalInput(value: string): number {
  const normalized = value.replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

export function parseExpenseAmountInput(value: string, currency: MoneyCurrency): number {
  const amount = parseDecimalInput(value)
  return currency === 'UZS' ? Math.round(amount) : amount
}
