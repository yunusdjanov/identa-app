import React, { useMemo } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import { useI18n } from '../../i18n'
import { addDays, formatWeekdayShort, getWeekStart, isSameDay, toLocalDateKey } from '../../lib/format'
import { radius, font, typography } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

interface Props {
  selectedDate: Date
  onSelect: (date: Date) => void
  // Set of "YYYY-MM-DD" keys for which there are appointments — shows a dot
  busyDateKeys?: Set<string>
}

const DAY_CELL_WIDTH = 44
const DAY_CELL_HEIGHT = 60

export default function WeekStrip({ selectedDate, onSelect, busyDateKeys }: Props) {
  const { locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const weekStart = getWeekStart(selectedDate)
  const today = new Date()

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  return (
    <View style={styles.wrap}>
      {days.map((d) => {
        const isSelected = isSameDay(d, selectedDate)
        const isToday = isSameDay(d, today)
        const key = toLocalDateKey(d)
        const busy = busyDateKeys?.has(key) ?? false

        return (
          <Pressable
            key={key}
            onPress={() => {
              Haptics.selectionAsync()
              onSelect(d)
            }}
            style={({ pressed }) => [
              styles.cell,
              isSelected && styles.cellSelected,
              !isSelected && pressed && styles.cellPressed,
            ]}
          >
            <Text
              style={[
                styles.weekday,
                isSelected && styles.weekdayActive,
              ]}
            >
              {formatWeekdayShort(d, locale).slice(0, 3)}
            </Text>
            <Text
              style={[
                styles.dayNumber,
                isSelected && styles.dayNumberActive,
                !isSelected && isToday && styles.dayNumberToday,
              ]}
            >
              {d.getDate()}
            </Text>
            <View
              style={[
                styles.dot,
                busy && !isSelected && styles.dotBusy,
                busy && isSelected && styles.dotBusyOnSelected,
              ]}
            />
          </Pressable>
        )
      })}
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    width: DAY_CELL_WIDTH,
    height: DAY_CELL_HEIGHT,
    borderRadius: radius.lg,
    gap: 2,
  },
  cellSelected: {
    backgroundColor: c.brand,
  },
  cellPressed: {
    backgroundColor: c.fillQuaternary,
  },
  weekday: {
    fontFamily: font('600'),
    fontSize: 11,
    fontWeight: '600',
    color: c.labelSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  weekdayActive: {
    color: 'rgba(255,255,255,0.85)',
  },
  dayNumber: {
    fontFamily: font('700'),
    fontSize: 18,
    fontWeight: '700',
    color: c.label,
    letterSpacing: -0.3,
  },
  dayNumberActive: {
    color: '#FFFFFF',
  },
  dayNumberToday: {
    color: c.brand,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  dotBusy: {
    backgroundColor: c.brand,
  },
  dotBusyOnSelected: {
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  })
}
