import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'

import BottomSheet from '../ui/BottomSheet'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import PatientAvatar from '../ui/PatientAvatar'
import MonthCalendarPicker from '../ui/MonthCalendarPicker'
import { useToast } from '../ui/Toast'

import { useI18n } from '../../i18n'
import { getTranslationArray } from '../../i18n/helpers'
import { isOfflineError } from '../../lib/offlineGuard'
import { isAppointmentPastSlot } from '../../lib/appointmentSchedule'
import type { Locale } from '../../constants'
import { listAppointments, updateAppointment } from '../../api/appointments'
import { getProfile } from '../../api/profile'
import {
  addDays,
  formatDayMonth,
  formatTime,
  fromLocalDateKey,
  isSameDay,
  toLocalDateKey,
} from '../../lib/format'
import { inputMetrics, radius, spacing, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import type { ApiAppointment } from '../../types'

interface Props {
  visible: boolean
  appointment: ApiAppointment | null
  onClose: () => void
  onSaved?: () => void
}

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120]
const WORK_START = 9 * 60
const WORK_END = 20 * 60
const SLOT_STEP = 30

export default function AppointmentEditSheet({ visible, appointment, onClose, onSaved }: Props) {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const toast = useToast()
  const queryClient = useQueryClient()

  const [date, setDate] = useState<Date>(new Date())
  const [time, setTime] = useState('09:00')
  const [duration, setDuration] = useState(30)
  const [reason, setReason] = useState('')
  const [clock, setClock] = useState(() => new Date())
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [timePickerOpen, setTimePickerOpen] = useState(false)
  const [durationPickerOpen, setDurationPickerOpen] = useState(false)
  const status = appointment?.status ?? 'scheduled'

  // Pre-fill when sheet opens
  useEffect(() => {
    if (visible && appointment) {
      setDate(fromLocalDateKey(appointment.appointment_date))
      setTime(appointment.start_time)
      setDuration(computeDuration(appointment.start_time, appointment.end_time))
      setReason(appointment.notes ?? '')
      setCalendarOpen(false)
      setTimePickerOpen(false)
      setDurationPickerOpen(false)
    } else {
      setCalendarOpen(false)
      setTimePickerOpen(false)
      setDurationPickerOpen(false)
    }
  }, [visible, appointment])

  useEffect(() => {
    if (!visible) return
    const refreshClock = () => setClock(new Date())
    refreshClock()
    const timer = setInterval(refreshClock, 30_000)
    return () => clearInterval(timer)
  }, [visible])

  // Load other appointments on selected date for conflict check
  const dateKey = toLocalDateKey(date)
  const dayQuery = useQuery({
    queryKey: ['appointments', 'day', dateKey],
    queryFn: () => listAppointments({ date: dateKey }),
    enabled: visible,
    staleTime: 30_000,
  })
  const dayAppointments = dayQuery.data?.data ?? []
  const otherActiveAppts = dayAppointments.filter(
    (a) => a.id !== appointment?.id && a.status !== 'cancelled' && a.status !== 'no_show'
  )

  // Clinic working hours from profile settings; backend fallback is 09:00–20:00.
  const profileQuery = useQuery({
    queryKey: ['settings', 'profile'],
    queryFn: getProfile,
    enabled: visible,
    staleTime: 5 * 60_000,
  })
  const workStart = parseHm(profileQuery.data?.working_hours?.start) ?? WORK_START
  const workEnd = parseHm(profileQuery.data?.working_hours?.end) ?? WORK_END

  const today = useMemo(() => {
    const current = new Date(clock)
    current.setHours(0, 0, 0, 0)
    return current
  }, [clock])
  const isToday = isSameDay(date, today)
  const slotValid = isSlotValid(
    time,
    duration,
    otherActiveAppts,
    status,
    workStart,
    workEnd,
    dateKey,
    clock
  )
  // The backend forbids editing an appointment that is already finalized
  // (completed/cancelled/no_show) — AppointmentService throws
  // `finalized_cannot_be_edited`. Disable save and show a notice instead of
  // letting the PUT 422.
  const isFinalized = appointment != null && appointment.status !== 'scheduled'
  // Validate the slot currently selected in the form, not only the original
  // appointment. Otherwise a future appointment could be moved into the past
  // and only fail after reaching the backend.
  const isPastSlot = isAppointmentPastSlot(
    { appointment_date: dateKey, start_time: time },
    clock
  )
  const scheduleError = profileQuery.isError || dayQuery.isError
  const scheduleReady =
    Boolean(profileQuery.data) &&
    Boolean(dayQuery.data) &&
    !profileQuery.isFetching &&
    !dayQuery.isFetching &&
    !scheduleError
  const canSubmit = slotValid && !isFinalized && !isPastSlot && scheduleReady

  const slots = useMemo(() => {
    const generated = generateTimeSlots(workStart, workEnd)
    const currentStart = appointment?.start_time
    if (
      currentStart &&
      toMin(currentStart) >= workStart &&
      toMin(currentStart) < workEnd &&
      !generated.includes(currentStart)
    ) {
      generated.push(currentStart)
      generated.sort((a, b) => toMin(a) - toMin(b))
    }
    return generated
  }, [appointment?.start_time, workStart, workEnd])
  // Single pass over the slot list per render. Each TimeGroup just reads
  // from this map instead of recomputing for every chip.
  const blockerBySlot = useMemo(() => {
    const map = new Map<string, ReturnType<typeof findBlocker>>()
    for (const slot of slots) {
      map.set(
        slot,
        findBlocker(
          slot,
          duration,
          otherActiveAppts,
          status,
          workStart,
          workEnd,
          dateKey,
          clock
        )
      )
    }
    return map
  }, [slots, duration, otherActiveAppts, status, workStart, workEnd, dateKey, clock])

  const availableSlots = useMemo(
    () => slots.filter((slot) => blockerBySlot.get(slot) === null),
    [slots, blockerBySlot]
  )

  const quickReasons = useMemo(
    () => getTranslationArray<string>(locale as Locale, 'appointments.create.quickReasons'),
    [locale]
  )

  const mutation = useMutation({
    mutationFn: () =>
      updateAppointment(appointment!.id, {
        // patient_id is required by the backend on update (UpdateAppointmentRequest
        // extends StoreAppointmentRequest where it's `required`). Carry it from
        // the existing appointment so edits don't 422.
        patient_id: appointment!.patient_id,
        guest_name: appointment!.guest_name,
        guest_phone: appointment!.guest_phone,
        appointment_date: dateKey,
        start_time: time,
        end_time: minToTime(toMin(time) + duration),
        status,
        notes: reason.trim() || null,
      }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      toast.success(t('appointments.edit.saved'))
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      onSaved?.()
      onClose()
    },
    onError: (err) => {
      if (isOfflineError(err)) return
      toast.error(t('appointments.edit.failed'))
    },
  })

  const onSlotPress = (slot: string) => {
    const blocker = findBlocker(
      slot,
      duration,
      otherActiveAppts,
      status,
      workStart,
      workEnd,
      dateKey,
      clock
    )
    if (blocker === 'overflow' || blocker === 'past') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      return
    }
    if (blocker !== null && typeof blocker === 'object') {
      toast.info(
        t('appointments.create.busyByPatient', { name: blocker.patient_name ?? '—' })
      )
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      return
    }
    Haptics.selectionAsync()
    setTime(slot)
  }

  const handleSubmit = () => {
    if (!canSubmit) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      return
    }
    mutation.mutate()
  }

  if (!appointment) return null

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('appointments.edit.title')}
      closeAccessibilityLabel={t('common.close')}
    >
      {/* Patient header (read-only) */}
      <View style={styles.patientHeader}>
        <PatientAvatar name={appointment.patient_name ?? '—'} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={styles.patientName} numberOfLines={1}>
            {appointment.patient_name ?? '—'}
          </Text>
          <Text style={styles.patientHint} numberOfLines={1}>
            {formatTime(appointment.start_time)} · {appointment.appointment_date}
          </Text>
        </View>
      </View>

      <View style={styles.field}>
        <View style={styles.scheduleRow}>
          <Pressable
            testID="appointment-edit-date-selector"
            onPress={() => {
              Haptics.selectionAsync()
              setCalendarOpen(true)
            }}
            accessibilityRole="button"
            accessibilityLabel={`${t('appointments.create.date')}: ${
              isToday ? t('appointments.todayLabel') : formatDayMonth(date, locale)
            }`}
            style={({ pressed }) => [
              styles.scheduleControl,
              pressed && styles.scheduleControlPressed,
            ]}
          >
            <Text style={styles.scheduleControlLabel}>{t('appointments.create.date')}</Text>
            <Text
              style={styles.scheduleControlValue}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              {isToday ? t('appointments.todayLabel') : formatDayMonth(date, locale)}
            </Text>
          </Pressable>

          <Pressable
            testID="appointment-edit-time-selector"
            onPress={() => {
              Haptics.selectionAsync()
              setTimePickerOpen(true)
            }}
            disabled={!scheduleReady || availableSlots.length === 0}
            accessibilityRole="button"
            accessibilityLabel={t('appointments.create.time')}
            accessibilityState={{
              disabled: !scheduleReady || availableSlots.length === 0,
            }}
            style={({ pressed }) => [
              styles.scheduleControl,
              (!scheduleReady || availableSlots.length === 0) &&
                styles.scheduleControlDisabled,
              pressed && scheduleReady && availableSlots.length > 0 &&
                styles.scheduleControlPressed,
            ]}
          >
            <Text style={styles.scheduleControlLabel}>{t('appointments.create.time')}</Text>
            {!scheduleReady && !scheduleError ? (
              <ActivityIndicator size="small" color={c.brand as string} />
            ) : (
              <Text
                style={[
                  styles.scheduleControlValue,
                  scheduleError && styles.scheduleControlValueError,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                {scheduleError
                  ? t('common.retry')
                  : `${formatTime(time)}–${formatTime(minToTime(toMin(time) + duration))}`}
              </Text>
            )}
          </Pressable>

          <Pressable
            testID="appointment-edit-duration-selector"
            onPress={() => {
              Haptics.selectionAsync()
              setDurationPickerOpen(true)
            }}
            accessibilityRole="button"
            accessibilityLabel={`${t('appointments.create.duration')}: ${t(
              'appointments.durationShort',
              { n: duration }
            )}`}
            style={({ pressed }) => [
              styles.scheduleControl,
              pressed && styles.scheduleControlPressed,
            ]}
          >
            <Text style={styles.scheduleControlLabel}>
              {t('appointments.create.duration')}
            </Text>
            <Text style={styles.scheduleControlValue} numberOfLines={1}>
              {t('appointments.durationShort', { n: duration })}
            </Text>
          </Pressable>
        </View>

        {scheduleError ? (
          <View style={styles.conflictHint}>
            <Icon name="cloud-offline-outline" size={14} color={c.danger as string} />
            <Text style={styles.conflictHintText}>{t('appointments.loadFailed')}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                profileQuery.refetch()
                dayQuery.refetch()
              }}
            >
              <Text style={styles.retryText}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        ) : scheduleReady && !slotValid ? (
          <View style={styles.conflictHint}>
            <Icon name="warning" size={14} color={c.danger as string} />
            <Text style={styles.conflictHintText}>{t('appointments.conflict')}</Text>
          </View>
        ) : null}
      </View>

      {/* Reason */}
      <View style={styles.field}>
        <View style={styles.reasonHeader}>
          <FieldLabel>{t('appointments.create.reason')}</FieldLabel>
          <Text style={styles.optionalLabel}>
            {t('appointments.create.reasonOptional')}
          </Text>
        </View>
        <View style={styles.reasonWrap}>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder={t('appointments.create.reasonPlaceholder')}
            placeholderTextColor={c.labelTertiary as string}
            style={styles.reasonInput}
            maxLength={255}
            returnKeyType="done"
            accessibilityLabel={t('appointments.create.reason')}
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.reasonChipsRow}
        >
          {quickReasons.map((r) => {
            const active = r === reason
            return (
              <Pressable
                key={r}
                onPress={() => {
                  Haptics.selectionAsync()
                  setReason(r)
                }}
                style={[styles.reasonChip, active && styles.reasonChipActive]}
              >
                <Text
                  style={[styles.reasonChipText, active && styles.reasonChipTextActive]}
                >
                  {r}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>
      </View>

      {isFinalized ? (
        <Text
          style={{
            color: c.danger as string,
            fontSize: 13,
            textAlign: 'center',
            marginTop: spacing.sm,
          }}
        >
          {t('appointments.edit.finalized')}
        </Text>
      ) : null}

      {isPastSlot && !isFinalized ? (
        <Text style={styles.pastNote}>{t('appointments.edit.past')}</Text>
      ) : null}

      <Button
        title={mutation.isPending ? t('appointments.edit.saving') : t('appointments.edit.save')}
        onPress={handleSubmit}
        loading={mutation.isPending}
        disabled={!canSubmit}
        fullWidth
        size="lg"
        style={{ marginTop: spacing.xs }}
      />

      <MonthCalendarPicker
        visible={calendarOpen}
        value={dateKey}
        minDate={today}
        maxDate={addDays(today, 365)}
        onClose={() => setCalendarOpen(false)}
        onConfirm={(nextDateKey) => {
          setDate(fromLocalDateKey(nextDateKey))
          setCalendarOpen(false)
        }}
      />

      <BottomSheet
        visible={visible && durationPickerOpen}
        onClose={() => setDurationPickerOpen(false)}
        title={t('appointments.create.duration')}
        closeAccessibilityLabel={t('common.close')}
      >
        <View style={styles.timeOptionGrid}>
          {DURATION_OPTIONS.map((option) => {
            const selected = option === duration
            return (
              <Pressable
                key={option}
                testID={`appointment-edit-duration-${option}`}
                onPress={() => {
                  Haptics.selectionAsync()
                  setDuration(option)
                  setDurationPickerOpen(false)
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.timeOption, selected && styles.timeOptionSelected]}
              >
                <Text
                  style={[
                    styles.timeOptionText,
                    selected && styles.timeOptionTextSelected,
                  ]}
                >
                  {t('appointments.durationShort', { n: option })}
                </Text>
                {selected ? <Icon name="checkmark" size={16} color="#FFFFFF" /> : null}
              </Pressable>
            )
          })}
        </View>
      </BottomSheet>

      <BottomSheet
        visible={visible && timePickerOpen}
        onClose={() => setTimePickerOpen(false)}
        title={t('appointments.create.time')}
        closeAccessibilityLabel={t('common.close')}
      >
        <View style={styles.timeOptionGrid}>
          {availableSlots.map((slot) => {
            const selected = slot === time
            return (
              <Pressable
                key={slot}
                testID={`appointment-edit-time-${slot}`}
                onPress={() => {
                  onSlotPress(slot)
                  setTimePickerOpen(false)
                }}
                accessibilityRole="button"
                accessibilityLabel={formatTime(slot)}
                accessibilityState={{ selected }}
                style={[styles.timeOption, selected && styles.timeOptionSelected]}
              >
                <Text
                  style={[
                    styles.timeOptionText,
                    selected && styles.timeOptionTextSelected,
                  ]}
                >
                  {formatTime(slot)}
                </Text>
                {selected ? <Icon name="checkmark" size={16} color="#FFFFFF" /> : null}
              </Pressable>
            )
          })}
        </View>
      </BottomSheet>
    </BottomSheet>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  return <Text style={styles.fieldLabel}>{children}</Text>
}

function findBlocker(
  slot: string,
  duration: number,
  appts: ApiAppointment[],
  status: ApiAppointment['status'],
  workStart: number = WORK_START,
  workEnd: number = WORK_END,
  appointmentDate?: string,
  now: Date = new Date()
): null | 'overflow' | 'past' | ApiAppointment {
  const start = toMin(slot)
  const end = start + duration
  if (
    appointmentDate &&
    isAppointmentPastSlot({ appointment_date: appointmentDate, start_time: slot }, now)
  ) {
    return 'past'
  }
  if (start < workStart || end > workEnd) return 'overflow'
  // Only enforce conflicts when the appointment is/becomes scheduled. A
  // cancelled or no_show edit can share a time without false alarms.
  if (status !== 'scheduled') return null
  for (const a of appts) {
    const aStart = toMin(a.start_time)
    const aEnd = toMin(a.end_time)
    if (start < aEnd && aStart < end) return a
  }
  return null
}

function isSlotValid(
  slot: string,
  duration: number,
  appts: ApiAppointment[],
  status: ApiAppointment['status'],
  workStart: number = WORK_START,
  workEnd: number = WORK_END,
  appointmentDate?: string,
  now: Date = new Date()
): boolean {
  return findBlocker(
    slot,
    duration,
    appts,
    status,
    workStart,
    workEnd,
    appointmentDate,
    now
  ) === null
}

function toMin(time: string): number {
  const [h, m] = time.split(':').map((n) => parseInt(n, 10) || 0)
  return h * 60 + m
}
function minToTime(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
function computeDuration(start: string, end: string): number {
  return toMin(end) - toMin(start)
}
function generateTimeSlots(workStart: number = WORK_START, workEnd: number = WORK_END): string[] {
  const slots: string[] = []
  for (let m = workStart; m <= workEnd - 15; m += SLOT_STEP) {
    slots.push(minToTime(m))
  }
  return slots
}

// Parse "HH:mm" into minutes-since-midnight; null for missing/invalid input.
function parseHm(value: string | null | undefined): number | null {
  if (!value) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!m) return null
  const h = parseInt(m[1]!, 10)
  const min = parseInt(m[2]!, 10)
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    patientHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      backgroundColor: c.brandLight,
      borderRadius: radius.xl,
    },
    patientName: {
      ...typography.bodyEmphasized,
      color: c.brandDeep,
    },
    patientHint: {
      ...typography.footnote,
      color: c.labelSecondary,
      marginTop: 2,
    },

    field: { gap: 10 },
    fieldLabel: {
      fontFamily: font('700'),
      fontSize: 12,
      fontWeight: '700',
      color: c.labelSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginLeft: 4,
    },
    scheduleRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 6,
    },
    scheduleControl: {
      flex: 1,
      minWidth: 0,
      height: inputMetrics.height,
      justifyContent: 'center',
      gap: 1,
      paddingHorizontal: 8,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.brandSoft,
      backgroundColor: c.background,
    },
    scheduleControlPressed: {
      opacity: 0.7,
      transform: [{ scale: 0.985 }],
    },
    scheduleControlDisabled: {
      opacity: 0.58,
      backgroundColor: c.fillQuaternary,
    },
    scheduleControlLabel: {
      fontFamily: font('600'),
      fontSize: 9,
      lineHeight: 11,
      fontWeight: '600',
      letterSpacing: 0.35,
      textTransform: 'uppercase',
      color: c.labelTertiary,
    },
    scheduleControlValue: {
      fontFamily: font('700'),
      fontSize: 13,
      lineHeight: 17,
      fontWeight: '700',
      color: c.label,
    },
    scheduleControlValueError: {
      color: c.danger,
    },
    timeOptionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    timeOption: {
      width: '31%',
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.separator as string,
      backgroundColor: c.background,
    },
    timeOptionSelected: {
      backgroundColor: c.brand,
      borderColor: c.brand,
    },
    timeOptionText: {
      fontFamily: font('700'),
      fontSize: 14,
      fontWeight: '700',
      color: c.label,
    },
    timeOptionTextSelected: {
      color: '#FFFFFF',
    },

    conflictHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(255, 59, 48, 0.08)',
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: radius.md,
      marginTop: 4,
    },
    conflictHintText: {
      fontFamily: font('600'),
      fontSize: 12,
      fontWeight: '600',
      color: c.danger,
      flex: 1,
    },
    retryText: {
      fontFamily: font('700'),
      fontSize: 12,
      fontWeight: '700',
      color: c.brand,
    },
    pastNote: {
      ...typography.subhead,
      color: c.danger,
      textAlign: 'center',
      marginTop: spacing.sm,
    },

    // Reason
    reasonHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    optionalLabel: {
      fontFamily: font('500'),
      fontSize: 11,
      fontWeight: '500',
      color: c.labelTertiary,
      marginRight: 4,
      textTransform: 'lowercase',
    },
    reasonWrap: {
      backgroundColor: c.background,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.brandSoft,
      paddingHorizontal: inputMetrics.paddingHorizontal,
      minHeight: inputMetrics.height,
      justifyContent: 'center',
    },
    reasonInput: {
      fontFamily: font('400'),
      fontSize: inputMetrics.fontSize,
      lineHeight: inputMetrics.lineHeight,
      color: c.label,
      minHeight: inputMetrics.height - 2,
      paddingVertical: 0,
    },
    reasonChipsRow: {
      gap: 6,
      paddingVertical: 2,
      paddingHorizontal: 2,
    },
    reasonChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      backgroundColor: c.fillQuaternary,
      borderRadius: radius.pill,
    },
    reasonChipActive: { backgroundColor: c.brandLight },
    reasonChipText: {
      fontFamily: font('500'),
      fontSize: 12,
      fontWeight: '500',
      color: c.labelSecondary,
    },
    reasonChipTextActive: { color: c.brand, fontWeight: '700', fontFamily: font('700') },
  })
}
