import React from 'react'
import { StyleSheet } from 'react-native'

import WeekGridView, {
  PLANNER_COLUMN_GAP,
  PLANNER_GRID_SIDE_INSET,
  PLANNER_ROW_GAP,
} from '../WeekGridView'
import DayMiniCard, { PLANNER_PAPER_LINE_COUNT } from '../DayMiniCard'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'

describe('WeekGridView', () => {
  it('keeps Sunday the same width as other day cards without a tip card', () => {
    const screen = renderWithProviders(
      <WeekGridView
        weekStart={new Date(2026, 6, 13)}
        appointmentsByDate={new Map()}
        onSelectDay={jest.fn()}
      />
    )

    const firstRowCards = screen.getByTestId('week-grid-row-1').findAllByType(DayMiniCard)
    const secondRowCards = screen.getByTestId('week-grid-row-2').findAllByType(DayMiniCard)
    const thirdRowCards = screen.getByTestId('week-grid-row-3').findAllByType(DayMiniCard)

    expect([
      firstRowCards[0].props.date.getDay(),
      firstRowCards[1].props.date.getDay(),
    ]).toEqual([1, 2])
    expect([
      secondRowCards[0].props.date.getDay(),
      secondRowCards[1].props.date.getDay(),
    ]).toEqual([3, 4])
    expect([
      thirdRowCards[0].props.date.getDay(),
      thirdRowCards[1].props.date.getDay(),
    ]).toEqual([5, 6])
    expect(screen.getByTestId('week-grid-row-4').findAllByType(DayMiniCard)).toHaveLength(1)
    expect(
      StyleSheet.flatten(screen.getByTestId('week-grid-row-1').props.style).columnGap
    ).toBe(PLANNER_COLUMN_GAP)
    expect(StyleSheet.flatten(screen.getByTestId('week-grid').props.style)).toMatchObject({
      marginHorizontal: PLANNER_GRID_SIDE_INSET,
      gap: PLANNER_ROW_GAP,
    })
    expect(PLANNER_GRID_SIDE_INSET).toBe(4)
    expect(PLANNER_COLUMN_GAP).toBe(3)
    expect(PLANNER_ROW_GAP).toBe(4)
    expect(screen.getByTestId('weekly-planner-empty-cell')).toBeTruthy()
    expect(screen.queryByTestId('weekly-planner-divider')).toBeNull()
    expect(screen.queryByTestId('weekly-planner-tip')).toBeNull()
    expect(screen.queryByText("Navbat yo'q")).toBeNull()
    expect(screen.queryByText('0 ta navbat')).toBeNull()
    expect(screen.getAllByTestId('planner-paper-line')).toHaveLength(
      7 * PLANNER_PAPER_LINE_COUNT
    )
  })
})
