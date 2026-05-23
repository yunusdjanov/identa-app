import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import * as Haptics from 'expo-haptics'
import Icon from '../ui/Icon'
import PatientAvatar from '../ui/PatientAvatar'
import { radius, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { useI18n } from '../../i18n'
import type { TFunction } from '../../i18n/helpers'
import { formatTime, minutesUntil, getRelativeBucket } from '../../lib/format'
import type { DashboardAppointmentView } from '../../types'

interface Props {
  appointment: DashboardAppointmentView
  highlightUpcoming?: boolean
  onPress?: () => void
}

export default function AppointmentRow({ appointment, highlightUpcoming, onPress }: Props) {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const reason = appointment.reason?.trim() || t('dashboard.generalAppointment')

  const handlePress = () => {
    if (onPress) {
      Haptics.selectionAsync()
      onPress()
    }
  }

  const relativeChip = highlightUpcoming ? renderRelativeChip(appointment.start_time, t, c, styles) : null

  const Inner = (
    <View style={styles.row}>
      <PatientAvatar name={appointment.patient_name} size={42} />

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {appointment.patient_name}
        </Text>
        <Text style={styles.reason} numberOfLines={1}>
          {reason}
        </Text>
        {relativeChip}
      </View>

      <View style={styles.right}>
        <Text style={styles.time}>{formatTime(appointment.start_time)}</Text>
        <Text style={styles.duration}>
          {t('dashboard.duration', { n: appointment.duration_minutes })}
        </Text>
      </View>

      {onPress ? (
        <Icon name="chevron-forward" size={16} color={c.labelTertiary as string} />
      ) : null}
    </View>
  )

  if (onPress) {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => pressed && styles.pressed}
      >
        {Inner}
      </Pressable>
    )
  }
  return Inner
}

function renderRelativeChip(
  startTime: string,
  t: TFunction,
  c: Colors,
  styles: ReturnType<typeof makeStyles>,
) {
  const mins = minutesUntil(startTime)
  if (mins < 0) return null
  const { bucket, value } = getRelativeBucket(mins)
  const label =
    bucket === 'minutes'
      ? t('dashboard.relative.minutes', { n: value ?? 0 })
      : bucket === 'hours'
        ? t('dashboard.relative.hours', { n: value ?? 0 })
        : t(`dashboard.relative.${bucket}`)

  const isImminent = bucket === 'now' || bucket === 'soon'

  return (
    <View style={[styles.chip, isImminent ? styles.chipImminent : styles.chipNeutral]}>
      <View style={[styles.chipDot, { backgroundColor: isImminent ? c.brand : c.systemGray }]} />
      <Text
        style={[styles.chipText, { color: isImminent ? c.brandDeep : (c.labelSecondary as string) }]}
      >
        {label}
      </Text>
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  pressed: { backgroundColor: c.fillQuaternary },
  body: {
    flex: 1,
    gap: 3,
  },
  name: {
    ...typography.bodyEmphasized,
    color: c.label,
  },
  reason: {
    ...typography.footnote,
    color: c.labelSecondary,
  },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginTop: 4,
  },
  chipImminent: {
    backgroundColor: c.brandLight,
  },
  chipNeutral: {
    backgroundColor: c.fillQuaternary,
  },
  chipDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  chipText: {
    fontFamily: font('700'),
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  right: {
    alignItems: 'flex-end',
    minWidth: 60,
  },
  time: {
    fontFamily: font('700'),
    fontSize: 18,
    fontWeight: '700',
    color: c.label,
    letterSpacing: -0.4,
  },
  duration: {
    ...typography.caption1,
    color: c.labelSecondary,
    marginTop: 1,
  },
  })
}
