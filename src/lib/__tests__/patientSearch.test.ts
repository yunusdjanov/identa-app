import { patientMatchesSearch } from '../patientSearch'

const patient = {
  patient_id: 'P-1042',
  full_name: 'Ali Karimov',
  phone: '+998 90 123 45 67',
  secondary_phone: '+998 91 765 43 21',
}

describe('patientMatchesSearch', () => {
  it.each(['ali', 'KARIMOV', '90123', '+99891765'])(
    'matches patient identity using %s',
    (search) => {
      expect(patientMatchesSearch(patient, search)).toBe(true)
    }
  )

  it('does not match unrelated text', () => {
    expect(patientMatchesSearch(patient, 'Hasan')).toBe(false)
  })
})
