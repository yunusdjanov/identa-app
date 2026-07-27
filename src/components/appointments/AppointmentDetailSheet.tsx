import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Modal,
  Pressable,
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { useI18n } from '../../i18n'
import { useDialog } from '../ui/Dialog'
import Icon, { IconName } from '../ui/Icon'
import PatientAvatar from '../ui/PatientAvatar'
import { radius, spacing, shadows, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { formatTime, formatLongDate, fromLocalDateKey } from '../../lib/format'
import { isAppointmentPastSlot } from '../../lib/appointmentSchedule'
import { getPatientPhotoThumbnailUri } from '../../lib/patientPhoto'
import type { ApiAppointment } from '../../types'

interface Props {
  appointment: ApiAppointment | null
  visible: boolean
  onClose: () => void
  onStatusChange?: (
    id: string,
    status: Exclude<ApiAppointment['status'], 'scheduled'>
  ) => Promise<boolean>
  onEdit?: (id: string) => void
  onDelete?: (id: string) => Promise<boolean>
  onCreatePatientCard?: (appointment: ApiAppointment) => Promise<boolean>
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
  onCreatePatientCard,
}: Props) {
  const insets = useSafeAreaInsets()
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const { confirm } = useDialog()
  const [changingStatus, setChangingStatus] = useState<ApiAppointment['status'] | null>(null)
  const [creatingPatientCard, setCreatingPatientCard] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
  const patientName = appointment.patient_name || appointment.guest_name || '—'
  const duration = toMin(appointment.end_time) - toMin(appointment.start_time)
  const isPastSlot = isAppointmentPastSlot(appointment)

  const date = fromLocalDateKey(appointment.appointment_date)
  const dateLabel = formatLongDate(date, locale)
  const timeRange = `${formatTime(appointment.start_time)} – ${formatTime(appointment.end_time)}`
  const showEditAction = status === 'scheduled' && !isPastSlot && Boolean(onEdit)
  const actionBusy = changingStatus !== null || creatingPatientCard || deleting
  const patientPhotoUri = appointment.patient_id
    ? getPatientPhotoThumbnailUri(appointment.patient_id)
    : null

  const setStatus = async (next: Exclude<ApiAppointment['status'], 'scheduled'>) => {
    if (!onStatusChange || actionBusy) return
    setChangingStatus(next)
    let saved = false
    try {
      saved = await onStatusChange(appointment.id, next)
    } finally {
      setChangingStatus(null)
    }
    if (!saved) return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    close()
  }

  const confirmDelete = async () => {
    if (!onDelete || actionBusy) return
    const ok = await confirm({
      title: t('appointments.detail.deleteConfirm'),
      message: t('appointments.detail.deleteConfirmSub'),
      confirmLabel: t('common.delete'),
      destructive: true,
    })
    if (!ok) return
    setDeleting(true)
    let deleted = false
    try {
      deleted = await onDelete(appointment.id)
    } finally {
      setDeleting(false)
    }
    if (deleted) close()
  }

  const createPatientCard = async () => {
    if (!onCreatePatientCard || actionBusy) return
    const ok = await confirm({
      title: t('appointments.detail.createPatientCard'),
      message: t('appointments.detail.createPatientCardConfirm'),
      confirmLabel: t('appointments.detail.createPatientCard'),
    })
    if (!ok) return
    setCreatingPatientCard(true)
    let created = false
    try {
      created = await onCreatePatientCard(appointment)
    } finally {
      setCreatingPatientCard(false)
    }
    if (created) close()
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
          <View style={styles.patientRow} testID="appointment-detail-header">
            <PatientAvatar name={patientName} size={44} uri={patientPhotoUri} />
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
            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              style={({ pressed }) => [
                styles.closeTarget,
                pressed && styles.actionPressed,
              ]}
            >
              <View style={styles.closeVisual}>
                <Icon name="close" size={17} color={c.labelSecondary as string} />
              </View>
            </Pressable>
          </View>

          <View style={styles.infoGroup} testID="appointment-detail-info">
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
            {appointment.is_guest && appointment.guest_phone ? (
              <>
                <View style={styles.infoSeparator} />
                <InfoRow
                  iconName="call-outline"
                  label={t('appointments.detail.patient')}
                  value={appointment.guest_phone}
                />
              </>
            ) : null}
          </View>

          {appointment.is_guest && appointment.guest_phone && onCreatePatientCard ? (
            <View style={styles.singleActionRow}>
              <ActionTile
                iconName="person-add-outline"
                label={t('appointments.detail.createPatientCard')}
                tone="brand"
                single
                loading={creatingPatientCard}
                disabled={actionBusy}
                onPress={createPatientCard}
              />
            </View>
          ) : null}

          {onStatusChange ? (
            <View style={styles.actionSection}>
              <Text style={styles.sectionLabel}>{t('appointments.detail.statusLabel')}</Text>
              {status === 'scheduled' ? (
                <View style={styles.actionGrid} testID="appointment-status-actions">
                  <ActionTile
                    iconName="checkmark-circle-outline"
                    label={t('appointments.detail.markCompleted')}
                    tone="success"
                    loading={changingStatus === 'completed'}
                    disabled={actionBusy}
                    onPress={() => setStatus('completed')}
                  />
                  <ActionTile
                    iconName="close-circle-outline"
                    label={t('appointments.detail.markCancelled')}
                    tone="neutral"
                    loading={changingStatus === 'cancelled'}
                    disabled={actionBusy}
                    onPress={() => setStatus('cancelled')}
                  />
                  <ActionTile
                    iconName="alert-circle-outline"
                    label={t('appointments.detail.markNoShow')}
                    tone="warning"
                    loading={changingStatus === 'no_show'}
                    disabled={actionBusy}
                    onPress={() => setStatus('no_show')}
                  />
                </View>
              ) : (
                <Text style={styles.finalizedNote}>{t('appointments.edit.finalized')}</Text>
              )}
            </View>
          ) : null}

          {showEditAction || onDelete ? (
            <View style={styles.actionGrid} testID="appointment-detail-actions">
              {showEditAction ? (
                <ActionTile
                  iconName="create-outline"
                  label={t('appointments.detail.edit')}
                  tone="brand"
                  single={!onDelete}
                  disabled={actionBusy}
                  onPress={() => {
                    close()
                    onEdit?.(appointment.id)
                  }}
                />
              ) : null}
              {onDelete ? (
                <ActionTile
                  iconName="trash-outline"
                  label={t('common.delete')}
                  tone="danger"
                  single={!showEditAction}
                  loading={deleting}
                  disabled={actionBusy}
                  onPress={confirmDelete}
                />
              ) : null}
            </View>
          ) : null}

          {status === 'scheduled' && isPastSlot ? (
            <Text style={styles.finalizedNote}>{t('appointments.edit.past')}</Text>
          ) : null}
        </ScrollView>
      </Animated.View>
    </Modal>
  )
}

type ActionTone = 'brand' | 'success' | 'neutral' | 'warning' | 'danger'

function ActionTile({
  iconName,
  label,
  tone,
  onPress,
  loading = false,
  disabled = false,
  single = false,
}: {
  iconName: IconName
  label: string
  tone: ActionTone
  onPress: () => void
  loading?: boolean
  disabled?: boolean
  single?: boolean
}) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const toneColor: Record<ActionTone, string> = {
    brand: c.brand,
    success: c.completed,
    neutral: c.labelSecondary,
    warning: c.no_show,
    danger: c.danger,
  }
  const toneBackground: Record<ActionTone, string> = {
    brand: c.brandSurface,
    success: 'rgba(52, 199, 89, 0.10)',
    neutral: c.fillQuaternary,
    warning: 'rgba(255, 149, 0, 0.10)',
    danger: 'rgba(255, 59, 48, 0.10)',
  }
  const isDisabled = disabled || loading

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync()
        onPress()
      }}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.actionTile,
        single && styles.actionTileSingle,
        pressed && !isDisabled && styles.actionPressed,
        isDisabled && styles.actionDisabled,
      ]}
    >
      <View style={[styles.actionIcon, { backgroundColor: toneBackground[tone] }]}>
        {loading ? (
          <ActivityIndicator size="small" color={toneColor[tone]} />
        ) : (
          <Icon name={iconName} size={19} color={toneColor[tone]} />
        )}
      </View>
      <Text
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.82}
        style={[
          styles.actionLabel,
          tone === 'danger' && styles.actionLabelDanger,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function InfoRow({ iconName, label, value }: { iconName: IconName; label: string; value: string }) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Icon name={iconName} size={16} color={c.brand as string} />
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
      maxHeight: '86%',
      backgroundColor: c.background,
      borderTopLeftRadius: radius.xxl,
      borderTopRightRadius: radius.xxl,
      paddingTop: 8,
    },
    handle: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.systemGray4,
      marginBottom: spacing.sm,
    },
    scroll: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
      gap: spacing.md,
    },
    patientRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 48,
    },
    patientText: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    patientName: {
      fontFamily: font('700'),
      fontSize: 17,
      lineHeight: 21,
      fontWeight: '700',
      letterSpacing: -0.3,
      color: c.brandDeep,
    },
    closeTarget: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      marginRight: -6,
    },
    closeVisual: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.separator as string,
      backgroundColor: c.fillQuaternary,
    },
    statusPill: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: radius.pill,
    },
    statusDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
    },
    statusText: {
      fontFamily: font('700'),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: '700',
      letterSpacing: 0.1,
    },
    infoGroup: {
      backgroundColor: c.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.brandSoft,
      borderRadius: radius.lg,
      overflow: 'hidden',
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    infoIcon: {
      width: 28,
      height: 28,
      borderRadius: radius.md,
      backgroundColor: c.brandSurface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    infoText: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    infoLabel: {
      fontFamily: font('600'),
      fontSize: 10,
      lineHeight: 13,
      color: c.labelSecondary,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.35,
    },
    infoValue: {
      fontFamily: font('500'),
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: c.label,
    },
    infoSeparator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.separator as string,
      marginLeft: 48,
    },
    singleActionRow: {
      flexDirection: 'row',
      justifyContent: 'center',
    },
    actionSection: {
      gap: 6,
    },
    sectionLabel: {
      fontFamily: font('600'),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: '600',
      color: c.labelSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.45,
      paddingHorizontal: 2,
    },
    actionGrid: {
      flexDirection: 'row',
      alignItems: 'stretch',
      justifyContent: 'center',
      gap: 6,
    },
    actionTile: {
      flex: 1,
      minWidth: 0,
      minHeight: 64,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingHorizontal: 4,
      paddingVertical: 7,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.brandSoft,
      borderRadius: radius.md,
      backgroundColor: c.background,
    },
    actionTileSingle: {
      flexGrow: 0,
      flexBasis: 164,
      maxWidth: 164,
    },
    actionIcon: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
    },
    actionLabel: {
      fontFamily: font('600'),
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '600',
      letterSpacing: -0.15,
      textAlign: 'center',
      color: c.label,
    },
    actionLabelDanger: {
      color: c.danger,
    },
    actionPressed: {
      opacity: 0.6,
      transform: [{ scale: 0.97 }],
    },
    actionDisabled: {
      opacity: 0.52,
    },
    finalizedNote: {
      fontFamily: font('500'),
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500',
      color: c.labelSecondary,
      textAlign: 'center',
      paddingVertical: spacing.xs,
    },
  })
}
