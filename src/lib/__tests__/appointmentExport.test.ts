import { buildAppointmentsPdfHtml } from '../appointmentExport'
import type { ApiAppointment } from '../../types'

const labels = {
  title: 'Navbatlar',
  generatedAt: 'Yaratildi',
  loadedCount: 'Eksport qilingan',
  dateTime: 'Sana va vaqt',
  patient: 'Bemor',
  reason: 'Sabab',
  status: 'Holat',
  empty: '—',
  shareTitle: 'Ulashish',
  statuses: {
    scheduled: 'Rejalashtirilgan',
    completed: 'Bajarilgan',
    cancelled: 'Bekor qilingan',
    no_show: 'Kelmagan',
  },
}

describe('buildAppointmentsPdfHtml', () => {
  it('renders appointment data, translated status and count', () => {
    const appointment: ApiAppointment = {
      id: 'a-1',
      patient_id: 'p-1',
      patient_name: 'Aziz Karimov',
      appointment_date: '2026-07-16',
      start_time: '09:00:00',
      end_time: '09:30:00',
      status: 'scheduled',
      notes: 'Konsultatsiya',
    }

    const html = buildAppointmentsPdfHtml(
      [appointment],
      'uz',
      labels,
      new Date('2026-07-15T10:00:00Z')
    )

    expect(html).toContain('Eksport qilingan: 1')
    expect(html).toContain('Aziz Karimov')
    expect(html).toContain('Konsultatsiya')
    expect(html).toContain('Rejalashtirilgan')
    expect(html).toContain('09:00–09:30')
  })

  it('escapes appointment-controlled values', () => {
    const appointment: ApiAppointment = {
      id: 'a-1',
      patient_id: null,
      patient_name: '<script>alert("x")</script>',
      appointment_date: '2026-07-16',
      start_time: '09:00',
      end_time: '09:30',
      status: 'scheduled',
      notes: '<b>unsafe</b>',
    }

    const html = buildAppointmentsPdfHtml([appointment], 'en', labels)

    expect(html).not.toContain('<script>alert')
    expect(html).not.toContain('<b>unsafe</b>')
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
    expect(html).toContain('&lt;b&gt;unsafe&lt;/b&gt;')
  })

  it('uses the guest name when an appointment has no patient card', () => {
    const appointment: ApiAppointment = {
      id: 'a-guest',
      patient_id: null,
      patient_name: undefined,
      guest_name: 'Guest Patient',
      guest_phone: '+998901234567',
      is_guest: true,
      appointment_date: '2026-07-16',
      start_time: '09:00',
      end_time: '09:30',
      status: 'scheduled',
      notes: null,
    }

    const html = buildAppointmentsPdfHtml([appointment], 'uz', labels)

    expect(html).toContain('Guest Patient')
  })
})
