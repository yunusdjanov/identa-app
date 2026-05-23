import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import * as Haptics from 'expo-haptics'
import Icon from '../ui/Icon'
import PatientAvatar from '../ui/PatientAvatar'
import { radius, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { useI18n } from '../../i18n'
import { formatTime } from '../../lib/format'
import type { ApiAppointment } from '../../types'

interface Props {
  appointment: ApiAppointment
  onPress?: () => void
  hasConflict?: boolean
}

const STATUS_BG: Record<ApiAppointment['status'], string> = {
  scheduled: 'rgba(0, 122, 255, 0.10)',
  completed: 'rgba(52, 199, 89, 0.10)',
  cancelled: 'rgba(142, 142, 147, 0.10)',
  no_show: 'rgba(255, 59, 48, 0.10)',
}

export default function AppointmentTimelineCard({ appointment, onPress, hasConflict }: Props) {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const status = appointment.status
  const STATUS_COLOR: Record<ApiAppointment['status'], string> = {
    scheduled: c.scheduled,
    completed: c.completed,
    cancelled: c.cancelled,
    no_show: c.no_show,
  }
  const statusColor = STATUS_COLOR[status]
  const statusBg = STATUS_BG[status]
  const reason = appointment.notes?.trim() || t('appointments.reasonGeneral')
  const patientName = appointment.patient_name || '—'

  const duration = computeDurationMinutes(appointment.start_time, appointment.end_time)

  const handlePress = () => {
    if (onPress) {
      Haptics.selectionAsync()
      onPress()
    }
  }

  const Inner = (
    <View style={styles.row}>
      <View style={styles.timeColumn}>
        <Text style={[styles.startTime, status !== 'scheduled' && styles.startTimeMuted]}>
          {formatTime(appointment.start_time)}
        </Text>
        <Text style={styles.endTime}>{formatTime(appointment.end_time)}</Text>
      </View>

      <View style={[styles.statusBar, { backgroundColor: statusColor }]} />

      <View
        style={[
          styles.card,
          status === 'cancelled' && styles.cardCancelled,
          hasConflict && styles.cardConflict,
        ]}
      >
        <View style={styles.cardTopRow}>
          <PatientAvatar name={patientName} size={32} />
          <View style={styles.cardBody}>
            <Text style={styles.name} numberOfLines={1}>
              {patientName}
            </Text>
            <Text style={styles.reason} numberOfLines={1}>
              {reason}
            </Text>
          </View>
        </View>

        <View style={styles.cardBottomRow}>
          <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {t(`appointments.status.${status}`)}
            </Text>
          </View>
          {hasConflict ? (
            <View style={styles.conflictPill}>
              <Icon name="warning" size={11} color={c.danger as string} />
              <Text style={styles.conflictText}>{t('appointments.conflict')}</Text>
            </View>
          ) : null}
          <Text style={styles.duration}>{t('appointments.durationShort', { n: duration })}</Text>
        </View>
      </View>
    </View>
  )

  if (onPress) {
    return (
      <Pressable onPress={handlePress} style={({ pressed }) => pressed && styles.pressed}>
        {Inner}
      </Pressable>
    )
  }
  return Inner
}

function computeDurationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map((n) => parseInt(n, 10) || 0)
  const [eh, em] = end.split(':').map((n) => parseInt(n, 10) || 0)
  return eh * 60 + em - (sh * 60 + sm)
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 6,
    paddingHorizontal: 20,
  },
  pressed: { opacity: 0.85 },
  timeColumn: {
    width: 52,
    paddingTop: 14,
  },
  startTime: {
    fontFamily: font('700'),
    fontSize: 15,
    fontWeight: '700',
    color: c.label,
    letterSpacing: -0.2,
  },
  startTimeMuted: {
    color: c.labelSecondary,
  },
  endTime: {
    fontFamily: font('400'),
    fontSize: 11,
    color: c.labelTertiary,
    marginTop: 1,
  },
  statusBar: {
    width: 3,
    marginHorizontal: 10,
    borderRadius: 2,
  },
  card: {
    flex: 1,
    backgroundColor: c.background,
    borderRadius: radius.xl,
    padding: 12,
    gap: 10,
    shadowColor: '#0F2E4C',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  cardCancelled: {
    opacity: 0.6,
  },
  cardConflict: {
    borderColor: 'rgba(255, 59, 48, 0.55)',
    borderWidth: 1,
  },
  conflictPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 59, 48, 0.10)',
  },
  conflictText: {
    fontFamily: font('700'),
    fontSize: 10,
    fontWeight: '700',
    color: c.danger,
    letterSpacing: 0.1,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardBody: { flex: 1, gap: 2 },
  name: {
    ...typography.bodyEmphasized,
    color: c.label,
  },
  reason: {
    ...typography.footnote,
    color: c.labelSecondary,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusText: {
    fontFamily: font('700'),
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  duration: {
    fontFamily: font('600'),
    fontSize: 12,
    fontWeight: '600',
    color: c.labelSecondary,
  },
  })
}
