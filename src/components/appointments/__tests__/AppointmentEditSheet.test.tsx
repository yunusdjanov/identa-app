import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import AppointmentEditSheet from '../AppointmentEditSheet'
import { I18nProvider } from '../../../i18n'
import { ToastProvider } from '../../ui/Toast'
import { getProfile } from '../../../api/profile'
import { listAppointments, updateAppointment } from '../../../api/appointments'
import type { ApiAppointment } from '../../../types'

jest.mock('../../ui/BottomSheet', () => {
  const React = require('react')
  const { Text, View } = require('react-native')
  return function MockBottomSheet({ visible, title, children }: any) {
    return visible
      ? React.createElement(
          View,
          null,
          React.createElement(Text, null, title),
          children
        )
      : null
  }
})
jest.mock('../../ui/MonthCalendarPicker', () => {
  const React = require('react')
  const { Pressable, Text, View } = require('react-native')
  return function MockMonthCalendarPicker({ visible, minDate, onConfirm }: any) {
    return visible
      ? React.createElement(
          View,
          { testID: 'edit-calendar', minDate },
          React.createElement(
            Pressable,
            {
              testID: 'edit-calendar-choose-past',
              onPress: () => onConfirm('2030-01-14'),
            },
            React.createElement(Text, null, 'Past')
          ),
          React.createElement(
            Pressable,
            {
              testID: 'edit-calendar-choose-today',
              onPress: () => onConfirm('2030-01-15'),
            },
            React.createElement(Text, null, 'Today')
          )
        )
      : null
  }
})
jest.mock('../../../api/profile', () => ({ getProfile: jest.fn() }))
jest.mock('../../../api/appointments', () => ({
  listAppointments: jest.fn(),
  updateAppointment: jest.fn(),
}))

const appointment: ApiAppointment = {
  id: 'appointment-1',
  patient_id: 'patient-1',
  patient_name: 'Ali Karimov',
  appointment_date: '2030-01-16',
  start_time: '09:00',
  end_time: '09:30',
  status: 'scheduled',
  notes: 'Checkup',
}

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 44, left: 0, right: 0, bottom: 34 },
}

function renderSheet() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <QueryClientProvider client={queryClient}>
        <I18nProvider defaultLocale="uz">
          <ToastProvider>
            <AppointmentEditSheet
              visible
              appointment={appointment}
              onClose={jest.fn()}
            />
          </ToastProvider>
        </I18nProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}

describe('<AppointmentEditSheet />', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date(2030, 0, 15, 10, 5, 0, 0))
    jest.clearAllMocks()
    jest.mocked(getProfile).mockResolvedValue({
      working_hours: { start: '09:00', end: '12:00' },
    } as Awaited<ReturnType<typeof getProfile>>)
    jest.mocked(listAppointments).mockResolvedValue({
      data: [],
      meta: {
        pagination: { current_page: 1, last_page: 1, per_page: 0, total: 0 },
      },
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('uses compact selectors and rejects a newly selected past date', async () => {
    const screen = renderSheet()

    await waitFor(() => {
      expect(screen.getByTestId('appointment-edit-time-selector')).toBeEnabled()
    })
    expect(screen.queryByText('Ertaga')).toBeNull()

    fireEvent.press(screen.getByTestId('appointment-edit-date-selector'))
    expect(screen.getByTestId('edit-calendar').props.minDate).toEqual(
      new Date(2030, 0, 15)
    )
    fireEvent.press(screen.getByTestId('edit-calendar-choose-past'))

    expect(screen.getByRole('button', { name: 'Saqlash' })).toBeDisabled()
    fireEvent.press(screen.getByRole('button', { name: 'Saqlash' }))
    expect(updateAppointment).not.toHaveBeenCalled()
    screen.unmount()
  })

  it('does not offer already elapsed times after moving to today', async () => {
    const screen = renderSheet()
    await waitFor(() => {
      expect(screen.getByTestId('appointment-edit-time-selector')).toBeEnabled()
    })

    fireEvent.press(screen.getByTestId('appointment-edit-date-selector'))
    fireEvent.press(screen.getByTestId('edit-calendar-choose-today'))

    await waitFor(() => {
      expect(listAppointments).toHaveBeenLastCalledWith({ date: '2030-01-15' })
    })
    await waitFor(() => {
      expect(screen.getByTestId('appointment-edit-time-selector')).toBeEnabled()
    })
    fireEvent.press(screen.getByTestId('appointment-edit-time-selector'))

    expect(screen.queryByTestId('appointment-edit-time-09:00')).toBeNull()
    expect(screen.getByTestId('appointment-edit-time-10:30')).toBeTruthy()
    screen.unmount()
  })
})
