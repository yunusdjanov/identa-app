import { create } from 'zustand'
import type { ApiPatient } from '../types'

// Tiny store for cross-component UI flags (sheets opened from the tab bar
// but mounted elsewhere — e.g. the create-appointment sheet lives near
// navigation root but is opened from the FAB inside CustomTabBar).

interface OpenCreateAppointmentOpts {
  date?: string | null
  // When provided, the sheet opens with this patient pre-selected — saves the
  // dentist a search step when scheduling from the patient detail screen.
  patient?: ApiPatient | null
}

interface UIState {
  // Create-appointment sheet
  createAppointmentOpen: boolean
  createAppointmentDate: string | null  // YYYY-MM-DD
  createAppointmentPatient: ApiPatient | null
  openCreateAppointment: (opts?: OpenCreateAppointmentOpts) => void
  closeCreateAppointment: () => void

  // Patient create / edit sheet (null = create, string = edit existing id)
  patientFormOpen: boolean
  patientFormId: string | null
  openPatientForm: (id?: string | null) => void
  closePatientForm: () => void

  // Cross-component request to jump the AppointmentsScreen to a specific
  // date. Set by the create flow so a newly-created appointment becomes
  // visible immediately even when it lands in a week other than the one
  // the user was viewing (e.g. created from Dashboard while on Sunday but
  // for next Monday). AppointmentsScreen consumes + clears it.
  pendingAppointmentsViewDate: string | null  // YYYY-MM-DD
  pendingAppointmentsViewId: string | null
  requestAppointmentsViewDate: (date: string) => void
  requestAppointmentsViewAppointment: (date: string, appointmentId: string) => void
  clearAppointmentsViewDate: () => void
  clearAppointmentsViewRequest: () => void
}

export const useUIStore = create<UIState>((set) => ({
  createAppointmentOpen: false,
  createAppointmentDate: null,
  createAppointmentPatient: null,
  openCreateAppointment: (opts) =>
    set({
      createAppointmentOpen: true,
      createAppointmentDate: opts?.date ?? null,
      createAppointmentPatient: opts?.patient ?? null,
    }),
  closeCreateAppointment: () =>
    set({
      createAppointmentOpen: false,
      createAppointmentDate: null,
      createAppointmentPatient: null,
    }),

  patientFormOpen: false,
  patientFormId: null,
  openPatientForm: (id) =>
    set({ patientFormOpen: true, patientFormId: id ?? null }),
  closePatientForm: () =>
    set({ patientFormOpen: false, patientFormId: null }),

  pendingAppointmentsViewDate: null,
  pendingAppointmentsViewId: null,
  requestAppointmentsViewDate: (date) =>
    set({ pendingAppointmentsViewDate: date, pendingAppointmentsViewId: null }),
  requestAppointmentsViewAppointment: (date, appointmentId) =>
    set({
      pendingAppointmentsViewDate: date,
      pendingAppointmentsViewId: appointmentId,
    }),
  clearAppointmentsViewDate: () => set({ pendingAppointmentsViewDate: null }),
  clearAppointmentsViewRequest: () =>
    set({ pendingAppointmentsViewDate: null, pendingAppointmentsViewId: null }),
}))
