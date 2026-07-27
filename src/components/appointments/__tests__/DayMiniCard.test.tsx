import React from 'react'
import { StyleSheet } from 'react-native'

import DayMiniCard, {
  PLANNER_DATE_RAIL_HEIGHT,
  PLANNER_DATE_RAIL_WIDTH,
  PLANNER_PAPER_LINE_COUNT,
} from '../DayMiniCard'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import type { ApiAppointment } from '../../../types'

function makeAppointments(count: number): ApiAppointment[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `appointment-${index}`,
    patient_id: `patient-${index}`,
    patient_name: `Patient ${index + 1}`,
    appointment_date: '2026-07-13',
    start_time: `${String(8 + index).padStart(2, '0')}:00`,
    end_time: `${String(8 + index).padStart(2, '0')}:30`,
    status: 'scheduled',
    notes: 'This note must stay hidden in the compact planner row',
  }))
}

describe('DayMiniCard appointment rows', () => {
  it('keeps the compact date rail away from the outer card edge', () => {
    const screen = renderWithProviders(
      <DayMiniCard
        date={new Date(2026, 6, 13)}
        appointments={[]}
        onPress={jest.fn()}
        side="left"
      />
    )

    expect(StyleSheet.flatten(screen.getByTestId('planner-date-rail').props.style)).toMatchObject({
      width: PLANNER_DATE_RAIL_WIDTH,
      height: PLANNER_DATE_RAIL_HEIGHT,
      marginLeft: 2,
    })
    expect(PLANNER_DATE_RAIL_WIDTH).toBe(28)
    expect(PLANNER_DATE_RAIL_HEIGHT).toBe(112)
  })

  it('keeps the first ten appointment rows visible without inner scrolling', () => {
    const screen = renderWithProviders(
      <DayMiniCard
        date={new Date(2026, 6, 13)}
        appointments={makeAppointments(PLANNER_PAPER_LINE_COUNT)}
        onPress={jest.fn()}
        side="left"
      />
    )

    expect(screen.getAllByTestId('planner-appointment-row')).toHaveLength(10)
    const dividers = screen.getAllByTestId('planner-appointment-divider')
    expect(dividers).toHaveLength(10)
    expect(StyleSheet.flatten(dividers[0]!.props.style)).toMatchObject({
      width: 1,
      height: 12,
      opacity: 0.34,
    })
    expect(StyleSheet.flatten(screen.getByText('08:00').props.style)).toMatchObject({
      width: 30,
      textAlign: 'right',
    })
    expect(screen.getByTestId('planner-appointment-scroll').props.scrollEnabled).toBe(false)
  })

  it('uses ten equal paper slots without doubling the final page border', () => {
    const screen = renderWithProviders(
      <DayMiniCard
        date={new Date(2026, 6, 13)}
        appointments={[]}
        onPress={jest.fn()}
        side="left"
      />
    )

    const lines = screen.getAllByTestId('planner-paper-line')
    expect(lines).toHaveLength(PLANNER_PAPER_LINE_COUNT)
    expect(StyleSheet.flatten(lines[0]!.props.style).borderBottomWidth).toBe(
      StyleSheet.hairlineWidth
    )
    expect(StyleSheet.flatten(lines[lines.length - 1]!.props.style).borderBottomWidth).toBe(0)
    expect(
      StyleSheet.flatten(screen.getByTestId('planner-paper-lines').props.style)
        .paddingHorizontal
    ).toBe(10)
  })

  it('enables nested scrolling above ten rows and only renders time and patient name', () => {
    const screen = renderWithProviders(
      <DayMiniCard
        date={new Date(2026, 6, 13)}
        appointments={makeAppointments(11)}
        onPress={jest.fn()}
        side="left"
      />
    )

    expect(screen.getAllByTestId('planner-appointment-row')).toHaveLength(11)
    expect(screen.getByTestId('planner-appointment-scroll').props.scrollEnabled).toBe(true)
    expect(screen.getByText('Patient 11')).toBeTruthy()
    expect(
      screen.queryByText('This note must stay hidden in the compact planner row')
    ).toBeNull()
  })

  it('visually de-emphasizes cancelled and no-show appointments', () => {
    const appointments = makeAppointments(2)
    appointments[0]!.status = 'cancelled'
    appointments[1]!.status = 'no_show'
    const screen = renderWithProviders(
      <DayMiniCard
        date={new Date(2026, 6, 13)}
        appointments={appointments}
        onPress={jest.fn()}
        side="left"
      />
    )

    for (const row of screen.getAllByTestId('planner-appointment-row')) {
      expect(StyleSheet.flatten(row.props.style)).toMatchObject({ opacity: 0.5 })
    }
  })
})
