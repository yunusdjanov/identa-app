import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'

import BottomSheet from '../ui/BottomSheet'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import PatientAvatar from '../ui/PatientAvatar'
import { useToast } from '../ui/Toast'

import { useI18n } from '../../i18n'
import { getTranslationArray } from '../../i18n/helpers'
import { isOfflineError } from '../../lib/offlineGuard'
import type { Locale } from '../../constants'
import { listAppointments, updateAppointment } from '../../api/appointments'
import { getProfile } from '../../api/profile'
import {
  scheduleAppointmentReminder,
  cancelAppointmentReminder,
} from '../../lib/notifications'
import {
  addDays,
  formatDayMonth,
  formatTime,
  formatWeekdayShort,
  fromLocalDateKey,
  isSameDay,
  toLocalDateKey,
} from '../../lib/format'
import { radius, spacing, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import type { ApiAppointment } from '../../types'

interface Props {
  visible: boolean
  appointment: ApiAppointment | null
  onClose: () => void
  onSaved?: () => void
}

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120]
const WORK_START = 8 * 60
const WORK_END = 20 * 60
const SLOT_STEP = 30
const DATE_STRIP_DAYS = 28

const MORNING_END = 12 * 60
const AFTERNOON_END = 17 * 60

const STATUSES: ApiAppointment['status'][] = ['scheduled', 'completed', 'cancelled', 'no_show']

function getStatusColor(c: Colors): Record<ApiAppointment['status'], string> {
  return {
    scheduled: c.scheduled,
    completed: c.completed,
    cancelled: c.cancelled,
    no_show: c.no_show,
  }
}

export default function AppointmentEditSheet({ visible, appointment, onClose, onSaved }: Props) {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const statusColors = useMemo(() => getStatusColor(c), [c])
  const toast = useToast()
  const queryClient = useQueryClient()

  const [date, setDate] = useState<Date>(new Date())
  const [time, setTime] = useState('09:00')
  const [duration, setDuration] = useState(30)
  const [status, setStatus] = useState<ApiAppointment['status']>('scheduled')
  const [reason, setReason] = useState('')

  // Pre-fill when sheet opens
  useEffect(() => {
    if (visible && appointment) {
      setDate(fromLocalDateKey(appointment.appointment_date))
      setTime(appointment.start_time)
      setDuration(computeDuration(appointment.start_time, appointment.end_time))
      setStatus(appointment.status)
      setReason(appointment.notes ?? '')
    }
  }, [visible, appointment])

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

  // Clinic working hours from profile settings; fall back to 08:00–20:00.
  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
    enabled: visible,
    staleTime: 5 * 60_000,
  })
  const workStart = parseHm(profileQuery.data?.working_hours?.start) ?? WORK_START
  const workEnd = parseHm(profileQuery.data?.working_hours?.end) ?? WORK_END

  const today = useMemo(() => new Date(), [])
  const isToday = isSameDay(date, today)
  // When editing an existing appointment we never block past slots — the user
  // may be correcting a missed appointment. We only block other-booking
  // overlaps and overflow.
  const slotValid = isSlotValid(time, duration, otherActiveAppts, status, workEnd)
  // The backend forbids editing an appointment that is already finalized
  // (completed/cancelled/no_show) — AppointmentService throws
  // `finalized_cannot_be_edited`. Disable save and show a notice instead of
  // letting the PUT 422.
  const isFinalized = appointment != null && appointment.status !== 'scheduled'
  const canSubmit = slotValid && !isFinalized

  const slots = useMemo(() => generateTimeSlots(workStart, workEnd), [workStart, workEnd])
  const { morningSlots, afternoonSlots, eveningSlots } = useMemo(() => {
    return {
      morningSlots: slots.filter((s) => toMin(s) < MORNING_END),
      afternoonSlots: slots.filter((s) => toMin(s) >= MORNING_END && toMin(s) < AFTERNOON_END),
      eveningSlots: slots.filter((s) => toMin(s) >= AFTERNOON_END),
    }
  }, [slots])

  // Single pass over the slot list per render. Each TimeGroup just reads
  // from this map instead of recomputing for every chip.
  const blockerBySlot = useMemo(() => {
    const map = new Map<string, ReturnType<typeof findBlocker>>()
    for (const slot of slots) {
      map.set(slot, findBlocker(slot, duration, otherActiveAppts, status, workEnd))
    }
    return map
  }, [slots, duration, otherActiveAppts, status, workEnd])

  const dateStripDays = useMemo(() => {
    // Show 7 days back + 21 forward so a past appointment's date stays
    // visible in the strip when the user opens edit.
    return Array.from({ length: DATE_STRIP_DAYS }, (_, i) => addDays(today, i - 7))
  }, [today])

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
        appointment_date: dateKey,
        start_time: time,
        end_time: minToTime(toMin(time) + duration),
        status,
        notes: reason.trim() || null,
      }),
    onSuccess: (updated) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      toast.success(t('appointments.edit.saved'))
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      // Sync the local reminder to match the new state. Cancelled/no-show
      // appointments drop their reminders; rescheduled ones get a fresh one.
      if (updated.status === 'scheduled') {
        scheduleAppointmentReminder(updated).catch(() => {})
      } else {
        cancelAppointmentReminder(updated.id).catch(() => {})
      }
      onSaved?.()
      onClose()
    },
    onError: (err) => {
      if (isOfflineError(err)) return
      toast.error(t('appointments.edit.failed'))
    },
  })

  const onSlotPress = (slot: string) => {
    const blocker = findBlocker(slot, duration, otherActiveAppts, status, workEnd)
    if (blocker === 'overflow') {
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
    <BottomSheet visible={visible} onClose={onClose} title={t('appointments.edit.title')}>
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

      {/* Status */}
      <View style={styles.field}>
        <FieldLabel>{t('appointments.edit.statusLabel')}</FieldLabel>
        <View style={styles.chipsRow}>
          {STATUSES.map((s) => {
            const active = s === status
            const color = statusColors[s]
            return (
              <Pressable
                key={s}
                onPress={() => {
                  Haptics.selectionAsync()
                  setStatus(s)
                }}
                style={[
                  styles.statusChip,
                  active && { backgroundColor: color, borderColor: color },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: active ? '#FFFFFF' : color },
                  ]}
                />
                <Text
                  style={[styles.statusChipText, active && styles.statusChipTextActive]}
                >
                  {t(`appointments.status.${s}`)}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      {/* Date — quick chips + horizontal strip */}
      <View style={styles.field}>
        <FieldLabel>{t('appointments.create.date')}</FieldLabel>

        <View style={styles.quickRow}>
          <QuickChip
            label={t('appointments.todayLabel')}
            active={isSameDay(date, today)}
            onPress={() => {
              Haptics.selectionAsync()
              setDate(today)
            }}
          />
          <QuickChip
            label={t('appointments.tomorrowLabel')}
            active={isSameDay(date, addDays(today, 1))}
            onPress={() => {
              Haptics.selectionAsync()
              setDate(addDays(today, 1))
            }}
          />
          <View style={{ flex: 1 }} />
          <Text style={styles.monthLabel}>{formatDayMonth(date, locale)}</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateStrip}
        >
          {dateStripDays.map((d) => {
            const selected = isSameDay(d, date)
            const isTodayCell = isSameDay(d, today)
            const isPast = d < today && !isSameDay(d, today)
            return (
              <Pressable
                key={toLocalDateKey(d)}
                onPress={() => {
                  Haptics.selectionAsync()
                  setDate(d)
                }}
                style={[styles.dateCell, selected && styles.dateCellActive]}
              >
                <Text
                  style={[
                    styles.dateWeekday,
                    selected && styles.dateWeekdayActive,
                    !selected && isPast && styles.dateMuted,
                  ]}
                >
                  {formatWeekdayShort(d, locale).slice(0, 3)}
                </Text>
                <Text
                  style={[
                    styles.dateNumber,
                    selected && styles.dateNumberActive,
                    !selected && isTodayCell && styles.dateNumberToday,
                    !selected && isPast && styles.dateMuted,
                  ]}
                >
                  {d.getDate()}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>
      </View>

      {/* Duration */}
      <View style={styles.field}>
        <FieldLabel>{t('appointments.create.duration')}</FieldLabel>
        <View style={styles.chipsRow}>
          {DURATION_OPTIONS.map((d) => {
            const active = d === duration
            return (
              <Pressable
                key={d}
                onPress={() => {
                  Haptics.selectionAsync()
                  setDuration(d)
                }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {t('appointments.durationShort', { n: d })}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      {/* Time */}
      <View style={styles.field}>
        <View style={styles.timeHeaderRow}>
          <FieldLabel>{t('appointments.create.time')}</FieldLabel>
          {otherActiveAppts.length > 0 && status === 'scheduled' ? (
            <Text style={styles.bookedCount}>
              {otherActiveAppts.length} {t('appointments.create.slotBusy').toLowerCase()}
            </Text>
          ) : null}
        </View>

        <TimeGroup
          label={t('appointments.create.morning')}
          slots={morningSlots}
          selectedTime={time}
          blockerBySlot={blockerBySlot}
          onPress={onSlotPress}
        />
        <TimeGroup
          label={t('appointments.create.afternoon')}
          slots={afternoonSlots}
          selectedTime={time}
          blockerBySlot={blockerBySlot}
          onPress={onSlotPress}
        />
        <TimeGroup
          label={t('appointments.create.evening')}
          slots={eveningSlots}
          selectedTime={time}
          blockerBySlot={blockerBySlot}
          onPress={onSlotPress}
        />

        {!slotValid ? (
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
            maxLength={200}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
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

      <Button
        title={mutation.isPending ? t('appointments.edit.saving') : t('appointments.edit.save')}
        onPress={handleSubmit}
        loading={mutation.isPending}
        disabled={!canSubmit}
        fullWidth
        size="lg"
        style={{ marginTop: spacing.xs }}
      />
    </BottomSheet>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  return <Text style={styles.fieldLabel}>{children}</Text>
}

function QuickChip({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  return (
    <Pressable
      onPress={onPress}
      style={[styles.quickChip, active && styles.quickChipActive]}
      hitSlop={4}
    >
      <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>
        {label}
      </Text>
    </Pressable>
  )
}

function TimeGroup({
  label,
  slots,
  selectedTime,
  blockerBySlot,
  onPress,
}: {
  label: string
  slots: string[]
  selectedTime: string
  blockerBySlot: Map<string, ReturnType<typeof findBlocker>>
  onPress: (slot: string) => void
}) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  if (slots.length === 0) return null
  return (
    <View style={styles.timeGroup}>
      <Text style={styles.timeGroupLabel}>{label}</Text>
      <View style={styles.timeChipsWrap}>
        {slots.map((slot) => {
          const blocker = blockerBySlot.get(slot) ?? null
          const isActive = slot === selectedTime && blocker === null
          const isBusy = blocker !== null && typeof blocker === 'object'
          const isOverflow = blocker === 'overflow'
          return (
            <Pressable
              key={slot}
              onPress={() => onPress(slot)}
              style={[
                styles.timeChip,
                isActive && styles.timeChipActive,
                isBusy && styles.timeChipBusy,
                isOverflow && styles.timeChipDisabled,
              ]}
            >
              <Text
                style={[
                  styles.timeText,
                  isActive && styles.timeTextActive,
                  isBusy && styles.timeTextBusy,
                  isOverflow && styles.timeTextDisabled,
                ]}
              >
                {formatTime(slot)}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function findBlocker(
  slot: string,
  duration: number,
  appts: ApiAppointment[],
  status: ApiAppointment['status'],
  workEnd: number = WORK_END
): null | 'overflow' | ApiAppointment {
  const start = toMin(slot)
  const end = start + duration
  if (end > workEnd) return 'overflow'
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
  workEnd: number = WORK_END
): boolean {
  return findBlocker(slot, duration, appts, status, workEnd) === null
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

    // Date strip
    quickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 2,
    },
    quickChip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: radius.pill,
      backgroundColor: c.fillQuaternary,
    },
    quickChipActive: { backgroundColor: c.brand },
    quickChipText: {
      fontFamily: font('600'),
      fontSize: 13,
      fontWeight: '600',
      color: c.label,
    },
    quickChipTextActive: { color: '#FFFFFF' },
    monthLabel: {
      fontFamily: font('600'),
      fontSize: 13,
      fontWeight: '600',
      color: c.labelSecondary,
      textTransform: 'capitalize',
    },
    dateStrip: {
      gap: 8,
      paddingVertical: 4,
      paddingHorizontal: 2,
    },
    dateCell: {
      width: 52,
      height: 64,
      borderRadius: radius.lg,
      backgroundColor: c.fillQuaternary,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    dateCellActive: { backgroundColor: c.brand },
    dateWeekday: {
      fontFamily: font('600'),
      fontSize: 11,
      fontWeight: '600',
      color: c.labelSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.2,
    },
    dateWeekdayActive: { color: 'rgba(255,255,255,0.85)' },
    dateNumber: {
      fontFamily: font('700'),
      fontSize: 18,
      fontWeight: '700',
      color: c.label,
      letterSpacing: -0.3,
    },
    dateNumberActive: { color: '#FFFFFF' },
    dateNumberToday: { color: c.brand },
    dateMuted: { color: c.labelTertiary, opacity: 0.7 },

    // Chips (duration)
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radius.pill,
      backgroundColor: c.fillQuaternary,
    },
    chipActive: { backgroundColor: c.brand },
    chipText: {
      fontFamily: font('600'),
      fontSize: 13,
      fontWeight: '600',
      color: c.label,
    },
    chipTextActive: { color: '#FFFFFF' },

    // Time
    timeHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    bookedCount: {
      fontFamily: font('600'),
      fontSize: 11,
      fontWeight: '600',
      color: c.labelSecondary,
      marginRight: 4,
    },
    timeGroup: { gap: 6, marginTop: 2 },
    timeGroupLabel: {
      fontFamily: font('600'),
      fontSize: 12,
      fontWeight: '600',
      color: c.labelTertiary,
      marginLeft: 4,
    },
    timeChipsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    timeChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radius.md,
      backgroundColor: c.fillQuaternary,
      minWidth: 62,
      alignItems: 'center',
    },
    timeChipActive: { backgroundColor: c.brand },
    timeChipBusy: {
      backgroundColor: 'rgba(255, 59, 48, 0.10)',
      borderWidth: 1,
      borderColor: 'rgba(255, 59, 48, 0.22)',
    },
    timeChipDisabled: { opacity: 0.35 },
    timeText: {
      fontFamily: font('700'),
      fontSize: 13,
      fontWeight: '700',
      color: c.label,
    },
    timeTextActive: { color: '#FFFFFF' },
    timeTextBusy: { color: c.danger },
    timeTextDisabled: { color: c.labelTertiary },
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

    // Status
    statusChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: radius.pill,
      backgroundColor: c.fillQuaternary,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusChipText: {
      fontFamily: font('600'),
      fontSize: 13,
      fontWeight: '600',
      color: c.label,
    },
    statusChipTextActive: { color: '#FFFFFF' },

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
      backgroundColor: c.fillQuaternary,
      borderRadius: radius.lg,
      paddingHorizontal: 14,
      paddingVertical: 10,
      minHeight: 76,
    },
    reasonInput: {
      fontFamily: font('400'),
      fontSize: 15,
      color: c.label,
      minHeight: 56,
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
