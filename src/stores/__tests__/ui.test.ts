import { useUIStore } from '../ui'

describe('useUIStore', () => {
  beforeEach(() => {
    useUIStore.setState({
      createAppointmentOpen: false,
      createAppointmentDate: null,
      patientFormOpen: false,
      patientFormId: null,
      pendingAppointmentsViewDate: null,
    } as any)
  })

  describe('create-appointment sheet', () => {
    it('opens with an optional date', () => {
      useUIStore.getState().openCreateAppointment('2026-05-24')
      const s = useUIStore.getState()
      expect(s.createAppointmentOpen).toBe(true)
      expect(s.createAppointmentDate).toBe('2026-05-24')
    })

    it('opens without a date when called with no args', () => {
      useUIStore.getState().openCreateAppointment()
      const s = useUIStore.getState()
      expect(s.createAppointmentOpen).toBe(true)
      expect(s.createAppointmentDate).toBeNull()
    })

    it('closes and clears the date', () => {
      useUIStore.getState().openCreateAppointment('2026-05-24')
      useUIStore.getState().closeCreateAppointment()
      const s = useUIStore.getState()
      expect(s.createAppointmentOpen).toBe(false)
      expect(s.createAppointmentDate).toBeNull()
    })
  })

  describe('patient-form sheet', () => {
    it('opens in create mode when no id passed', () => {
      useUIStore.getState().openPatientForm()
      const s = useUIStore.getState()
      expect(s.patientFormOpen).toBe(true)
      expect(s.patientFormId).toBeNull()
    })

    it('opens in edit mode with the patient id', () => {
      useUIStore.getState().openPatientForm('p-1')
      expect(useUIStore.getState().patientFormId).toBe('p-1')
    })

    it('closes and clears id', () => {
      useUIStore.getState().openPatientForm('p-1')
      useUIStore.getState().closePatientForm()
      const s = useUIStore.getState()
      expect(s.patientFormOpen).toBe(false)
      expect(s.patientFormId).toBeNull()
    })
  })

  describe('pendingAppointmentsViewDate (cross-screen request)', () => {
    it('records the requested date', () => {
      useUIStore.getState().requestAppointmentsViewDate('2026-05-30')
      expect(useUIStore.getState().pendingAppointmentsViewDate).toBe('2026-05-30')
    })

    it('clears after consume', () => {
      useUIStore.getState().requestAppointmentsViewDate('2026-05-30')
      useUIStore.getState().clearAppointmentsViewDate()
      expect(useUIStore.getState().pendingAppointmentsViewDate).toBeNull()
    })
  })
})
