import React, { useMemo, useState } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import * as Haptics from 'expo-haptics'

import BottomSheet from './BottomSheet'
import Button from './Button'
import Icon from './Icon'
import { useI18n } from '../../i18n'
import {
  formatMonthYear,
  isSameDay,
  toLocalDateKey,
  fromLocalDateKey,
} from '../../lib/format'
import { font, radius, spacing, typography } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

interface Props {
  visible: boolean
  // Currently-selected date as YYYY-MM-DD, or null for unselected state.
  value: string | null
  // Lower bound — dates before this are disabled. Defaults to today.
  // Pass null to allow any past date (e.g. date-of-birth picker).
  minDate?: Date | null
  // Upper bound — dates after this are disabled. Defaults to 365 days from
  // today; pass null to allow any future date.
  maxDate?: Date | null
  title?: string
  onClose: () => void
  onConfirm: (dateKey: string) => void
}

// iOS-HIG-aligned month-grid date picker. Used in the appointment create
// flow as the "open calendar" affordance behind the date label. The
// wheel-style `DateWheelPicker` is reserved for fields like date-of-birth
// where the year range is wide; this calendar is better for picking
// near-term clinic dates because the user can see day-of-week context.
export default function MonthCalendarPicker({
  visible,
  value,
  minDate,
  maxDate,
  title,
  onClose,
  onConfirm,
}: Props) {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])

  const today = useMemo(() => startOfDay(new Date()), [])
  const min = useMemo(() => (minDate === undefined ? today : minDate ? startOfDay(minDate) : null), [today, minDate])
  const max = useMemo(
    () =>
      maxDate === undefined
        ? addDays(today, 365)
        : maxDate
          ? startOfDay(maxDate)
          : null,
    [today, maxDate]
  )

  // The month currently being browsed (1st of month). Initialized to
  // either the selected date's month or today's month.
  const initialMonth = useMemo(() => {
    if (value) {
      const parsed = fromLocalDateKey(value)
      return new Date(parsed.getFullYear(), parsed.getMonth(), 1)
    }
    return new Date(today.getFullYear(), today.getMonth(), 1)
  }, [value, today])

  const [viewMonth, setViewMonth] = useState<Date>(initialMonth)
  // Local selection state — the parent only learns via onConfirm when the
  // user explicitly accepts. Closing without confirm preserves the prior
  // selection.
  const [picked, setPicked] = useState<string | null>(value)

  // Re-anchor when the sheet re-opens so the user always lands on a
  // sensible month rather than wherever they left off last time.
  React.useEffect(() => {
    if (!visible) return
    setPicked(value)
    setViewMonth(initialMonth)
  }, [visible, value, initialMonth])

  const goPrevMonth = () => {
    Haptics.selectionAsync()
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
  }
  const goNextMonth = () => {
    Haptics.selectionAsync()
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
  }

  // Mon..Sun grid for the visible month — leading blanks from the prior
  // month and trailing blanks after the last day so the grid is a full
  // 6-row rectangle (consistent height regardless of which month).
  const cells = useMemo(() => buildMonthGrid(viewMonth), [viewMonth])

  const handlePick = (date: Date) => {
    if (!isSelectable(date, min, max)) return
    Haptics.selectionAsync()
    setPicked(toLocalDateKey(date))
  }

  const handleConfirm = () => {
    if (!picked) {
      onClose()
      return
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    onConfirm(picked)
  }

  const weekdayLabels = useMemo(() => buildWeekdayLabels(locale), [locale])

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title ?? t('common.pickDate')}>
      {/* Month nav */}
      <View style={styles.monthRow}>
        <Pressable onPress={goPrevMonth} hitSlop={8} style={styles.monthBtn}>
          <Icon name="chevron-back" size={20} color={c.brand as string} />
        </Pressable>
        <Text style={styles.monthLabel}>
          {formatMonthYear(viewMonth, locale)}
        </Text>
        <Pressable onPress={goNextMonth} hitSlop={8} style={styles.monthBtn}>
          <Icon name="chevron-forward" size={20} color={c.brand as string} />
        </Pressable>
      </View>

      {/* Weekday header */}
      <View style={styles.weekHeader}>
        {weekdayLabels.map((label) => (
          <Text key={label} style={styles.weekHeaderCell}>
            {label}
          </Text>
        ))}
      </View>

      {/* Day grid */}
      <View style={styles.grid}>
        {cells.map((cell, idx) => {
          if (!cell) {
            return <View key={`b-${idx}`} style={styles.dayCell} />
          }
          const selectable = isSelectable(cell, min, max)
          const isPicked = picked && isSameDay(cell, fromLocalDateKey(picked))
          const isToday = isSameDay(cell, today)
          return (
            <Pressable
              key={toLocalDateKey(cell)}
              onPress={() => handlePick(cell)}
              disabled={!selectable}
              style={[styles.dayCell, isPicked && styles.dayCellPicked]}
              hitSlop={2}
            >
              <Text
                style={[
                  styles.dayNumber,
                  !selectable && styles.dayNumberDisabled,
                  isToday && !isPicked && styles.dayNumberToday,
                  isPicked && styles.dayNumberPicked,
                ]}
              >
                {cell.getDate()}
              </Text>
              {/* Today dot — only when not the current selection */}
              {isToday && !isPicked ? <View style={styles.todayDot} /> : null}
            </Pressable>
          )
        })}
      </View>

      <View style={styles.actions}>
        <Button
          title={t('common.cancel')}
          variant="secondary"
          fullWidth
          onPress={() => {
            Haptics.selectionAsync()
            onClose()
          }}
          style={{ flex: 1 }}
        />
        <Button
          title={t('common.confirm')}
          fullWidth
          onPress={handleConfirm}
          disabled={!picked}
          style={{ flex: 1 }}
        />
      </View>
    </BottomSheet>
  )
}

// Build a Mon..Sun-anchored 6×7 grid for the given month. Returns 42 cells
// where leading/trailing positions outside the month are `null`.
function buildMonthGrid(viewMonth: Date): (Date | null)[] {
  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  // JS Date.getDay() returns 0..6 Sun..Sat; we want Mon=0..Sun=6.
  const firstDayJs = new Date(year, month, 1).getDay()
  const leadingBlanks = (firstDayJs + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (Date | null)[] = []
  for (let i = 0; i < leadingBlanks; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length < 42) cells.push(null)
  return cells
}

function buildWeekdayLabels(_locale: string): string[] {
  // Keep weekday headers compact and consistent across locales by using
  // 2-letter abbreviations derived from a known Monday reference date.
  // (Intl-derived labels can collide for some locales when narrowed to
  // 1-2 chars; this explicit list avoids that.)
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((s) => s.slice(0, 2))
}

function isSelectable(date: Date, min: Date | null, max: Date | null): boolean {
  const d = startOfDay(date).getTime()
  if (min && d < startOfDay(min).getTime()) return false
  if (max && d > startOfDay(max).getTime()) return false
  return true
}

function startOfDay(d: Date): Date {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  return out
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    monthRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
      paddingBottom: spacing.sm,
    },
    monthBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.lg,
      backgroundColor: c.fillTertiary,
    },
    monthLabel: {
      ...typography.headline,
      color: c.label,
      textTransform: 'capitalize',
    },
    weekHeader: {
      flexDirection: 'row',
      paddingHorizontal: 2,
      paddingBottom: spacing.xs,
    },
    weekHeaderCell: {
      flex: 1,
      textAlign: 'center',
      fontFamily: font('600'),
      fontSize: 11,
      fontWeight: '600',
      color: c.labelSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 2,
    },
    dayCell: {
      // 100% / 7 ≈ 14.285% — explicit width keeps the grid rectangle
      // pixel-stable regardless of locale-specific font widths.
      width: `${100 / 7}%`,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      // Subtle padding so the picked-circle doesn't touch its neighbors.
      padding: 2,
    },
    dayCellPicked: {
      // Visual treatment handled via the inner Text + dot styles below so
      // the press target stays a clean square — keeps tap targets generous.
    },
    dayNumber: {
      ...typography.bodyEmphasized,
      color: c.label,
      width: 36,
      height: 36,
      lineHeight: 36,
      textAlign: 'center',
      borderRadius: 18,
    },
    dayNumberDisabled: {
      color: c.labelQuaternary,
    },
    dayNumberToday: {
      color: c.brand,
      fontWeight: '700',
    },
    dayNumberPicked: {
      backgroundColor: c.brand,
      color: '#FFFFFF',
      overflow: 'hidden',
    },
    todayDot: {
      position: 'absolute',
      bottom: 4,
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.brand,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
  })
}
