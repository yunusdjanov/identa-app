import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import AppointmentsScreen from '../AppointmentsScreen'
import { I18nProvider } from '../../../i18n'
import { useAuthStore } from '../../../stores/auth'
import { listAppointments } from '../../../api/appointments'
import { listPatients } from '../../../api/patients'
import type { ApiUser } from '../../../types'

const mockNavigate = jest.fn()
const mockActionSheet = jest.fn()

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    addListener: () => jest.fn(),
  }),
}))

jest.mock('../../../api/appointments', () => ({
  createPatientCardFromGuest: jest.fn(),
  listAppointments: jest.fn(),
  updateAppointmentStatus: jest.fn(),
  deleteAppointment: jest.fn(),
}))
jest.mock('../../../api/patients', () => ({
  listPatients: jest.fn(),
}))

jest.mock('../../../components/ui/Toast', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  }),
}))
jest.mock('../../../components/ui/Dialog', () => ({
  useDialog: () => ({ actionSheet: mockActionSheet }),
}))

jest.mock('../../../components/navigation/AppHeader', () => {
  const React = require('react')
  const { Pressable, Text, View } = require('react-native')
  return {
    __esModule: true,
    default: ({ title, leading, actions, supportingContent }: any) =>
      React.createElement(
        View,
        null,
        leading,
        React.createElement(Text, null, title),
        supportingContent,
        actions
      ),
    HeaderIconButton: ({ label, onPress, disabled }: any) =>
      React.createElement(
        Pressable,
        {
          accessibilityRole: 'button',
          accessibilityLabel: label,
          disabled,
          onPress,
        },
        React.createElement(Text, null, label)
      ),
  }
})
jest.mock('../../../components/navigation/ProfileAvatarButton', () => () => null)
jest.mock('../../../components/appointments/WeekGridView', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    __esModule: true,
    default: () => React.createElement(View, { testID: 'week-grid' }),
    PLANNER_COLUMN_GAP: 8,
    PLANNER_GRID_SIDE_INSET: 8,
    PLANNER_ROW_GAP: 8,
  }
})
jest.mock('../../../components/appointments/SwipeableWeek', () => ({ children }: any) => children)
jest.mock('../../../components/ui/FadeSwitch', () => ({ children }: any) => children)
jest.mock('../../../components/appointments/AppointmentDetailSheet', () => () => null)
jest.mock('../../../components/appointments/AppointmentEditSheet', () => () => null)

const dentist: ApiUser = {
  id: 'dentist-1',
  name: 'Test Dentist',
  email: 'dentist@example.test',
  role: 'dentist',
  account_status: 'active',
  email_verified_at: '2026-07-01T00:00:00Z',
}

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider defaultLocale="uz">
        <AppointmentsScreen />
      </I18nProvider>
    </QueryClientProvider>
  )
}

describe('AppointmentsScreen patient directory search', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockActionSheet.mockResolvedValue(-1)
    useAuthStore.setState({ user: dentist, isAuthenticated: true, isHydrating: false })
    jest.mocked(listAppointments).mockResolvedValue({
      data: [],
      meta: {
        pagination: { current_page: 1, last_page: 1, per_page: 0, total: 0 },
      },
    })
    jest.mocked(listPatients).mockResolvedValue({
      data: [
        {
          id: 'patient-1',
          patient_id: 'P-1',
          full_name: 'Ali Karimov',
          phone: '+998901234567',
          secondary_phone: null,
          photo_url: 'https://cdn.example.test/patients/patient-1.jpg',
          photo_scan_status: 'approved',
        },
        {
          id: 'patient-2',
          patient_id: 'P-2',
          full_name: 'Bekzod Rustamov',
          phone: '+998901111111',
          secondary_phone: null,
        },
        {
          id: 'patient-3',
          patient_id: 'P-3',
          full_name: 'Dilnoza Norova',
          phone: '+998902222222',
          secondary_phone: null,
        },
        {
          id: 'patient-4',
          patient_id: 'P-4',
          full_name: 'Malika Oripova',
          phone: '+998903333333',
          secondary_phone: null,
        },
      ],
      meta: {
        pagination: { current_page: 1, last_page: 2, per_page: 3, total: 4 },
      },
    })
  })

  it('matches the search button size to the overflow menu button', () => {
    const screen = renderScreen()
    const searchVisual = StyleSheet.flatten(
      screen.getByTestId('compact-icon-visual').props.style
    )
    const overflowVisual = StyleSheet.flatten(
      screen.getByTestId('overflow-menu-visual').props.style
    )

    expect(searchVisual).toMatchObject({
      width: 36,
      height: 36,
      borderRadius: 12,
    })
    expect(overflowVisual).toMatchObject(searchVisual)
    screen.unmount()
  })

  it('uses the compact cancellable lookup and opens the selected patient', async () => {
    const screen = renderScreen()

    fireEvent.press(screen.getByLabelText('Bemorlarni qidirish'))

    expect(await screen.findByText('Ali Karimov')).toBeTruthy()
    expect(screen.getByText('Bekzod Rustamov')).toBeTruthy()
    expect(screen.getByText('Dilnoza Norova')).toBeTruthy()
    expect(screen.queryByText('Malika Oripova')).toBeNull()
    expect(
      StyleSheet.flatten(screen.getByTestId('planner-patient-search-results').props.style)
    ).toMatchObject({ position: 'absolute' })
    expect(listPatients).toHaveBeenCalledWith(
      {
        search: undefined,
        sort: '-updated_at',
        page: 1,
        per_page: 3,
      },
      { signal: expect.anything() }
    )

    fireEvent.changeText(
      screen.getByPlaceholderText('Bemor ismi yoki telefon...'),
      'Ali'
    )

    // Placeholder data remains interactive while the global lookup refreshes.
    expect(screen.getByText('Ali Karimov')).toBeTruthy()
    await waitFor(
      () => {
        expect(listPatients).toHaveBeenCalledWith(
          {
            search: 'Ali',
            sort: 'full_name',
            page: 1,
            per_page: 3,
          },
          { signal: expect.anything() }
        )
      },
      { timeout: 2000 }
    )

    expect(screen.queryByText('Bekzod Rustamov')).toBeNull()
    expect(screen.queryByText('Dilnoza Norova')).toBeNull()

    fireEvent.press(screen.getByLabelText('Ali Karimov, +998901234567'))
    expect(mockNavigate).toHaveBeenCalledWith('PatientDetail', { id: 'patient-1' })
    screen.unmount()
  })

  it('uses profile photos returned by the patient directory without detail fan-out', async () => {
    const screen = renderScreen()

    fireEvent.press(screen.getByLabelText('Bemorlarni qidirish'))

    const avatar = await screen.findByLabelText('Ali Karimov')
    expect(avatar.props.source).toEqual({
      uri: 'https://cdn.example.test/patients/patient-1.jpg',
      headers: undefined,
    })
    expect(listPatients).toHaveBeenCalledTimes(1)
    screen.unmount()
  })

  it('clears the query separately and closes search from the results panel', async () => {
    const screen = renderScreen()

    fireEvent.press(screen.getByLabelText('Bemorlarni qidirish'))
    expect(await screen.findByText('Yaqinda yangilanganlar')).toBeTruthy()

    const input = screen.getByPlaceholderText('Bemor ismi yoki telefon...')
    fireEvent.press(screen.getByText('Tozalash'))
    expect(screen.queryByText('Yaqinda yangilanganlar')).toBeNull()
    expect(screen.getByPlaceholderText('Bemor ismi yoki telefon...')).toBeTruthy()

    // Entering a new query restores suggestions after the panel was cleared.
    fireEvent.changeText(input, 'Ali')
    expect(await screen.findByLabelText('Ali Karimov, +998901234567')).toBeTruthy()

    const clearButton = await screen.findByTestId('searchbar-clear', {}, { timeout: 2000 })
    fireEvent.press(clearButton)
    expect(input.props.value).toBe('')

    fireEvent.press(screen.getByLabelText('Yopish'))
    expect(screen.queryByPlaceholderText('Bemor ismi yoki telefon...')).toBeNull()
    screen.unmount()
  })

  it('opens planner actions in the shared grid design with Close', async () => {
    const screen = renderScreen()

    expect(await screen.findByTestId('week-grid')).toBeTruthy()
    fireEvent.press(screen.getByLabelText('Planner amallari'))

    await waitFor(() => {
      expect(mockActionSheet).toHaveBeenCalledWith({
        title: 'Planner amallari',
        options: [
          expect.objectContaining({ key: 'view', icon: 'list-outline' }),
          expect.objectContaining({
            key: 'export',
            icon: 'download-outline',
            disabled: true,
          }),
        ],
        layout: 'grid',
        cancelLabel: 'Yopish',
      })
    })
    screen.unmount()
  })

})
