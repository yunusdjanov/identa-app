import React from 'react'
import { View, StyleSheet } from 'react-native'
import DayMiniCard from './DayMiniCard'
import { addDays, toLocalDateKey } from '../../lib/format'
import { spacing } from '../../constants/theme'
import type { ApiAppointment } from '../../types'

interface Props {
  weekStart: Date  // Monday-aligned
  appointmentsByDate: Map<string, ApiAppointment[]>
  onSelectDay: (date: Date) => void
}

// Planner-style 2-column grid of 7 day cards (Mon–Sun).
// Tap a card → switch to that day in day-mode view.
export default function WeekGridView({ weekStart, appointmentsByDate, onSelectDay }: Props) {
  const days = React.useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )

  // Pair days into 2-column rows
  const rows: Date[][] = []
  for (let i = 0; i < days.length; i += 2) {
    rows.push(days.slice(i, i + 2))
  }

  return (
    <View style={styles.grid}>
      {rows.map((row, idx) => (
        <View key={idx} style={styles.row}>
          {row.map((date) => {
            const key = toLocalDateKey(date)
            const appts = appointmentsByDate.get(key) ?? []
            return (
              <DayMiniCard
                key={key}
                date={date}
                appointments={appts}
                onPress={() => onSelectDay(date)}
              />
            )
          })}
          {row.length === 1 ? <View style={styles.placeholder} /> : null}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    paddingHorizontal: spacing.lg,
    gap: 12,
    paddingTop: spacing.sm,
    paddingBottom: 120,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  placeholder: {
    flex: 1,
  },
})
