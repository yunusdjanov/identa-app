import { buildAnalyticsPdfHtml } from '../analyticsExport'
import type { ApiAnalyticsSummary } from '../../types'

const labels = {
  title: 'Analitika hisoboti',
  range: 'Davr',
  generatedAt: 'Yaratildi',
  period: 'Davr',
  revenue: 'Tushum',
  debt: 'Qarz',
  patients: 'Yangi bemorlar',
  visits: 'Tashriflar',
  shareTitle: 'Ulashish',
}

const analytics: ApiAnalyticsSummary = {
  currency: 'UZS',
  permissions: { payments: true, patients: true, appointments: true },
  kpis: {
    revenue: { current: 1000000, previous: 0 },
    debt: { current: 300000, previous: null },
    patients: { current: 4, previous: 2 },
    visits: { current: 9, previous: 6 },
  },
  buckets: [
    {
      key: '2026-07',
      revenue: 1000000,
      debt: 300000,
      new_patients: 4,
      cumulative_patients: 4,
    },
  ],
  appointment_status: [],
  top_debtors: [],
}

describe('buildAnalyticsPdfHtml', () => {
  it('exports the exact selected server aggregate', () => {
    const html = buildAnalyticsPdfHtml(
      analytics,
      '6 oy',
      'uz',
      labels,
      new Date('2026-07-15T10:00:00Z')
    )

    expect(html).toContain('Tushum')
    expect(html).toContain('1\u00a0000\u00a0000 UZS')
    expect(html).toContain('Tashriflar')
  })

  it('uses the selected server currency in every financial cell', () => {
    const html = buildAnalyticsPdfHtml(
      {
        ...analytics,
        currency: 'USD',
        kpis: {
          ...analytics.kpis,
          revenue: { current: 25.5, previous: 10 },
          debt: { current: 8.25, previous: null },
        },
        buckets: [
          {
            key: '2026-07',
            revenue: 25.5,
            debt: 8.25,
            new_patients: 4,
            cumulative_patients: 4,
          },
        ],
      },
      '6 oy',
      'en',
      labels
    )

    expect(html).toContain('25.50 USD')
    expect(html).toContain('8.25 USD')
    expect(html).not.toContain('UZS')
  })

  it('escapes translated and range labels before inserting them into HTML', () => {
    const html = buildAnalyticsPdfHtml(analytics, '<script>x</script>', 'en', {
      ...labels,
      title: '<b>Analytics</b>',
    })

    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;')
    expect(html).toContain('&lt;b&gt;Analytics&lt;/b&gt;')
  })
})
