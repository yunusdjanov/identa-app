import React from 'react'
import { StyleSheet, View } from 'react-native'

import DayMiniCard, { PLANNER_CARD_HEIGHT } from './DayMiniCard'
import { addDays, toLocalDateKey } from '../../lib/format'
import { spacing } from '../../constants/theme'
import type { ApiAppointment } from '../../types'

interface Props {
  weekStart: Date
  appointmentsByDate: Map<string, ApiAppointment[]>
  onSelectDay: (date: Date) => void
}

export const PLANNER_GRID_SIDE_INSET = 4
export const PLANNER_COLUMN_GAP = 3
export const PLANNER_ROW_GAP = 4

export default function WeekGridView({ weekStart, appointmentsByDate, onSelectDay }: Props) {
  const styles = stylesStatic
  const days = React.useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart]
  )

  const dayCard = (date: Date, side: 'left' | 'right') => {
    const key = toLocalDateKey(date)
    return (
      <DayMiniCard
        key={key}
        date={date}
        appointments={appointmentsByDate.get(key) ?? []}
        onPress={() => onSelectDay(date)}
        side={side}
      />
    )
  }

  const rows: Array<[Date, Date | null]> = [
    [days[0], days[1]],
    [days[2], days[3]],
    [days[4], days[5]],
    [days[6], null],
  ]

  return (
    <View style={styles.frame}>
      <View style={styles.grid} testID="week-grid">
        {rows.map(([left, right], index) => (
          <View key={toLocalDateKey(left)} style={styles.row} testID={`week-grid-row-${index + 1}`}>
            {dayCard(left, 'left')}
            {right ? (
              dayCard(right, 'right')
            ) : (
              <View style={styles.emptyCell} testID="weekly-planner-empty-cell" />
            )}
          </View>
        ))}
      </View>
    </View>
  )
}

const stylesStatic = StyleSheet.create({
  frame: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
  },
  grid: {
    marginHorizontal: PLANNER_GRID_SIDE_INSET,
    paddingHorizontal: 0,
    paddingTop: spacing.xs,
    paddingBottom: 120,
    gap: PLANNER_ROW_GAP,
  },
  row: {
    height: PLANNER_CARD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'stretch',
    columnGap: PLANNER_COLUMN_GAP,
  },
  emptyCell: {
    flex: 1,
    minWidth: 0,
    height: PLANNER_CARD_HEIGHT,
  },
})
