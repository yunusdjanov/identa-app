import { buildPatientsPdfHtml } from '../patientExport'
import type { ApiPatient } from '../../types'

const labels = {
  title: 'Bemorlar ro\'yxati',
  generatedAt: 'Yaratildi',
  loadedCount: 'Eksport qilingan',
  name: 'Bemor',
  phone: 'Telefon',
  dateOfBirth: 'Tug\'ilgan sana',
  categories: 'Kategoriyalar',
  lastVisit: 'Oxirgi tashrif',
  empty: '—',
  shareTitle: 'Ulashish',
}

describe('buildPatientsPdfHtml', () => {
  it('renders loaded patient data and count', () => {
    const patients: ApiPatient[] = [{
      id: 'p-1',
      patient_id: 'P-1',
      full_name: 'Aziz Karimov',
      phone: '+998901234567',
      date_of_birth: '1990-05-12',
      last_visit_at: '2026-07-10',
      categories: [{ id: 'c-1', name: 'VIP', color: '#F59E0B' }],
    }]

    const html = buildPatientsPdfHtml(patients, 'uz', labels, new Date('2026-07-15T10:00:00Z'))

    expect(html).toContain('Eksport qilingan: 1')
    expect(html).toContain('Aziz Karimov')
    expect(html).toContain('VIP')
    expect(html).toContain('+998 90 123 45 67')
  })

  it('escapes patient-controlled values before inserting them into HTML', () => {
    const patients: ApiPatient[] = [{
      id: 'p-1',
      patient_id: 'P-1',
      full_name: '<script>alert("x")</script>',
      phone: null,
    }]

    const html = buildPatientsPdfHtml(patients, 'en', labels)

    expect(html).not.toContain('<script>alert')
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
  })
})
