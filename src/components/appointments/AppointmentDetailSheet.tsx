import React, { useEffect, useMemo, useRef } from 'react'
import {
  Modal,
  Pressable,
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Alert,
  ScrollView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { useI18n } from '../../i18n'
import { useToast } from '../ui/Toast'
import Icon, { IconName } from '../ui/Icon'
import Button from '../ui/Button'
import PatientAvatar from '../ui/PatientAvatar'
import { radius, spacing, typography, shadows, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { formatTime, formatLongDate, fromLocalDateKey } from '../../lib/format'
import type { ApiAppointment } from '../../types'

interface Props {
  appointment: ApiAppointment | null
  visible: boolean
  onClose: () => void
  onStatusChange?: (id: string, status: ApiAppointment['status']) => void
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
}

function getStatusColor(c: Colors): Record<ApiAppointment['status'], string> {
  return {
    scheduled: c.scheduled,
    completed: c.completed,
    cancelled: c.cancelled,
    no_show: c.no_show,
  }
}

const STATUS_BG: Record<ApiAppointment['status'], string> = {
  scheduled: 'rgba(0, 122, 255, 0.10)',
  completed: 'rgba(52, 199, 89, 0.10)',
  cancelled: 'rgba(142, 142, 147, 0.10)',
  no_show: 'rgba(255, 59, 48, 0.10)',
}

// Bottom-sheet detail view for an appointment. Shows patient, date/time,
// status pill, reason, and exposes status-change + delete actions.
export default function AppointmentDetailSheet({
  appointment,
  visible,
  onClose,
  onStatusChange,
  onEdit,
  onDelete,
}: Props) {
  const insets = useSafeAreaInsets()
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const toast = useToast()

  const slide = useRef(new Animated.Value(500)).current
  const fade = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slide, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start()
    } else {
      slide.setValue(500)
      fade.setValue(0)
    }
  }, [visible, slide, fade])

  const close = () => {
    Animated.parallel([
      Animated.timing(slide, { toValue: 500, duration: 200, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(() => onClose())
  }

  if (!appointment) return null

  const status = appointment.status
  const statusColor = getStatusColor(c)[status]
  const statusBg = STATUS_BG[status]
  const reason = appointment.notes?.trim() || t('appointments.reasonGeneral')
  const patientName = appointment.patient_name || '—'
  const duration = toMin(appointment.end_time) - toMin(appointment.start_time)

  const date = fromLocalDateKey(appointment.appointment_date)
  const dateLabel = formatLongDate(date, locale)
  const timeRange = `${formatTime(appointment.start_time)} – ${formatTime(appointment.end_time)}`

  const setStatus = (next: ApiAppointment['status']) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    onStatusChange?.(appointment.id, next)
    toast.success(t('appointments.detail.statusUpdated'))
    close()
  }

  const confirmDelete = () => {
    Alert.alert(
      t('appointments.detail.deleteConfirm'),
      t('appointments.detail.deleteConfirmSub'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
            onDelete?.(appointment.id)
            toast.info(t('appointments.detail.deleted'))
            close()
          },
        },
      ]
    )
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close}>
        <Animated.View style={[styles.backdrop, { opacity: fade }]} />
      </Pressable>

      <Animated.View
        style={[
          styles.sheet,
          shadows.lg,
          { paddingBottom: insets.bottom + spacing.lg, transform: [{ translateY: slide }] },
        ]}
      >
        <View style={styles.handle} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Patient hero */}
          <View style={styles.patientRow}>
            <PatientAvatar name={patientName} size={56} />
            <View style={styles.patientText}>
              <Text style={styles.patientName} numberOfLines={1}>
                {patientName}
              </Text>
              <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {t(`appointments.status.${status}`)}
                </Text>
              </View>
            </View>
          </View>

          {/* Info rows */}
          <View style={styles.infoGroup}>
            <InfoRow
              iconName="calendar-outline"
              label={t('appointments.detail.dateTime')}
              value={`${dateLabel}\n${timeRange}`}
            />
            <View style={styles.infoSeparator} />
            <InfoRow
              iconName="time-outline"
              label={t('appointments.detail.duration')}
              value={t('appointments.duration', { n: duration })}
            />
            <View style={styles.infoSeparator} />
            <InfoRow
              iconName="medkit-outline"
              label={t('appointments.detail.reason')}
              value={reason}
            />
          </View>

          {/* Status change actions */}
          <View style={styles.statusActions}>
            {status === 'scheduled' ? (
              <>
                <Button
                  title={t('appointments.detail.markCompleted')}
                  variant="tinted"
                  size="md"
                  leftIcon={<Icon name="checkmark-circle" size={18} color={c.brandDeep as string} />}
                  onPress={() => setStatus('completed')}
                />
                <Button
                  title={t('appointments.detail.markCancelled')}
                  variant="secondary"
                  size="md"
                  leftIcon={<Icon name="close-circle" size={18} color={c.label as string} />}
                  onPress={() => setStatus('cancelled')}
                />
                <Button
                  title={t('appointments.detail.markNoShow')}
                  variant="secondary"
                  size="md"
                  leftIcon={<Icon name="alert-circle" size={18} color={c.label as string} />}
                  onPress={() => setStatus('no_show')}
                />
              </>
            ) : (
              <Button
                title={t('appointments.detail.markScheduled')}
                variant="tinted"
                size="md"
                leftIcon={<Icon name="refresh-outline" size={18} color={c.brandDeep as string} />}
                onPress={() => setStatus('scheduled')}
              />
            )}
          </View>

          {/* Bottom actions */}
          <View style={styles.bottomActions}>
            <Button
              title={t('appointments.detail.edit')}
              variant="secondary"
              size="md"
              fullWidth
              leftIcon={<Icon name="create-outline" size={18} color={c.label as string} />}
              onPress={() => {
                close()
                if (appointment) onEdit?.(appointment.id)
              }}
              style={{ flex: 1 }}
            />
            <Button
              title={t('common.delete')}
              variant="destructive"
              size="md"
              fullWidth
              leftIcon={<Icon name="trash-outline" size={18} color="#FFFFFF" />}
              onPress={confirmDelete}
              style={{ flex: 1 }}
            />
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  )
}

function InfoRow({ iconName, label, value }: { iconName: IconName; label: string; value: string }) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Icon name={iconName} size={18} color={c.brand as string} />
      </View>
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  )
}

function toMin(time: string): number {
  const [h, m] = time.split(':').map((n) => parseInt(n, 10) || 0)
  return h * 60 + m
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: '85%',
      backgroundColor: c.background,
      borderTopLeftRadius: radius.xxl,
      borderTopRightRadius: radius.xxl,
      paddingTop: 10,
    },
    handle: {
      alignSelf: 'center',
      width: 38,
      height: 5,
      borderRadius: 3,
      backgroundColor: c.systemGray4,
      marginBottom: spacing.md,
    },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.lg,
      gap: spacing.lg,
    },
    patientRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 6,
    },
    patientText: { flex: 1, gap: 6 },
    patientName: {
      ...typography.title2,
      color: c.brandDeep,
    },
    statusPill: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.pill,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusText: {
      fontFamily: font('700'),
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.1,
    },
    infoGroup: {
      backgroundColor: c.fillQuaternary,
      borderRadius: radius.xl,
      overflow: 'hidden',
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    infoIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: c.brandLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    infoText: { flex: 1, gap: 2 },
    infoLabel: {
      ...typography.caption1,
      fontFamily: font('600'),
      color: c.labelSecondary,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    infoValue: {
      ...typography.body,
      color: c.label,
    },
    infoSeparator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.separator as string,
      marginLeft: 58,
    },
    statusActions: {
      gap: spacing.sm,
    },
    bottomActions: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.xs,
    },
  })
}
