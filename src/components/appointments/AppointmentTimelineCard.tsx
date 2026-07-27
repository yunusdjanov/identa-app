import React, { useMemo, useState } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'

import Icon from '../ui/Icon'
import PatientAvatar from '../ui/PatientAvatar'
import { radius, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { useI18n } from '../../i18n'
import { formatTime } from '../../lib/format'
import { getPatientPhotoThumbnailUri } from '../../lib/patientPhoto'
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

export default function AppointmentTimelineCard({
  appointment,
  onPress,
  hasConflict,
}: Props) {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const [pressed, setPressed] = useState(false)
  const status = appointment.status
  const statusColor: Record<ApiAppointment['status'], string> = {
    scheduled: c.scheduled,
    completed: c.completed,
    cancelled: c.cancelled,
    no_show: c.no_show,
  }
  const patientName = appointment.patient_name || appointment.guest_name || '—'
  const isGuest = Boolean(appointment.is_guest || !appointment.patient_id)
  const reason = appointment.notes?.trim() || t('appointments.reasonGeneral')
  const duration = computeDurationMinutes(appointment.start_time, appointment.end_time)
  const patientPhotoUri = appointment.patient_id
    ? getPatientPhotoThumbnailUri(appointment.patient_id)
    : null

  const renderContent = (pressed = false) => (
    <View
      testID={`appointment-timeline-row-${appointment.id}`}
      style={[styles.row, pressed && styles.pressed]}
    >
      <View style={styles.timeColumn}>
        <Text
          style={[
            styles.startTime,
            status !== 'scheduled' && styles.startTimeMuted,
          ]}
        >
          {formatTime(appointment.start_time)}
        </Text>
        <Text style={styles.endTime}>{formatTime(appointment.end_time)}</Text>
      </View>

      <View style={[styles.statusBar, { backgroundColor: statusColor[status] }]} />

      <View
        testID={`appointment-timeline-surface-${appointment.id}`}
        style={[
          styles.card,
          status === 'cancelled' && styles.cardCancelled,
          hasConflict && styles.cardConflict,
        ]}
      >
        <View style={styles.cardTop}>
          <PatientAvatar name={patientName} size={30} uri={patientPhotoUri} />
          <View style={styles.cardBody}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {patientName}
              </Text>
              {isGuest ? (
                <Text style={styles.guestLabel}>{t('appointments.create.guest')}</Text>
              ) : null}
            </View>
            <Text style={styles.reason} numberOfLines={1}>
              {reason}
            </Text>
          </View>
          <Icon name="chevron-forward" size={14} color={c.labelTertiary as string} />
        </View>

        <View style={styles.cardBottom}>
          <View
            style={[
              styles.statusPill,
              { backgroundColor: STATUS_BG[status] },
            ]}
          >
            <Text style={[styles.statusText, { color: statusColor[status] }]}>
              {t(`appointments.status.${status}`)}
            </Text>
          </View>

          {hasConflict ? (
            <View style={styles.conflictPill}>
              <Icon name="warning" size={10} color={c.danger as string} />
              <Text style={styles.conflictText}>{t('appointments.conflict')}</Text>
            </View>
          ) : null}

          <Text style={styles.duration}>
            {t('appointments.durationShort', { n: duration })}
          </Text>
        </View>
      </View>
    </View>
  )

  if (!onPress) return renderContent()

  return (
    <Pressable
      testID={`appointment-timeline-card-${appointment.id}`}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={`${formatTime(appointment.start_time)}, ${patientName}, ${t(
        `appointments.status.${status}`
      )}`}
    >
      {renderContent(pressed)}
    </Pressable>
  )
}

function computeDurationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map((value) => parseInt(value, 10) || 0)
  const [eh, em] = end.split(':').map((value) => parseInt(value, 10) || 0)
  return Math.max(0, eh * 60 + em - (sh * 60 + sm))
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'stretch',
      paddingVertical: 4,
      paddingHorizontal: 18,
    },
    pressed: {
      transform: [{ scale: 0.995 }],
    },
    timeColumn: {
      width: 48,
      paddingTop: 11,
    },
    startTime: {
      fontFamily: font('700'),
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '700',
      color: c.label,
      letterSpacing: -0.2,
    },
    startTimeMuted: {
      color: c.labelSecondary,
    },
    endTime: {
      fontFamily: font('500'),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: '500',
      color: c.labelTertiary,
      marginTop: 1,
    },
    statusBar: {
      width: 3,
      marginHorizontal: 8,
      borderRadius: 2,
    },
    card: {
      flex: 1,
      minWidth: 0,
      backgroundColor: c.background,
      borderRadius: radius.xl,
      padding: 10,
      gap: 8,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    cardCancelled: {
      backgroundColor: c.fillQuaternary,
    },
    cardConflict: {
      borderWidth: 1,
      borderColor: c.danger,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    cardBody: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    name: {
      flexShrink: 1,
      fontFamily: font('700'),
      fontSize: 15,
      lineHeight: 19,
      fontWeight: '700',
      color: c.label,
      letterSpacing: -0.2,
    },
    reason: {
      fontFamily: font('400'),
      fontSize: 12,
      lineHeight: 16,
      color: c.labelSecondary,
    },
    guestLabel: {
      fontFamily: font('700'),
      fontSize: 8,
      lineHeight: 11,
      fontWeight: '700',
      color: c.brand,
      textTransform: 'uppercase',
    },
    cardBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    statusPill: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: radius.pill,
    },
    statusText: {
      fontFamily: font('700'),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: '700',
    },
    conflictPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: radius.pill,
      backgroundColor: 'rgba(255, 59, 48, 0.10)',
    },
    conflictText: {
      fontFamily: font('700'),
      fontSize: 9,
      lineHeight: 12,
      fontWeight: '700',
      color: c.danger,
    },
    duration: {
      marginLeft: 'auto',
      fontFamily: font('600'),
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '600',
      color: c.labelTertiary,
    },
  })
}
