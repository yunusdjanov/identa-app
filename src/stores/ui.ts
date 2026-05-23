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
}))
