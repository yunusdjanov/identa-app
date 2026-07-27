import {
  TELEMETRY_REDACTED,
  sanitizeTelemetryUrl,
  sanitizeXhrBreadcrumbData,
  scrubTelemetryValue,
} from '../telemetryPrivacy'

describe('telemetry privacy', () => {
  it('removes query strings and clinical resource identifiers from URLs', () => {
    expect(
      sanitizeTelemetryUrl(
        'https://api.identa.uz/api/v1/patients/patient-123/photo?variant=thumbnail'
      )
    ).toBe('https://api.identa.uz/api/v1/patients/:id/photo')
    expect(sanitizeTelemetryUrl('/payments/patient/patient-123?currency=USD')).toBe(
      '/payments/patient/:id'
    )
  })

  it('scrubs authentication and clinical fields recursively, including arrays', () => {
    expect(
      scrubTelemetryValue({
        token: 'secret',
        appointment: {
          patient_name: 'Ali Karimov',
          notes: 'Diagnosis',
          status: 'scheduled',
        },
        rows: [{ phone: '+998901234567', amount: 100 }],
      })
    ).toEqual({
      token: TELEMETRY_REDACTED,
      appointment: {
        patient_name: TELEMETRY_REDACTED,
        notes: TELEMETRY_REDACTED,
        status: 'scheduled',
      },
      rows: [{ phone: TELEMETRY_REDACTED, amount: 100 }],
    })
  })

  it('keeps only safe debugging metadata in XHR breadcrumbs', () => {
    expect(
      sanitizeXhrBreadcrumbData({
        url: '/appointments/appointment-1?include=patient',
        method: 'PUT',
        status_code: 422,
        body: { guest_name: 'Patient', reason: 'Treatment' },
      })
    ).toEqual({
      url: '/appointments/:id',
      method: 'PUT',
      status_code: 422,
    })
  })
})
