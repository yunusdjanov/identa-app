import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { useQuery, useMutation } from '@tanstack/react-query'

import BottomSheet from '../ui/BottomSheet'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import InputCard from '../ui/InputCard'
import PatientAvatar from '../ui/PatientAvatar'
import SegmentedControl from '../ui/SegmentedControl'
import MonthCalendarPicker from '../ui/MonthCalendarPicker'
import { useI18n } from '../../i18n'
import { getTranslationArray } from '../../i18n/helpers'
import { useToast } from '../ui/Toast'
import { isOfflineError } from '../../lib/offlineGuard'
import { isApiError } from '../../api/client'
import { useDebouncedValue } from '../../lib/useDebouncedValue'
import { applyPhoneInput } from '../../lib/phoneFormat'
import {
  PATIENT_SUGGESTION_LIMIT,
  patientMatchesSearch,
} from '../../lib/patientSearch'
import type { Locale } from '../../constants'
import { lookupPatients } from '../../api/patients'
import { getProfile } from '../../api/profile'
import { createAppointment, listAppointments } from '../../api/appointments'
import {
  addDays,
  formatDayMonth,
  formatTime,
  fromLocalDateKey,
  isSameDay,
  toLocalDateKey,
} from '../../lib/format'
import {
  inputMetrics,
  radius,
  shadows,
  spacing,
  typography,
  font,
} from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import type { ApiAppointment, ApiPatient, ApiPatientLookup } from '../../types'

interface Props {
  visible: boolean
  onClose: () => void
  defaultDate?: Date
  // When provided, the sheet opens with this patient pre-selected — set by
  // PatientDetailScreen so scheduling from a patient skips the search step.
  defaultPatient?: ApiPatient | null
  // Receives the freshly-created appointment so the caller can react with
  // context (e.g. jump the AppointmentsScreen to its date). Optional to
  // preserve backward compatibility for callers that don't care.
  onCreated?: (created: ApiAppointment) => void
}

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120]
const WORK_START = 9 * 60
const WORK_END = 20 * 60
const SLOT_STEP = 30

const PHONE_RE = /^\+\d{9,15}$/

export default function AppointmentCreateSheet({
  visible,
  onClose,
  defaultDate,
  defaultPatient,
  onCreated,
}: Props) {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const toast = useToast()

  const [patient, setPatient] = useState<ApiPatient | ApiPatientLookup | null>(null)
  const [bookingFor, setBookingFor] = useState<'patient' | 'guest'>('patient')
  const [search, setSearch] = useState('')
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [date, setDate] = useState<Date>(() => resolveBookableDate(defaultDate))
  const [time, setTime] = useState<string>('09:00')
  const [duration, setDuration] = useState<number>(30)
  const [reason, setReason] = useState('')
  // Keep the primary form compact: date, time, and duration choices open in
  // focused overlays instead of permanently occupying vertical space.
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [timePickerOpen, setTimePickerOpen] = useState(false)
  const [durationPickerOpen, setDurationPickerOpen] = useState(false)
  const [clock, setClock] = useState(() => new Date())

  // Clinic working hours come from the dentist's profile settings. Fall back
  // to the default 08:00–20:00 window until the profile loads (or if unset).
  const profileQuery = useQuery({
    queryKey: ['settings', 'profile'],
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
      setPatient(defaultPatient ?? null)
      setBookingFor('patient')
      setSearch('')
      setGuestName('')
      setGuestPhone('')
      setDate(resolveBookableDate(defaultDate))
      setTime('09:00')
      setDuration(30)
      setReason('')
      setCalendarOpen(false)
      setTimePickerOpen(false)
      setDurationPickerOpen(false)
    } else {
      setCalendarOpen(false)
      setTimePickerOpen(false)
      setDurationPickerOpen(false)
    }
  }, [visible, defaultDate, defaultPatient])

  useEffect(() => {
    if (!visible) return
    const refreshClock = () => setClock(new Date())
    refreshClock()
    const timer = setInterval(refreshClock, 30_000)
    return () => clearInterval(timer)
  }, [visible])

  // Preload a bounded compact directory so the first keystroke can filter
  // immediately; the debounced request then refreshes it with global matches.
  const trimmedSearch = search.trim()
  const debouncedSearch = useDebouncedValue(trimmedSearch, 300)
  const patientsQuery = useQuery({
    queryKey: ['patients', 'lookup', debouncedSearch],
    queryFn: ({ signal }) =>
      lookupPatients(
        {
          search: debouncedSearch || undefined,
          page: 1,
          // Keep the bounded preload for immediate first-keystroke filtering;
          // server-side searches only need the visible suggestion count.
          per_page: debouncedSearch ? PATIENT_SUGGESTION_LIMIT : 20,
        },
        { signal }
      ),
    enabled: visible && bookingFor === 'patient' && !patient,
    retry: false,
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
  })
  const patientResults = useMemo(
    () =>
      trimmedSearch.length > 0
        ? (patientsQuery.data?.data ?? [])
            .filter((candidate) => patientMatchesSearch(candidate, trimmedSearch))
            .slice(0, PATIENT_SUGGESTION_LIMIT)
        : [],
    [patientsQuery.data, trimmedSearch]
  )

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

  const today = useMemo(() => {
    const current = new Date(clock)
    current.setHours(0, 0, 0, 0)
    return current
  }, [clock])
  const currentTimeKey =
    clock.getHours() * 3600 + clock.getMinutes() * 60 + clock.getSeconds()

  // Auto-select first free slot whenever date / duration / appointments change,
  // unless the user has already picked a slot that's still valid.
  useEffect(() => {
    if (!visible) return
    const isToday = isSameDay(date, today)
    const stillValid = isSlotValid(
      time,
      duration,
      activeAppts,
      isToday ? clock : null,
      workStart,
      workEnd
    )
    if (stillValid) return
    const next = findFirstFreeSlot(activeAppts, duration, isToday ? clock : null, workStart, workEnd)
    if (next) setTime(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    visible,
    dateKey,
    duration,
    dayQuery.dataUpdatedAt,
    workStart,
    workEnd,
    currentTimeKey,
  ])

  const create = useMutation({
    mutationFn: () =>
      createAppointment({
        patient_id: bookingFor === 'patient' ? patient!.id : null,
        patient_name: bookingFor === 'patient' ? patient!.full_name : guestName.trim(),
        guest_name: bookingFor === 'guest' ? guestName.trim() : undefined,
        guest_phone:
          bookingFor === 'guest' ? applyPhoneInput(guestPhone).raw : undefined,
        appointment_date: dateKey,
        start_time: time,
        end_time: minToTime(toMin(time) + duration),
        status: 'scheduled',
        notes: reason.trim() || null,
      }),
    onSuccess: (created) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      toast.success(t('appointments.create.created'))
      onCreated?.(created)
      onClose()
    },
    onError: (err) => {
      if (isOfflineError(err)) return
      if (isApiError(err) && err.kind === 'validation') {
        const firstMessage = Object.values(err.fieldErrors ?? {}).flat()[0] ?? err.message
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        toast.error(firstMessage)
        dayQuery.refetch()
        return
      }
      toast.error(t('appointments.create.failed'))
    },
  })

  const isToday = isSameDay(date, today)
  const slotValid = isSlotValid(
    time,
    duration,
    activeAppts,
    isToday ? clock : null,
    workStart,
    workEnd
  )
  const scheduleError = profileQuery.isError || dayQuery.isError
  const scheduleReady =
    Boolean(profileQuery.data) &&
    Boolean(dayQuery.data) &&
    !profileQuery.isFetching &&
    !dayQuery.isFetching &&
    !scheduleError
  const guestValid =
    guestName.trim().length >= 3 && PHONE_RE.test(applyPhoneInput(guestPhone).raw)
  const identityValid = bookingFor === 'patient' ? Boolean(patient) : guestValid
  const canSubmit = identityValid && slotValid && scheduleReady

  const handleSubmit = () => {
    if (!canSubmit) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      return
    }
    create.mutate()
  }

  const slots = useMemo(() => generateTimeSlots(workStart, workEnd), [workStart, workEnd])

  const availableSlots = useMemo(
    () =>
      slots.filter(
        (slot) =>
          findBlocker(
            slot,
            duration,
            activeAppts,
            isToday ? clock : null,
            workStart,
            workEnd
          ) === null
      ),
    [slots, duration, activeAppts, isToday, clock, workStart, workEnd]
  )

  const quickReasons = useMemo(
    () => getTranslationArray<string>(locale as Locale, 'appointments.create.quickReasons'),
    [locale]
  )

  const onSelectTime = (slot: string) => {
    Haptics.selectionAsync()
    setTime(slot)
    setTimePickerOpen(false)
  }

  const submitTitle = create.isPending
    ? t('appointments.create.creating')
    : scheduleError
      ? t('appointments.loadFailed')
      : !scheduleReady
        ? t('common.loading')
        : !identityValid
          ? t('appointments.create.pickPatientFirst')
          : !slotValid
            ? t('appointments.create.pickTime')
            : t('appointments.create.create')

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('appointments.create.title')}
      closeAccessibilityLabel={t('common.close')}
      footer={
        <Button
          title={submitTitle}
          loading={create.isPending}
          disabled={!canSubmit}
          onPress={handleSubmit}
          fullWidth
          size="md"
        />
      }
    >
      {/* Patient */}
      <View style={[styles.field, styles.patientField]}>
        <View style={styles.patientModeRow}>
          <FieldLabel>{t('appointments.create.selectPatient')}</FieldLabel>
          <View style={styles.bookingModeControl}>
            <SegmentedControl<'patient' | 'guest'>
              options={[
                { value: 'patient', label: t('appointments.create.registeredPatient') },
                { value: 'guest', label: t('appointments.create.guest') },
              ]}
              value={bookingFor}
              onChange={(value) => {
                Haptics.selectionAsync()
                setBookingFor(value)
              }}
            />
          </View>
        </View>
        {bookingFor === 'guest' ? (
          <View style={styles.guestFields}>
            <InputCard
              iconName="person-outline"
              value={guestName}
              onChangeText={setGuestName}
              placeholder={t('appointments.create.guestName')}
              autoCapitalize="words"
              maxLength={255}
            />
            <InputCard
              iconName="call-outline"
              value={guestPhone}
              onChangeText={(value) => setGuestPhone(applyPhoneInput(value).display)}
              placeholder={t('patients.form.phonePlaceholder')}
              keyboardType="phone-pad"
            />
          </View>
        ) : patient ? (
          <View style={styles.selectedPatient}>
            <PatientAvatar
              name={patient.full_name}
              uri={patient.photo_thumbnail_url ?? patient.photo_url}
              size={28}
            />
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
              accessibilityRole="button"
              accessibilityLabel={t('appointments.create.changePatient')}
            >
              <Icon name="swap-horizontal-outline" size={17} color={c.brand as string} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.patientSearchArea}>
            <InputCard
              iconName="search-outline"
              value={search}
              onChangeText={setSearch}
              placeholder={t('appointments.create.searchPlaceholder')}
              autoCapitalize="words"
              autoCorrect={false}
              accessibilityLabel={t('appointments.create.searchPlaceholder')}
              containerStyle={styles.patientSearchInputCard}
              style={styles.patientSearchInput}
            />
            {trimmedSearch.length > 0 &&
            (patientsQuery.isError ||
              patientResults.length > 0 ||
              patientsQuery.isFetching) ? (
              <View
                testID="appointment-patient-search-results"
                style={styles.patientSearchDropdown}
              >
                {patientsQuery.isError ? (
                  <View style={styles.patientSearchError}>
                    <Text style={styles.patientSearchErrorText}>{t('patients.loadFailed')}</Text>
                    <Pressable accessibilityRole="button" onPress={() => patientsQuery.refetch()}>
                      <Text style={styles.retryText}>{t('common.retry')}</Text>
                    </Pressable>
                  </View>
                ) : patientResults.length > 0 ? (
                  <View style={styles.patientList}>
                    {patientResults.map((p, i) => (
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
                          accessibilityRole="button"
                          accessibilityLabel={
                            p.phone ? `${p.full_name}, ${p.phone}` : p.full_name
                          }
                        >
                          <PatientAvatar
                            name={p.full_name}
                            uri={p.photo_thumbnail_url ?? p.photo_url}
                            size={34}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.patientRowName} numberOfLines={1}>
                              {p.full_name}
                            </Text>
                            <Text style={styles.patientRowPhone} numberOfLines={1}>
                              {p.phone}
                            </Text>
                          </View>
                        </Pressable>
                        {i < patientResults.length - 1 ? (
                          <View style={styles.patientSep} />
                        ) : null}
                      </React.Fragment>
                    ))}
                  </View>
                ) : (
                  <Text
                    style={styles.patientSearchLoading}
                    accessibilityLiveRegion="polite"
                    accessibilityRole="text"
                  >
                    {t('common.loading')}
                  </Text>
                )}
              </View>
            ) : null}
          </View>
        )}
      </View>

      {/* The three scheduling choices remain visible, but their option lists
          only occupy space while the user is actively choosing one. */}
      <View style={[styles.field, styles.scheduleField]}>
        <View style={styles.scheduleRow}>
          <Pressable
            testID="appointment-date-selector"
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
              testID="appointment-date-selector-value"
              style={styles.scheduleControlValue}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              {isToday ? t('appointments.todayLabel') : formatDayMonth(date, locale)}
            </Text>
          </Pressable>

          <Pressable
            testID="appointment-time-selector"
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
            <Text
              testID="appointment-time-selector-label"
              style={styles.scheduleControlLabel}
            >
              {t('appointments.create.time')}
            </Text>
            {!scheduleReady && !scheduleError ? (
              <ActivityIndicator
                testID="appointment-schedule-loading"
                size="small"
                color={c.brand as string}
              />
            ) : (
              <Text
                testID="appointment-time-selector-value"
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
            testID="appointment-duration-selector"
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
            <Text
              testID="appointment-duration-selector-value"
              style={styles.scheduleControlValue}
              numberOfLines={1}
            >
              {t('appointments.durationShort', { n: duration })}
            </Text>
          </Pressable>
        </View>

        {scheduleError ? (
          <View style={styles.allBusyHint}>
            <Icon name="cloud-offline-outline" size={14} color={c.danger as string} />
            <Text style={styles.allBusyText}>{t('appointments.loadFailed')}</Text>
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
        <InputCard
          value={reason}
          onChangeText={setReason}
          placeholder={t('appointments.create.reasonPlaceholder')}
          maxLength={255}
          returnKeyType="done"
          accessibilityLabel={t('appointments.create.reason')}
        />
        <ScrollView
          testID="appointment-reason-strip"
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.reasonChipsRow}
        >
          {quickReasons.map((quickReason) => {
            const active = quickReason === reason
            return (
              <Pressable
                key={quickReason}
                onPress={() => {
                  Haptics.selectionAsync()
                  setReason(active ? '' : quickReason)
                }}
                style={[styles.reasonChip, active && styles.reasonChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={quickReason}
              >
                <Text
                  style={[
                    styles.reasonChipText,
                    active && styles.reasonChipTextActive,
                  ]}
                >
                  {quickReason}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>
      </View>

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
                testID={`appointment-duration-option-${option}`}
                onPress={() => {
                  Haptics.selectionAsync()
                  setDuration(option)
                  setDurationPickerOpen(false)
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.timeOption,
                  selected && styles.timeOptionSelected,
                ]}
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
                testID={`appointment-time-option-${slot}`}
                onPress={() => onSelectTime(slot)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.timeOption,
                  selected && styles.timeOptionSelected,
                ]}
              >
                <Text
                  style={[
                    styles.timeOptionText,
                    selected && styles.timeOptionTextSelected,
                  ]}
                >
                  {formatTime(slot)}
                </Text>
                {selected ? (
                  <Icon name="checkmark" size={16} color="#FFFFFF" />
                ) : null}
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

// Returns null if slot is free, otherwise:
// - 'past' if the slot start is before now
// - 'overflow' if the slot+duration exceeds work end
// - the conflicting appointment if it overlaps with an active booking
function findBlocker(
  slot: string,
  duration: number,
  appts: ApiAppointment[],
  now: Date | null,
  workStart: number = WORK_START,
  workEnd: number = WORK_END
): null | 'past' | 'overflow' | ApiAppointment {
  const start = toMin(slot)
  const end = start + duration
  if (now) {
    // Backend compares the full timestamp. Once any second of the displayed
    // minute has elapsed, that minute's slot is already in the past.
    const nowMin = toBookingMinute(now)
    if (start < nowMin) return 'past'
  }
  if (start < workStart || end > workEnd) return 'overflow'
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
  workStart: number = WORK_START,
  workEnd: number = WORK_END
): boolean {
  return findBlocker(slot, duration, appts, now, workStart, workEnd) === null
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
    const nowMin = toBookingMinute(now)
    start = Math.max(workStart, Math.ceil(nowMin / SLOT_STEP) * SLOT_STEP)
  }
  for (let m = start; m + duration <= workEnd; m += SLOT_STEP) {
    const slot = minToTime(m)
    if (isSlotValid(slot, duration, appts, now, workStart, workEnd)) return slot
  }
  return null
}

function toBookingMinute(now: Date): number {
  return (
    now.getHours() * 60 +
    now.getMinutes() +
    (now.getSeconds() > 0 || now.getMilliseconds() > 0 ? 1 : 0)
  )
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

function resolveBookableDate(candidate?: Date): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (!candidate) return today

  const normalized = new Date(candidate)
  normalized.setHours(0, 0, 0, 0)
  return normalized.getTime() >= today.getTime() ? normalized : today
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    field: { gap: 8 },
    patientField: { zIndex: 30 },
    guestFields: { gap: spacing.sm },
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
    patientModeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    bookingModeControl: {
      flex: 1,
      maxWidth: 238,
    },
    patientSearchArea: {
      position: 'relative',
      zIndex: 31,
    },
    patientSearchDropdown: {
      position: 'absolute',
      top: 52,
      left: 0,
      right: 0,
      zIndex: 32,
      overflow: 'hidden',
      backgroundColor: c.background,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.separator as string,
      ...shadows.md,
      elevation: 12,
    },
    selectedPatient: {
      minHeight: inputMetrics.height,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 8,
      paddingVertical: 6,
      backgroundColor: c.brandSurface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.brandSoft,
      borderRadius: radius.lg,
    },
    selectedName: {
      fontFamily: font('700'),
      fontSize: 13,
      lineHeight: 16,
      fontWeight: '700',
      color: c.brandDeep,
    },
    selectedPhone: {
      fontFamily: font('500'),
      fontSize: 10,
      lineHeight: 12,
      fontWeight: '500',
      color: c.labelSecondary,
    },
    changeBtn: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.background,
      borderRadius: radius.pill,
    },
    patientList: {
      overflow: 'hidden',
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
    patientSearchError: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    patientSearchErrorText: {
      ...typography.footnote,
      color: c.danger,
      flex: 1,
    },
    patientSearchLoading: {
      ...typography.footnote,
      color: c.labelTertiary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    patientSearchInputCard: {
      minHeight: inputMetrics.height,
      paddingHorizontal: inputMetrics.paddingHorizontal,
      borderRadius: radius.lg,
    },
    patientSearchInput: {
      fontSize: inputMetrics.fontSize,
      lineHeight: inputMetrics.lineHeight,
      paddingVertical: 10,
    },

    // Date
    scheduleField: {
      gap: 6,
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
    // Time and duration option overlays
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
    timeOptionTextSelected: { color: '#FFFFFF' },
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
    retryText: {
      fontFamily: font('700'),
      fontSize: 12,
      fontWeight: '700',
      color: c.brand,
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
    reasonChipsRow: {
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 1,
      paddingVertical: 1,
    },
    reasonChip: {
      minHeight: 30,
      justifyContent: 'center',
      paddingHorizontal: 11,
      paddingVertical: 5,
      borderRadius: radius.pill,
      backgroundColor: c.fillQuaternary,
    },
    reasonChipActive: { backgroundColor: c.brandLight },
    reasonChipText: {
      fontFamily: font('500'),
      fontSize: 12,
      fontWeight: '500',
      color: c.labelSecondary,
    },
    reasonChipTextActive: {
      fontFamily: font('700'),
      fontWeight: '700',
      color: c.brand,
    },
  })
}
