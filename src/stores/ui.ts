import { create } from 'zustand'

// Tiny store for cross-component UI flags (sheets opened from the tab bar
// but mounted elsewhere — e.g. the create-appointment sheet lives near
// navigation root but is opened from the FAB inside CustomTabBar).

interface UIState {
  // Create-appointment sheet
  createAppointmentOpen: boolean
  createAppointmentDate: string | null  // YYYY-MM-DD
  openCreateAppointment: (date?: string | null) => void
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
  requestAppointmentsViewDate: (date: string) => void
  clearAppointmentsViewDate: () => void
}

export const useUIStore = create<UIState>((set) => ({
  createAppointmentOpen: false,
  createAppointmentDate: null,
  openCreateAppointment: (date) =>
    set({ createAppointmentOpen: true, createAppointmentDate: date ?? null }),
  closeCreateAppointment: () =>
    set({ createAppointmentOpen: false, createAppointmentDate: null }),

  patientFormOpen: false,
  patientFormId: null,
  openPatientForm: (id) =>
    set({ patientFormOpen: true, patientFormId: id ?? null }),
  closePatientForm: () =>
    set({ patientFormOpen: false, patientFormId: null }),

  pendingAppointmentsViewDate: null,
  requestAppointmentsViewDate: (date) => set({ pendingAppointmentsViewDate: date }),
  clearAppointmentsViewDate: () => set({ pendingAppointmentsViewDate: null }),
}))
