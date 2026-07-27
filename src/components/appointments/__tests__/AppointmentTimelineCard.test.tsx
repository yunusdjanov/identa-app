import React from 'react'
import { StyleSheet } from 'react-native'
import { fireEvent, render } from '@testing-library/react-native'

import AppointmentTimelineCard from '../AppointmentTimelineCard'
import PatientAvatar from '../../ui/PatientAvatar'
import { I18nProvider } from '../../../i18n'
import { colors, radius } from '../../../constants/theme'
import { API_URL } from '../../../constants'
import type { ApiAppointment } from '../../../types'

const appointment: ApiAppointment = {
  id: 'appointment-1',
  patient_id: 'patient-1',
  patient_name: 'Ali Karimov',
  appointment_date: '2026-07-25',
  start_time: '09:00',
  end_time: '09:45',
  status: 'scheduled',
  notes: 'Restavratsiya',
}

function renderCard(
  overrides: Partial<ApiAppointment> = {},
  props: { onPress?: jest.Mock; hasConflict?: boolean } = {}
) {
  return render(
    <I18nProvider defaultLocale="uz">
      <AppointmentTimelineCard
        appointment={{ ...appointment, ...overrides }}
        onPress={props.onPress}
        hasConflict={props.hasConflict}
      />
    </I18nProvider>
  )
}

describe('<AppointmentTimelineCard />', () => {
  it('keeps the original card structure with compact spacing', () => {
    const screen = renderCard()

    expect(screen.getByText('09:00')).toBeTruthy()
    expect(screen.getByText('09:45')).toBeTruthy()
    expect(screen.getByText('Ali Karimov')).toBeTruthy()
    expect(screen.getByText('Restavratsiya')).toBeTruthy()
    expect(screen.getByText('Rejalashtirilgan')).toBeTruthy()
    expect(screen.getByText('45m')).toBeTruthy()
    expect(screen.UNSAFE_getByType(PatientAvatar).props.uri).toBe(
      `${API_URL}/patients/patient-1/photo?variant=thumbnail`
    )
    expect(
      StyleSheet.flatten(
        screen.getByTestId('appointment-timeline-surface-appointment-1').props.style
      )
    ).toMatchObject({
      padding: 10,
      gap: 8,
      borderRadius: radius.xl,
      shadowOpacity: 0.06,
    })
  })

  it('exposes a clear action label and preserves press behavior', () => {
    const onPress = jest.fn()
    const screen = renderCard({}, { onPress })

    const card = screen.getByRole('button', {
      name: '09:00, Ali Karimov, Rejalashtirilgan',
    })
    fireEvent(card, 'pressIn')
    const pressedStyle = StyleSheet.flatten(
      screen.getByTestId('appointment-timeline-row-appointment-1').props.style
    )
    expect(pressedStyle).toMatchObject({
      transform: [{ scale: 0.995 }],
    })
    expect(pressedStyle.opacity).toBeUndefined()
    fireEvent(card, 'pressOut')
    fireEvent.press(card)

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('shows guest and conflict states without changing the layout', () => {
    const screen = renderCard(
      {
        id: 'guest-appointment',
        patient_id: null,
        patient_name: undefined,
        guest_name: 'Malika S.',
        is_guest: true,
      },
      { hasConflict: true }
    )

    expect(screen.getByText('Malika S.')).toBeTruthy()
    expect(screen.getByText('Mehmon')).toBeTruthy()
    expect(screen.getByText("Vaqt to'qnashuvi")).toBeTruthy()
    expect(screen.UNSAFE_getByType(PatientAvatar).props.uri).toBeNull()
    expect(
      StyleSheet.flatten(
        screen.getByTestId('appointment-timeline-surface-guest-appointment').props.style
      )
    ).toMatchObject({ borderColor: colors.danger })
  })
})
