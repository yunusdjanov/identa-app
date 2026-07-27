import React from 'react'
import { StyleSheet } from 'react-native'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import AppointmentDetailSheet from '../AppointmentDetailSheet'
import PatientAvatar from '../../ui/PatientAvatar'
import { DialogProvider } from '../../ui/Dialog'
import { I18nProvider } from '../../../i18n'
import { colors } from '../../../constants/theme'
import { API_URL } from '../../../constants'
import type { ApiAppointment } from '../../../types'

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 44, left: 0, right: 0, bottom: 34 },
}

const appointment: ApiAppointment = {
  id: 'appointment-1',
  patient_id: 'patient-1',
  patient_name: 'Ali Karimov',
  appointment_date: '2099-07-25',
  start_time: '09:00',
  end_time: '09:45',
  status: 'scheduled',
  notes: 'Restavratsiya',
}

function renderSheet({
  value = appointment,
  onStatusChange = jest.fn().mockResolvedValue(false),
  onEdit = jest.fn(),
  onDelete = jest.fn(),
}: {
  value?: ApiAppointment
  onStatusChange?: jest.Mock
  onEdit?: jest.Mock
  onDelete?: jest.Mock
} = {}) {
  const onClose = jest.fn()
  const screen = render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <I18nProvider defaultLocale="uz">
        <DialogProvider>
          <AppointmentDetailSheet
            appointment={value}
            visible
            onClose={onClose}
            onStatusChange={onStatusChange}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </DialogProvider>
      </I18nProvider>
    </SafeAreaProvider>
  )

  return { screen, onClose, onStatusChange, onEdit, onDelete }
}

describe('<AppointmentDetailSheet />', () => {
  beforeAll(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  it('uses the compact shared action-grid design while preserving details', () => {
    const { screen } = renderSheet()

    expect(screen.getByText('Ali Karimov')).toBeTruthy()
    expect(screen.getByText('Restavratsiya')).toBeTruthy()
    expect(screen.getByText('45 daqiqa')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Yopish' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Bajarildi' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Bekor qildim' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Kelmadi' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tahrirlash' })).toBeTruthy()
    expect(screen.getByRole('button', { name: "O'chirish" })).toBeTruthy()
    expect(screen.UNSAFE_getByType(PatientAvatar).props.uri).toBe(
      `${API_URL}/patients/patient-1/photo?variant=thumbnail`
    )

    expect(
      StyleSheet.flatten(screen.getByTestId('appointment-detail-header').props.style)
    ).toMatchObject({ minHeight: 48 })
    expect(
      StyleSheet.flatten(screen.getByTestId('appointment-detail-info').props.style)
    ).toMatchObject({
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.brandSoft,
    })
    expect(
      StyleSheet.flatten(screen.getByTestId('appointment-status-actions').props.style)
    ).toMatchObject({ flexDirection: 'row', gap: 6 })
  })

  it('keeps status and edit callbacks connected to the existing behavior', async () => {
    const onStatusChange = jest.fn().mockResolvedValue(false)
    const onEdit = jest.fn()
    const { screen } = renderSheet({ onStatusChange, onEdit })

    fireEvent.press(screen.getByRole('button', { name: 'Bajarildi' }))
    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith('appointment-1', 'completed')
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Tahrirlash' })).toBeEnabled()
    })

    fireEvent.press(screen.getByRole('button', { name: 'Tahrirlash' }))
    expect(onEdit).toHaveBeenCalledWith('appointment-1')
  })

  it('shows a guest name when the appointment has no patient card', () => {
    const { screen } = renderSheet({
      value: {
        ...appointment,
        id: 'guest-appointment',
        patient_id: null,
        patient_name: undefined,
        guest_name: 'Malika S.',
        guest_phone: '+998901234567',
        is_guest: true,
      },
    })

    expect(screen.getByText('Malika S.')).toBeTruthy()
    expect(screen.getByText('+998901234567')).toBeTruthy()
    expect(screen.UNSAFE_getByType(PatientAvatar).props.uri).toBeNull()
  })

  it('locks every destructive action while a status mutation is pending', async () => {
    let resolveStatus!: (saved: boolean) => void
    const onStatusChange = jest.fn(
      () => new Promise<boolean>((resolve) => {
        resolveStatus = resolve
      })
    )
    const { screen } = renderSheet({ onStatusChange })

    fireEvent.press(screen.getByRole('button', { name: 'Bajarildi' }))

    expect(screen.getByRole('button', { name: 'Tahrirlash' })).toBeDisabled()
    expect(screen.getByRole('button', { name: "O'chirish" })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Bekor qildim' })).toBeDisabled()

    await act(async () => resolveStatus(false))
    expect(screen.getByRole('button', { name: 'Tahrirlash' })).toBeEnabled()
  })
})
