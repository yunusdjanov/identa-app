import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { useQuery, useMutation } from '@tanstack/react-query'

import BottomSheet from '../ui/BottomSheet'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import InputCard from '../ui/InputCard'
import PatientAvatar from '../ui/PatientAvatar'
import MonthCalendarPicker from '../ui/MonthCalendarPicker'
import { useI18n } from '../../i18n'
import { useToast } from '../ui/Toast'
import { getTranslationArray } from '../../i18n/helpers'
import { isOfflineError } from '../../lib/offlineGuard'
import type { Locale } from '../../constants'
import { listPatients } from '../../api/patients'
import { getProfile } from '../../api/profile'
import { createAppointment, listAppointments } from '../../api/appointments'
import { scheduleAppointmentReminder, ensureNotificationPermissions } from '../../lib/notifications'
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
import type { ApiAppointment, ApiPatient } from '../../types'

interface Props {
  visible: boolean
  onClose: () => void
  defaultDate?: Date
  // Receives the freshly-created appointment so the caller can react with
  // context (e.g. jump the AppointmentsScreen to its date). Optional to
  // preserve backward compatibility for callers that don't care.
  onCreated?: (created: ApiAppointment) => void
}

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120]
const WORK_START = 8 * 60
const WORK_END = 20 * 60
const SLOT_STEP = 30
const DATE_STRIP_DAYS = 28

const MORNING_END = 12 * 60
const AFTERNOON_END = 17 * 60

export default function AppointmentCreateSheet({
  visible,
  onClose,
  defaultDate,
  onCreated,
}: Props) {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const toast = useToast()

  const [patient, setPatient] = useState<ApiPatient | null>(null)
  const [search, setSearch] = useState('')
  const [date, setDate] = useState<Date>(() => defaultDate ?? new Date())
  const [time, setTime] = useState<string>('09:00')
  const [duration, setDuration] = useState<number>(30)
  const [reason, setReason] = useState('')
  // Calendar overlay state — the chip row + week strip cover the immediate
  // future; the calendar handles dates beyond DATE_STRIP_DAYS or quick
  // jumps to a specific day-of-week several months out.
  const [calendarOpen, setCalendarOpen] = useState(false)

  // Clinic working hours come from the dentist's profile settings. Fall back
  // to the default 08:00–20:00 window until the profile loads (or if unset).
  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
    enabled: visible,
    staleTime: 5 * 60_000,
  })
  const workStart = parseHm(profileQuery.data?.working_hours?.start) ?? WORK_START
  const workEnd = parseHm(profileQuery.data?.working_hours?.end) ?? WORK_END

  // Reset when sheet opens. We pick a sensible default time after the
  // appointments load (see effect below); 09:00 here is just a placeholder.
  useEffect(() => {
    if (visible) {
      setPatient(null)
      setSearch('')
      setDate(defaultDate ?? new Date())
      setTime('09:00')
      setDuration(30)
      setReason('')
    }
  }, [visible, defaultDate])

  // Patient search.
  // Only hit the API once the user types at least one character — the
  // sheet should feel "empty" by default rather than dumping the whole
  // patient list before any intent is expressed.
  const trimmedSearch = search.trim()
  const patientsQuery = useQuery({
    queryKey: ['patients', 'lookup', trimmedSearch],
    queryFn: () => listPatients({ search: trimmedSearch, per_page: 12 }),
    enabled: visible && !patient && trimmedSearch.length > 0,
    staleTime: 30_000,
  })
  const patientResults = trimmedSearch.length > 0 ? patientsQuery.data?.data ?? [] : []

  // Day appointments (for conflict checks + day overview)
  const dateKey = toLocalDateKey(date)
  const dayQuery = useQuery({
    queryKey: ['appointments', 'day', dateKey],
    queryFn: () => listAppointments({ date: dateKey }),
    enabled: visible,
    staleTime: 30_000,
  })
  const dayAppointments = dayQuery.data?.data ?? []
  const activeAppts = dayAppointments.filter(
    (a) => a.status !== 'cancelled' && a.status !== 'no_show'
  )

  const today = useMemo(() => new Date(), [])

  // Auto-select first free slot whenever date / duration / appointments change,
  // unless the user has already picked a slot that's still valid.
  useEffect(() => {
    if (!visible) return
    const isToday = isSameDay(date, today)
    const stillValid = isSlotValid(time, duration, activeAppts, isToday ? today : null, workEnd)
    if (stillValid) return
    const next = findFirstFreeSlot(activeAppts, duration, isToday ? today : null, workStart, workEnd)
    if (next) setTime(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, dateKey, duration, dayQuery.dataUpdatedAt])

  const create = useMutation({
    mutationFn: () =>
      createAppointment({
        patient_id: patient!.id,
        patient_name: patient!.full_name,
        appointment_date: dateKey,
        start_time: time,
        end_time: minToTime(toMin(time) + duration),
        status: 'scheduled',
        notes: reason.trim() || null,
      }),
    onSuccess: (created) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      toast.success(t('appointments.create.created'))
      // Fire-and-forget local reminder. If the user denies permission this
      // silently no-ops — appointment creation still succeeded.
      ensureNotificationPermissions()
        .then((granted) => {
          if (granted) scheduleAppointmentReminder(created).catch(() => {})
        })
        .catch(() => {})
      onCreated?.(created)
      onClose()
    },
    onError: (err) => {
      if (isOfflineError(err)) return
      toast.error(t('appointments.create.failed'))
    },
  })

  const isToday = isSameDay(date, today)
  const slotValid = isSlotValid(time, duration, activeAppts, isToday ? today : null, workEnd)
  const canSubmit = Boolean(patient) && slotValid

  const handleSubmit = () => {
    if (!canSubmit) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      return
    }
    create.mutate()
  }

  // Time slots grouped by morning / afternoon / evening. The grouping
  // itself depends only on the static slot list, so it's memoized once.
  const slots = useMemo(() => generateTimeSlots(workStart, workEnd), [workStart, workEnd])
  const { morningSlots, afternoonSlots, eveningSlots } = useMemo(() => {
    return {
      morningSlots: slots.filter((s) => toMin(s) < MORNING_END),
      afternoonSlots: slots.filter((s) => toMin(s) >= MORNING_END && toMin(s) < AFTERNOON_END),
      eveningSlots: slots.filter((s) => toMin(s) >= AFTERNOON_END),
    }
  }, [slots])

  // Precompute the blocker for every slot once per render. Without this,
  // TimeGroup recalculates 24× per render and the result is shared across
  // morning/afternoon/evening anyway.
  const blockerBySlot = useMemo(() => {
    const map = new Map<string, ReturnType<typeof findBlocker>>()
    for (const slot of slots) {
      map.set(slot, findBlocker(slot, duration, activeAppts, isToday ? today : null, workEnd))
    }
    return map
  }, [slots, duration, activeAppts, isToday, today, workEnd])

  const dateStripDays = useMemo(
    () => Array.from({ length: DATE_STRIP_DAYS }, (_, i) => addDays(today, i)),
    [today]
  )

  const quickReasons = useMemo(
    () => getTranslationArray<string>(locale as Locale, 'appointments.create.quickReasons'),
    [locale]
  )

  const onSlotPress = (slot: string) => {
    const blocker = findBlocker(slot, duration, activeAppts, isToday ? today : null, workEnd)
    if (blocker === 'past') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      return
    }
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

  const submitTitle = create.isPending
    ? t('appointments.create.creating')
    : !patient
      ? t('appointments.create.pickPatientFirst')
      : !slotValid
        ? t('appointments.create.pickTime')
        : t('appointments.create.create')

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('appointments.create.title')}>
      {/* Patient */}
      <View style={styles.field}>
        <FieldLabel>{t('appointments.create.selectPatient')}</FieldLabel>
        {patient ? (
          <View style={styles.selectedPatient}>
            <PatientAvatar name={patient.full_name} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={styles.selectedName} numberOfLines={1}>
                {patient.full_name}
              </Text>
              <Text style={styles.selectedPhone} numberOfLines={1}>
                {patient.phone}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync()
                setPatient(null)
              }}
              hitSlop={10}
              style={styles.changeBtn}
            >
              <Text style={styles.changeBtnText}>{t('appointments.create.changePatient')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <InputCard
              iconName="search-outline"
              value={search}
              onChangeText={setSearch}
              placeholder={t('appointments.create.searchPlaceholder')}
              autoCapitalize="words"
              autoCorrect={false}
            />
            {patientResults.length > 0 ? (
              <View style={styles.patientList}>
                {patientResults.slice(0, 5).map((p, i) => (
                  <React.Fragment key={p.id}>
                    <Pressable
                      onPress={() => {
                        Haptics.selectionAsync()
                        setPatient(p)
                        setSearch('')
                      }}
                      style={({ pressed }) => [
                        styles.patientRow,
                        pressed && styles.patientRowPressed,
                      ]}
                    >
                      <PatientAvatar name={p.full_name} size={34} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.patientRowName} numberOfLines={1}>
                          {p.full_name}
                        </Text>
                        <Text style={styles.patientRowPhone} numberOfLines={1}>
                          {p.phone}
                        </Text>
                      </View>
                    </Pressable>
                    {i < patientResults.slice(0, 5).length - 1 ? (
                      <View style={styles.patientSep} />
                    ) : null}
                  </React.Fragment>
                ))}
              </View>
            ) : null}
          </>
        )}
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
          {/* Tap the date label to open a full month calendar — covers
              cases where the user needs to book further than the visible
              28-day strip allows. */}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync()
              setCalendarOpen(true)
            }}
            hitSlop={8}
            style={styles.monthLabelBtn}
          >
            <Text style={styles.monthLabel}>{formatDayMonth(date, locale)}</Text>
            <Icon name="calendar-outline" size={15} color={c.brand as string} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateStrip}
        >
          {dateStripDays.map((d) => {
            const selected = isSameDay(d, date)
            const isTodayCell = isSameDay(d, today)
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
                  ]}
                >
                  {formatWeekdayShort(d, locale).slice(0, 3)}
                </Text>
                <Text
                  style={[
                    styles.dateNumber,
                    selected && styles.dateNumberActive,
                    !selected && isTodayCell && styles.dateNumberToday,
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
        <View style={styles.durationRow}>
          {DURATION_OPTIONS.map((d) => {
            const active = d === duration
            return (
              <Pressable
                key={d}
                onPress={() => {
                  Haptics.selectionAsync()
                  setDuration(d)
                }}
                style={[styles.durationChip, active && styles.durationChipActive]}
              >
                <Text style={[styles.durationText, active && styles.durationTextActive]}>
                  {t('appointments.durationShort', { n: d })}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      {/* Time slots */}
      <View style={styles.field}>
        <View style={styles.timeHeaderRow}>
          <FieldLabel>{t('appointments.create.time')}</FieldLabel>
          {dayQuery.isLoading ? (
            <Text style={styles.loadingHint}>···</Text>
          ) : (
            <Text style={styles.bookedCount}>
              {activeAppts.length > 0
                ? `${activeAppts.length} ${t('appointments.create.slotBusy').toLowerCase()}`
                : ''}
            </Text>
          )}
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

        {!slotValid && patient && !dayQuery.isLoading ? (
          <View style={styles.allBusyHint}>
            <Icon name="warning" size={14} color={c.danger as string} />
            <Text style={styles.allBusyText}>{t('appointments.create.allBusy')}</Text>
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

      {/* Summary + submit */}
      {canSubmit ? (
        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Icon name="checkmark" size={16} color="#FFFFFF" />
          </View>
          <Text style={styles.summaryText} numberOfLines={2}>
            {t('appointments.create.summary', {
              date: isToday
                ? t('appointments.todayLabel')
                : isSameDay(date, addDays(today, 1))
                  ? t('appointments.tomorrowLabel')
                  : formatDayMonth(date, locale),
              time: formatTime(time),
              duration: t('appointments.durationShort', { n: duration }),
            })}
          </Text>
        </View>
      ) : null}

      <Button
        title={submitTitle}
        loading={create.isPending}
        disabled={!canSubmit}
        onPress={handleSubmit}
        fullWidth
        size="lg"
      />

      {/* Full-month calendar overlay — opens from the date-label chip
          above. Min date is today (no past bookings); max is +12 months,
          which is enough headroom for forward planning without making the
          picker feel infinite. */}
      <MonthCalendarPicker
        visible={calendarOpen}
        value={toLocalDateKey(date)}
        minDate={today}
        maxDate={addDays(today, 365)}
        onClose={() => setCalendarOpen(false)}
        onConfirm={(dateKey) => {
          setDate(fromLocalDateKey(dateKey))
          setCalendarOpen(false)
        }}
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
          const isPast = blocker === 'past'
          const isOverflow = blocker === 'overflow'
          return (
            <Pressable
              key={slot}
              onPress={() => onPress(slot)}
              style={[
                styles.timeChip,
                isActive && styles.timeChipActive,
                isBusy && styles.timeChipBusy,
                (isPast || isOverflow) && styles.timeChipDisabled,
              ]}
            >
              <Text
                style={[
                  styles.timeText,
                  isActive && styles.timeTextActive,
                  isBusy && styles.timeTextBusy,
                  (isPast || isOverflow) && styles.timeTextDisabled,
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

// Returns null if slot is free, otherwise:
// - 'past' if the slot start is before now
// - 'overflow' if the slot+duration exceeds work end
// - the conflicting appointment if it overlaps with an active booking
function findBlocker(
  slot: string,
  duration: number,
  appts: ApiAppointment[],
  now: Date | null,
  workEnd: number = WORK_END
): null | 'past' | 'overflow' | ApiAppointment {
  const start = toMin(slot)
  const end = start + duration
  if (now) {
    const nowMin = now.getHours() * 60 + now.getMinutes()
    if (start < nowMin) return 'past'
  }
  if (end > workEnd) return 'overflow'
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
  now: Date | null,
  workEnd: number = WORK_END
): boolean {
  return findBlocker(slot, duration, appts, now, workEnd) === null
}

function findFirstFreeSlot(
  appts: ApiAppointment[],
  duration: number,
  now: Date | null,
  workStart: number = WORK_START,
  workEnd: number = WORK_END
): string | null {
  let start = workStart
  if (now) {
    const nowMin = now.getHours() * 60 + now.getMinutes()
    start = Math.max(workStart, Math.ceil(nowMin / SLOT_STEP) * SLOT_STEP)
  }
  for (let m = start; m + duration <= workEnd; m += SLOT_STEP) {
    const slot = minToTime(m)
    if (isSlotValid(slot, duration, appts, now, workEnd)) return slot
  }
  return null
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
function generateTimeSlots(workStart: number = WORK_START, workEnd: number = WORK_END): string[] {
  const slots: string[] = []
  for (let m = workStart; m <= workEnd - 15; m += SLOT_STEP) {
    slots.push(minToTime(m))
  }
  return slots
}

// Parse "HH:mm" into minutes-since-midnight. Returns null for missing/invalid
// input so callers can fall back to the default work window.
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

    // Patient
    selectedPatient: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      backgroundColor: c.brandLight,
      borderRadius: radius.xl,
    },
    selectedName: {
      ...typography.bodyEmphasized,
      color: c.brandDeep,
    },
    selectedPhone: {
      ...typography.footnote,
      color: c.labelSecondary,
      marginTop: 2,
    },
    changeBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: '#FFFFFF',
      borderRadius: radius.pill,
    },
    changeBtnText: {
      fontFamily: font('600'),
      fontSize: 12,
      fontWeight: '600',
      color: c.brand,
    },
    patientList: {
      backgroundColor: c.background,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.separator as string,
      overflow: 'hidden',
      marginTop: 4,
    },
    patientRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 10,
    },
    patientRowPressed: { backgroundColor: c.fillQuaternary },
    patientRowName: {
      ...typography.subheadBold,
      color: c.label,
    },
    patientRowPhone: {
      ...typography.caption1,
      color: c.labelSecondary,
    },
    patientSep: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.separator as string,
      marginLeft: 54,
    },

    // Date
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
    // Tappable wrapper around the date label + a calendar icon — signals
    // that the label opens a date picker, not just static text.
    monthLabelBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: c.brandLight,
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

    // Duration
    durationRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    durationChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radius.pill,
      backgroundColor: c.fillQuaternary,
    },
    durationChipActive: { backgroundColor: c.brand },
    durationText: {
      fontFamily: font('600'),
      fontSize: 13,
      fontWeight: '600',
      color: c.label,
    },
    durationTextActive: { color: '#FFFFFF' },

    // Time
    timeHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    loadingHint: {
      fontFamily: font('700'),
      fontSize: 14,
      color: c.labelTertiary,
      marginRight: 4,
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
    // Default = FREE slot. Brand-tinted background + brand text makes it
    // clearly read as a tappable button rather than a disabled control
    // (the previous fillQuaternary gray was indistinguishable from the
    // "past/overflow" dim state, so users perceived every slot as off).
    timeChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radius.md,
      backgroundColor: c.brandLight,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(20, 184, 166, 0.18)',
      minWidth: 62,
      alignItems: 'center',
    },
    timeChipActive: {
      backgroundColor: c.brand as string,
      borderColor: c.brand as string,
    },
    // Booked = visually loud red. Solid-ish fill + clear border so the
    // user immediately sees "this slot is taken" without reading the
    // label.
    timeChipBusy: {
      backgroundColor: 'rgba(255, 59, 48, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(255, 59, 48, 0.45)',
    },
    // Past/overflow stays disabled (not bookable) but uses neutral gray
    // (not red) so it doesn't get confused with "booked".
    timeChipDisabled: {
      backgroundColor: c.fillQuaternary,
      borderColor: 'transparent',
      opacity: 0.5,
    },
    timeText: {
      fontFamily: font('700'),
      fontSize: 13,
      fontWeight: '700',
      color: c.brandDeep,
    },
    timeTextActive: { color: '#FFFFFF' },
    timeTextBusy: { color: c.danger, fontWeight: '800' },
    timeTextDisabled: { color: c.labelTertiary },
    allBusyHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(255, 59, 48, 0.08)',
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: radius.md,
      marginTop: 4,
    },
    allBusyText: {
      fontFamily: font('600'),
      fontSize: 12,
      fontWeight: '600',
      color: c.danger,
      flex: 1,
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

    // Summary card
    summaryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: c.brandLight,
      borderRadius: radius.lg,
      marginTop: 4,
    },
    summaryIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: c.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    summaryText: {
      flex: 1,
      fontFamily: font('600'),
      fontSize: 13,
      fontWeight: '600',
      color: c.brandDeep,
      textTransform: 'capitalize',
    },
  })
}
