import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { font, typography } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { useI18n } from '../../i18n'
import {
  addDays,
  fromLocalDateKey,
  formatDayMonth,
  formatWeekdayLong,
  isSameDay,
} from '../../lib/format'

interface Props {
  dateKey: string  // "YYYY-MM-DD"
  count: number
}

// Section header used by the week-mode agenda list.
// Shows "Bugun, 16-may" / "Juma, 16-may" + appointment count.
export default function DaySectionHeader({ dateKey, count }: Props) {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const date = fromLocalDateKey(dateKey)
  const today = new Date()

  const tone =
    isSameDay(date, today) ? 'today' :
    isSameDay(date, addDays(today, 1)) ? 'tomorrow' :
    isSameDay(date, addDays(today, -1)) ? 'yesterday' :
    'other'

  const prefix =
    tone === 'today' ? t('appointments.todayLabel') :
    tone === 'tomorrow' ? t('appointments.tomorrowLabel') :
    tone === 'yesterday' ? t('appointments.yesterdayLabel') :
    formatWeekdayLong(date, locale)

  const label = `${prefix}, ${formatDayMonth(date, locale)}`

  return (
    <View style={styles.wrap}>
      <Text
        style={[styles.label, tone === 'today' && styles.labelToday]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text style={styles.count} numberOfLines={1}>
        {count}
      </Text>
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  label: {
    flex: 1,
    fontFamily: font('700'),
    fontSize: 17,
    fontWeight: '700',
    color: c.brandDeep,
    letterSpacing: -0.3,
    textTransform: 'capitalize',
  },
  labelToday: {
    color: c.brand,
  },
  count: {
    ...typography.footnote,
    color: c.labelSecondary,
    fontFamily: font('600'),
    fontWeight: '600',
  },
  })
}
