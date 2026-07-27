import React, { useState, useMemo, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  RefreshControl,
  StatusBar,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as Haptics from 'expo-haptics'

import WeekStrip from '../../components/appointments/WeekStrip'
import WeekGridView, {
  PLANNER_COLUMN_GAP,
  PLANNER_GRID_SIDE_INSET,
  PLANNER_ROW_GAP,
} from '../../components/appointments/WeekGridView'
import {
  PLANNER_APPOINTMENT_ROW_HEIGHT,
  PLANNER_CARD_HEIGHT,
  PLANNER_DATE_RAIL_HEIGHT,
  PLANNER_DATE_RAIL_WIDTH,
  PLANNER_PAPER_LINE_COUNT,
} from '../../components/appointments/DayMiniCard'
import AppointmentTimelineCard from '../../components/appointments/AppointmentTimelineCard'
import NowLine from '../../components/appointments/NowLine'
import AppointmentDetailSheet from '../../components/appointments/AppointmentDetailSheet'
import AppointmentEditSheet from '../../components/appointments/AppointmentEditSheet'
import SwipeableWeek from '../../components/appointments/SwipeableWeek'
import FadeSwitch from '../../components/ui/FadeSwitch'
import { findConflictingIds } from '../../lib/appointmentConflicts'
import { exportAppointmentsPdf } from '../../lib/appointmentExport'
import EmptyState from '../../components/ui/EmptyState'
import Icon from '../../components/ui/Icon'
import Skeleton from '../../components/ui/Skeleton'
import Button from '../../components/ui/Button'
import CompactIconButton from '../../components/ui/CompactIconButton'
import SearchBar from '../../components/ui/SearchBar'
import OverflowMenuButton from '../../components/ui/OverflowMenuButton'
import { useToast } from '../../components/ui/Toast'
import { useDialog } from '../../components/ui/Dialog'
import AppHeader, { HeaderIconButton } from '../../components/navigation/AppHeader'
import ProfileAvatarButton from '../../components/navigation/ProfileAvatarButton'
import PatientSuggestionsPanel from '../../components/patients/PatientSuggestionsPanel'

import { useI18n } from '../../i18n'
import { useAuthStore } from '../../stores/auth'
import { useUIStore } from '../../stores/ui'
import { useThemeStore } from '../../stores/theme'
import { canExportData, canManage, canView } from '../../lib/permissions'
import {
  createPatientCardFromGuest,
  listAppointments,
  updateAppointmentStatus,
  deleteAppointment,
} from '../../api/appointments'
import { listPatients } from '../../api/patients'
import type { ApiListResponse } from '../../types'
import {
  addDays,
  formatDayMonth,
  formatMonthYear,
  formatWeekdayLong,
  fromLocalDateKey,
  getWeekStart,
  isSameDay,
  toLocalDateKey,
} from '../../lib/format'
import { radius, shadows, spacing, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import type { ApiAppointment } from '../../types'
import type { MainStackParams, MainTabParams } from '../../navigation'
import { useDebouncedValue } from '../../lib/useDebouncedValue'
import {
  PATIENT_SUGGESTION_LIMIT,
  patientMatchesSearch,
} from '../../lib/patientSearch'
import { useManualRefresh } from '../../lib/useManualRefresh'

type ViewMode = 'day' | 'week'
type Navigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParams, 'Dashboard'>,
  NativeStackNavigationProp<MainStackParams>
>

export default function AppointmentsScreen() {
  const { t, locale } = useI18n()
  const c = useColors()
  const { width: viewportWidth } = useWindowDimensions()
  const styles = useMemo(() => makeStyles(c), [c])
  const effective = useThemeStore((s) => s.effective)
  const user = useAuthStore((s) => s.user)
  const toast = useToast()
  const { actionSheet } = useDialog()
  const queryClient = useQueryClient()
  const navigation = useNavigation<Navigation>()

  const canViewAppointments = canView(user, 'appointments')
  const canViewPatients = canView(user, 'patients')
  const canManageAppointments = canManage(user, 'appointments')
  const canCreatePatientCards = canManageAppointments && canManage(user, 'patients')
  // Client-generated PDFs cannot rely on a server route to enforce the plan,
  // so fail closed when the subscription summary has no explicit grant.
  const canExportAppointments = canExportData(user)

  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [selectedAppointment, setSelectedAppointment] = useState<ApiAppointment | null>(null)
  const [detailVisible, setDetailVisible] = useState(false)
  const [editAppointment, setEditAppointment] = useState<ApiAppointment | null>(null)
  const [editVisible, setEditVisible] = useState(false)
  const [clock, setClock] = useState(() => new Date())
  const [isExporting, setIsExporting] = useState(false)
  const [plannerSearchOpen, setPlannerSearchOpen] = useState(false)
  const [plannerSearch, setPlannerSearch] = useState('')
  const [plannerSuggestionsHidden, setPlannerSuggestionsHidden] = useState(false)
  const debouncedPatientSearch = useDebouncedValue(plannerSearch.trim(), 250)

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(
    () =>
      navigation.addListener('tabPress', () => {
        const currentDate = new Date()
        currentDate.setHours(0, 0, 0, 0)
        setSelectedDate(currentDate)
        setViewMode('week')
        setPlannerSearch('')
        setPlannerSearchOpen(false)
        setPlannerSuggestionsHidden(false)
      }),
    [navigation]
  )

  // Pull pending-view-date requests from the UI store. The create-flow sets
  // this when a new appointment lands on a date outside the currently visible
  // week — we jump to it here so the user always sees what they just created.
  const pendingViewDate = useUIStore((s) => s.pendingAppointmentsViewDate)
  const pendingViewAppointmentId = useUIStore((s) => s.pendingAppointmentsViewId)
  const clearViewDateRequest = useUIStore((s) => s.clearAppointmentsViewDate)
  const clearViewRequest = useUIStore((s) => s.clearAppointmentsViewRequest)

  useEffect(() => {
    if (!pendingViewDate) return
    const target = fromLocalDateKey(pendingViewDate)
    target.setHours(0, 0, 0, 0)
    setSelectedDate(target)
    setViewMode('day')
    if (!pendingViewAppointmentId) clearViewDateRequest()
  }, [pendingViewDate, pendingViewAppointmentId, clearViewDateRequest])

  const weekStart = useMemo(() => getWeekStart(selectedDate), [selectedDate])
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart])

  const weekQuery = useQuery({
    queryKey: ['appointments', 'week', toLocalDateKey(weekStart), toLocalDateKey(weekEnd)],
    queryFn: () =>
      listAppointments({
        start_date: toLocalDateKey(weekStart),
        end_date: toLocalDateKey(weekEnd),
      }),
    enabled: canViewAppointments,
    staleTime: 30_000,
  })
  const {
    isRefreshing,
    onRefresh,
  } = useManualRefresh(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    return weekQuery.refetch()
  })

  const allAppointments = weekQuery.data?.data ?? []
  const isLoading = weekQuery.isLoading && !weekQuery.data
  const isWeekUpdating =
    weekQuery.isFetching &&
    !weekQuery.isLoading &&
    !isRefreshing
  const isShowingRecentPatients = debouncedPatientSearch.length === 0

  const patientSearchQuery = useQuery({
    queryKey: [
      'patients',
      'planner-search',
      isShowingRecentPatients ? 'recently-updated' : 'search',
      debouncedPatientSearch,
    ],
    queryFn: ({ signal }) =>
      listPatients(
        {
          search: debouncedPatientSearch || undefined,
          sort: isShowingRecentPatients ? '-updated_at' : 'full_name',
          page: 1,
          per_page: PATIENT_SUGGESTION_LIMIT,
        },
        { signal }
      ),
    enabled: canViewPatients && plannerSearchOpen,
    retry: false,
    placeholderData: (previousData, previousQuery) => {
      const currentMode = isShowingRecentPatients ? 'recently-updated' : 'search'
      return previousQuery?.queryKey[2] === currentMode ? previousData : undefined
    },
    staleTime: 30_000,
  })
  const patientSearchResults = useMemo(() => {
    const candidates = patientSearchQuery.data?.data ?? []
    const matches =
      plannerSearch.trim().length === 0
        ? candidates
        : candidates.filter((candidate) =>
            patientMatchesSearch(candidate, plannerSearch)
          )
    return matches.slice(0, PATIENT_SUGGESTION_LIMIT)
  }, [patientSearchQuery.data, plannerSearch])
  // `/patients` is authorized by patients.view and already includes profile
  // photo variants. The compact lookup endpoint is reserved for appointment
  // and payment mutation selectors, whose permission contract is stricter.
  const displayedPatientSearchResults = patientSearchResults
  const isPatientSearchLoading =
    plannerSearchOpen &&
    patientSearchQuery.isFetching &&
    displayedPatientSearchResults.length === 0

  const selectedKey = toLocalDateKey(selectedDate)
  const dayAppointments = useMemo(
    () =>
      allAppointments
        .filter((a) => a.appointment_date === selectedKey)
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [allAppointments, selectedKey]
  )
  const dayConflictIds = useMemo(() => findConflictingIds(dayAppointments), [dayAppointments])

  useEffect(() => {
    if (!pendingViewAppointmentId || !pendingViewDate || selectedKey !== pendingViewDate) return

    const appointment = allAppointments.find((item) => item.id === pendingViewAppointmentId)
    if (appointment) {
      setSelectedAppointment(appointment)
      setDetailVisible(true)
      setViewMode('day')
      clearViewRequest()
      return
    }

    if (weekQuery.isSuccess && !weekQuery.isFetching) clearViewRequest()
  }, [
    allAppointments,
    clearViewRequest,
    pendingViewAppointmentId,
    pendingViewDate,
    selectedKey,
    weekQuery.isFetching,
    weekQuery.isSuccess,
  ])

  // Build day list with optional "now" marker inserted at the current time.
  type DayItem =
    | { type: 'now'; id: string }
    | { type: 'appointment'; id: string; data: ApiAppointment; isPast: boolean }

  const todayKey = toLocalDateKey(clock)
  const isOnTodayKey = selectedKey === todayKey
  const nowMinutes = clock.getHours() * 60 + clock.getMinutes()

  const dayItems = useMemo<DayItem[]>(() => {
    const items: DayItem[] = []
    let nowInserted = false
    for (const apt of dayAppointments) {
      const start = toMin(apt.start_time)
      if (isOnTodayKey && !nowInserted && start >= nowMinutes) {
        items.push({ type: 'now', id: '__now' })
        nowInserted = true
      }
      const isPast =
        isOnTodayKey && toMin(apt.end_time) < nowMinutes && apt.status === 'scheduled'
      items.push({ type: 'appointment', id: apt.id, data: apt, isPast })
    }
    if (isOnTodayKey && !nowInserted && dayAppointments.length > 0) {
      items.push({ type: 'now', id: '__now' })
    }
    return items
  }, [dayAppointments, isOnTodayKey, nowMinutes])

  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, ApiAppointment[]>()
    for (const a of allAppointments) {
      const existing = map.get(a.appointment_date) ?? []
      existing.push(a)
      map.set(a.appointment_date, existing)
    }
    return map
  }, [allAppointments])

  const busyDateKeys = useMemo(() => {
    const set = new Set<string>()
    for (const a of allAppointments) {
      if (a.status === 'scheduled' || a.status === 'completed') {
        set.add(a.appointment_date)
      }
    }
    return set
  }, [allAppointments])

  const navigateWeek = (delta: number) => {
    Haptics.selectionAsync()
    setSelectedDate((d) => addDays(d, delta * 7))
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const canCreateOnSelectedDate = selectedDate.getTime() >= today.getTime()
  const dayLabel = isSameDay(selectedDate, today)
    ? `${t('appointments.todayLabel')}, ${formatDayMonth(selectedDate, locale)}`
    : isSameDay(selectedDate, addDays(today, 1))
      ? `${t('appointments.tomorrowLabel')}, ${formatDayMonth(selectedDate, locale)}`
      : isSameDay(selectedDate, addDays(today, -1))
        ? `${t('appointments.yesterdayLabel')}, ${formatDayMonth(selectedDate, locale)}`
        : `${formatWeekdayLong(selectedDate, locale)}, ${formatDayMonth(selectedDate, locale)}`
  const onOpenAppointment = (id: string) => {
    const apt = allAppointments.find((a) => a.id === id)
    if (!apt) return
    Haptics.selectionAsync()
    setSelectedAppointment(apt)
    setDetailVisible(true)
  }

  // Optimistic status update: flip the appointment in every cached query
  // immediately so the UI reflects the change before the API call settles.
  // On failure we roll back by invalidating, which forces a refetch to the
  // server's truth.
  const onStatusChange = async (
    id: string,
    status: Exclude<ApiAppointment['status'], 'scheduled'>
  ): Promise<boolean> => {
    // A finalized appointment is immutable on the backend. Keep the same
    // rule in the UI before applying the optimistic cache update.
    let current: ApiAppointment | undefined
    for (const [, data] of queryClient.getQueriesData<ApiListResponse<ApiAppointment>>({
      queryKey: ['appointments'],
    })) {
      const found = data?.data?.find((a) => a.id === id)
      if (found) {
        current = found
        break
      }
    }
    if (current && current.status !== 'scheduled') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      toast.error(t('appointments.edit.finalized'))
      return false
    }

    await queryClient.cancelQueries({ queryKey: ['appointments'] })
    const snapshots = queryClient.getQueriesData<ApiListResponse<ApiAppointment>>({
      queryKey: ['appointments'],
    })
    queryClient.setQueriesData<ApiListResponse<ApiAppointment>>(
      { queryKey: ['appointments'] },
      (old) => {
        if (!old?.data) return old
        return {
          ...old,
          data: old.data.map((a) => (a.id === id ? { ...a, status } : a)),
        }
      }
    )
    try {
      await updateAppointmentStatus(id, status)
      toast.success(t('appointments.detail.statusUpdated'))
      return true
    } catch {
      for (const [key, data] of snapshots) queryClient.setQueryData(key, data)
      toast.error(t('appointments.edit.failed'))
      return false
    } finally {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    }
  }

  const onDeleteAppointment = async (id: string): Promise<boolean> => {
    await queryClient.cancelQueries({ queryKey: ['appointments'] })
    const snapshots = queryClient.getQueriesData<ApiListResponse<ApiAppointment>>({
      queryKey: ['appointments'],
    })
    // Optimistic remove from every cached list, then always reconcile with the
    // server so an older in-flight response cannot resurrect the record.
    queryClient.setQueriesData<ApiListResponse<ApiAppointment>>(
      { queryKey: ['appointments'] },
      (old) => {
        if (!old?.data) return old
        return { ...old, data: old.data.filter((a) => a.id !== id) }
      }
    )
    try {
      await deleteAppointment(id)
        toast.info(t('appointments.detail.deleted'))
      return true
    } catch {
      for (const [key, data] of snapshots) queryClient.setQueryData(key, data)
      toast.error(t('appointments.edit.failed'))
      return false
    } finally {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    }
  }

  const onCreatePatientCard = async (appointment: ApiAppointment): Promise<boolean> => {
    try {
      await queryClient.cancelQueries({ queryKey: ['appointments'] })
      const result = await createPatientCardFromGuest(appointment)
      queryClient.setQueriesData<ApiListResponse<ApiAppointment>>(
        { queryKey: ['appointments'] },
        (old) =>
          old?.data
            ? {
                ...old,
                data: old.data.map((item) =>
                  item.id === appointment.id ? result.appointment : item
                ),
              }
            : old
      )
      setSelectedAppointment(result.appointment)
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast.success(t('appointments.detail.patientCardCreated'))
      return true
    } catch {
      toast.error(t('appointments.detail.patientCardFailed'))
      return false
    }
  }

  const handleExport = async () => {
    const visibleAppointments = viewMode === 'day' ? dayAppointments : allAppointments
    if (!canExportAppointments || visibleAppointments.length === 0 || isExporting) return
    setIsExporting(true)
    try {
      await exportAppointmentsPdf(visibleAppointments, locale, {
        title: t('appointments.title'),
        generatedAt: t('patients.export.generatedAt'),
        loadedCount: t('patients.export.loadedCount'),
        dateTime: t('appointments.detail.dateTime'),
        patient: t('appointments.detail.patient'),
        reason: t('appointments.detail.reason'),
        status: t('appointments.detail.statusLabel'),
        empty: t('patients.export.empty'),
        shareTitle: t('appointments.export.shareTitle'),
        statuses: {
          scheduled: t('appointments.status.scheduled'),
          completed: t('appointments.status.completed'),
          cancelled: t('appointments.status.cancelled'),
          no_show: t('appointments.status.no_show'),
        },
      })
      toast.success(t('appointments.export.ready'))
    } catch {
      toast.error(t('appointments.export.failed'))
    } finally {
      setIsExporting(false)
    }
  }

  const openPlannerMore = async () => {
    const visibleAppointmentCount =
      viewMode === 'day' ? dayAppointments.length : allAppointments.length
    const options = [
      {
        key: 'view',
        label:
          viewMode === 'week'
            ? t('appointments.viewDay')
            : t('appointments.viewWeek'),
        icon: viewMode === 'week' ? ('list-outline' as const) : ('grid-outline' as const),
      },
      {
        key: 'export',
        label: t('appointments.export.action'),
        icon: 'download-outline' as const,
        disabled:
          !canExportAppointments || visibleAppointmentCount === 0 || isExporting,
      },
    ]
    const selected = await actionSheet({
      title: t('appointments.planner.moreActions'),
      options,
      layout: 'grid',
      cancelLabel: t('common.close'),
    })
    if (selected < 0) return
    const action = options[selected]?.key
    if (action === 'view') {
      setViewMode((mode) => (mode === 'week' ? 'day' : 'week'))
    } else if (action === 'export') {
      handleExport()
    }
  }

  const gradientColors: [string, string, string] =
    effective === 'dark'
      ? [c.background, c.background, c.background]
      : [c.brandSurface, '#FFFFFF', '#FFFFFF']

  const closePlannerSearch = () => {
    setPlannerSearch('')
    setPlannerSearchOpen(false)
    setPlannerSuggestionsHidden(false)
  }

  const togglePlannerSearch = () => {
    if (plannerSearchOpen) closePlannerSearch()
    else {
      setPlannerSuggestionsHidden(false)
      setPlannerSearchOpen(true)
    }
  }

  const updatePlannerSearch = (value: string) => {
    setPlannerSearch(value)
    setPlannerSuggestionsHidden(false)
  }

  const clearPlannerSuggestions = () => {
    setPlannerSearch('')
    setPlannerSuggestionsHidden(true)
  }

  const openPatientFromSearch = (id: string) => {
    Haptics.selectionAsync()
    closePlannerSearch()
    navigation.navigate('PatientDetail', { id })
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={gradientColors}
        locations={[0, 0.2, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <StatusBar barStyle={effective === 'dark' ? 'light-content' : 'dark-content'} />

        <AppHeader
          style={viewMode === 'day' ? styles.dayModeHeader : undefined}
          title={
            viewMode === 'week'
              ? t('appointments.planner.title')
              : t('appointments.title')
          }
          supportingContent={
            <View style={styles.compactWeekChanger}>
              <Pressable
                onPress={() => navigateWeek(-1)}
                hitSlop={11}
                style={({ pressed }) => [
                  styles.compactWeekButton,
                  pressed && styles.compactWeekButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('common.back')}
              >
                <Icon name="chevron-back" size={13} color={c.brand as string} />
              </Pressable>
              <Text style={styles.compactWeekLabel} numberOfLines={1}>
                {formatMonthYear(selectedDate, locale)}
              </Text>
              {isWeekUpdating ? (
                <ActivityIndicator
                  size="small"
                  color={c.brand as string}
                  style={styles.compactWeekLoading}
                  accessibilityLabel={t('common.loading')}
                />
              ) : null}
              <Pressable
                onPress={() => navigateWeek(1)}
                hitSlop={11}
                style={({ pressed }) => [
                  styles.compactWeekButton,
                  pressed && styles.compactWeekButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('common.next')}
              >
                <Icon name="chevron-forward" size={13} color={c.brand as string} />
              </Pressable>
            </View>
          }
          leading={<ProfileAvatarButton />}
          actions={
            <>
              {viewportWidth >= 390 ? (
                <HeaderIconButton
                  icon="calendar-outline"
                  label={
                    viewMode === 'week'
                      ? t('appointments.viewDay')
                      : t('appointments.viewWeek')
                  }
                  onPress={() =>
                    setViewMode((mode) => (mode === 'week' ? 'day' : 'week'))
                  }
                  variant="surface"
                  shape="rounded"
                />
              ) : null}
              <CompactIconButton
                icon="search-outline"
                label={t('appointments.planner.search')}
                onPress={togglePlannerSearch}
                variant={plannerSearchOpen ? 'brand' : 'neutral'}
                size="md"
                disabled={!canViewPatients}
              />
              <OverflowMenuButton
                label={t('appointments.planner.moreActions')}
                onPress={openPlannerMore}
                size="md"
              />
            </>
          }
        />

        {plannerSearchOpen ? (
          <View style={styles.plannerSearch}>
            <View style={styles.patientSearchInput}>
              <SearchBar
                value={plannerSearch}
                onChangeText={updatePlannerSearch}
                placeholder={t('appointments.planner.searchPlaceholder')}
                loading={isPatientSearchLoading}
                autoFocus
                autoCapitalize="words"
                accessibilityLabel={t('appointments.planner.search')}
                loadingAccessibilityLabel={t('common.loading')}
                clearAccessibilityLabel={t('common.clear')}
              />
            </View>
            {!plannerSuggestionsHidden &&
            (patientSearchQuery.isError || patientSearchResults.length > 0) ? (
              <View
                testID="planner-patient-search-results"
                style={styles.patientSearchResults}
              >
                {patientSearchQuery.isError ? (
                  <View style={styles.patientSearchErrorPanel}>
                    <View style={styles.patientSearchMessageRow}>
                      <Text style={styles.patientSearchMessage}>{t('patients.loadFailed')}</Text>
                      <Pressable
                        onPress={() => patientSearchQuery.refetch()}
                        accessibilityRole="button"
                      >
                        <Text style={styles.patientSearchRetry}>{t('common.retry')}</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <PatientSuggestionsPanel
                    patients={displayedPatientSearchResults}
                    title={
                      isShowingRecentPatients
                        ? t('patients.sort.recentlyUpdated')
                        : t('appointments.planner.search')
                    }
                    titleIcon={isShowingRecentPatients ? 'time-outline' : 'search-outline'}
                    onSelect={(patient) => openPatientFromSearch(patient.id)}
                    onClear={clearPlannerSuggestions}
                    onDismiss={closePlannerSearch}
                  />
                )}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Week strip — only visible in day mode (week mode has its own grid) */}
        {canViewAppointments && viewMode === 'day' ? (
          <WeekStrip
            selectedDate={selectedDate}
            onSelect={setSelectedDate}
            busyDateKeys={busyDateKeys}
          />
        ) : null}

        {/* Day label — only in day mode */}
        {canViewAppointments && viewMode === 'day' ? (
          <View style={styles.dayHeader}>
            <Text style={styles.dayLabel} numberOfLines={1}>{dayLabel}</Text>
            {dayAppointments.length > 0 ? (
              <Text style={styles.dayCount} numberOfLines={1}>
                {dayAppointments.length} {t('appointments.title').toLowerCase()}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Content with cross-fade + swipe-to-navigate-weeks */}
        <SwipeableWeek
          onSwipeLeft={() => navigateWeek(1)}
          onSwipeRight={() => navigateWeek(-1)}
        >
        <FadeSwitch
          watch={
            viewMode === 'day'
              ? `day|${selectedKey}`
              : `week|${toLocalDateKey(weekStart)}`
          }
        >
        {!canViewAppointments ? (
          <View style={styles.center}>
            <EmptyState
              iconName="lock-closed-outline"
              title={t('dashboard.noAccess')}
              tone="warning"
            />
          </View>
        ) : weekQuery.isError && !weekQuery.data ? (
          <View style={styles.center}>
            <EmptyState
              iconName="cloud-offline-outline"
              title={t('appointments.loadFailed')}
              tone="danger"
              action={
                <Button
                  title={t('common.retry')}
                  variant="secondary"
                  size="md"
                  onPress={() => weekQuery.refetch()}
                />
              }
            />
          </View>
        ) : isLoading ? (
          viewMode === 'week' ? (
            <View style={styles.weekSkeleton}>
              {Array.from({ length: 4 }).map((_, row) => (
                <View key={row} style={styles.weekSkeletonRow}>
                  <WeekCardSkeleton styles={styles} side="left" />
                  {row === 3 ? (
                    <View style={styles.weekSkeletonEmptyCell} />
                  ) : (
                    <WeekCardSkeleton styles={styles} side="right" />
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.daySkeleton}>
              {Array.from({ length: 6 }).map((_, i) => (
                <View key={i} style={styles.dayCardSkeleton}>
                  <Skeleton width={48} height={48} borderRadius={12} />
                  <View style={{ flex: 1, gap: 8 }}>
                    <Skeleton width="55%" height={14} />
                    <Skeleton width="40%" height={12} />
                  </View>
                  <Skeleton width={60} height={20} borderRadius={10} />
                </View>
              ))}
            </View>
          )
        ) : viewMode === 'day' ? (
          dayAppointments.length === 0 ? (
            <View style={styles.center}>
              <EmptyState
                iconName="calendar-outline"
                title={t('appointments.noAppointmentsDay')}
                subtitle={t('appointments.noAppointmentsDaySub')}
                action={
                  canManageAppointments && canCreateOnSelectedDate ? (
                    <Button
                      title={t('create.newAppointment')}
                      size="md"
                      onPress={() =>
                        useUIStore.getState().openCreateAppointment({ date: selectedKey })
                      }
                    />
                  ) : undefined
                }
              />
            </View>
          ) : (
            <FlatList
              data={dayItems}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) =>
                item.type === 'now' ? (
                  <NowLine />
                ) : (
                  <AppointmentTimelineCard
                    appointment={item.data}
                    onPress={() => onOpenAppointment(item.data.id)}
                    hasConflict={dayConflictIds.has(item.data.id)}
                  />
                )
              }
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={onRefresh}
                  tintColor={c.brand as string}
                />
              }
            />
          )
        ) : (
          <ScrollView
            contentContainerStyle={styles.weekScroll}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                tintColor={c.brand as string}
              />
            }
          >
            <WeekGridView
              weekStart={weekStart}
              appointmentsByDate={appointmentsByDate}
              onSelectDay={(date) => {
                Haptics.selectionAsync()
                const key = toLocalDateKey(date)
                const dayAppts = appointmentsByDate.get(key) ?? []
                const normalizedDate = new Date(date)
                normalizedDate.setHours(0, 0, 0, 0)
                if (
                  dayAppts.length === 0 &&
                  canManageAppointments &&
                  normalizedDate.getTime() >= today.getTime()
                ) {
                  // Empty day → open create sheet prefilled with that date
                  useUIStore.getState().openCreateAppointment({ date: key })
                } else {
                  // Has appointments → switch to day mode for that date
                  setSelectedDate(date)
                  setViewMode('day')
                }
              }}
            />
          </ScrollView>
        )}
        </FadeSwitch>
        </SwipeableWeek>
      </SafeAreaView>

      <AppointmentDetailSheet
        appointment={selectedAppointment}
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        onStatusChange={canManageAppointments ? onStatusChange : undefined}
        onCreatePatientCard={canCreatePatientCards ? onCreatePatientCard : undefined}
        onDelete={canManageAppointments ? onDeleteAppointment : undefined}
        onEdit={canManageAppointments ? (id) => {
          const apt = allAppointments.find((a) => a.id === id)
          if (!apt) return
          setDetailVisible(false)
          setTimeout(() => {
            setEditAppointment(apt)
            setEditVisible(true)
          }, 250)
        } : undefined}
      />

      <AppointmentEditSheet
        appointment={editAppointment}
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        onSaved={() => weekQuery.refetch()}
      />
    </View>
  )
}

function WeekCardSkeleton({
  styles,
  side,
}: {
  styles: ReturnType<typeof makeStyles>
  side: 'left' | 'right'
}) {
  return (
    <View
      style={[
        styles.weekCellSkeleton,
        side === 'right' && styles.weekCellSkeletonRight,
      ]}
    >
      <View
        style={[
          styles.weekSkeletonRail,
          side === 'left'
            ? styles.weekSkeletonRailLeft
            : styles.weekSkeletonRailRight,
        ]}
      >
        <Skeleton width={18} height={8} borderRadius={4} />
        <Skeleton width={22} height={22} borderRadius={11} />
        <Skeleton width={16} height={8} borderRadius={4} />
      </View>
      <View style={styles.weekSkeletonPage}>
        <View style={styles.weekSkeletonPaperLines}>
          {Array.from({ length: PLANNER_PAPER_LINE_COUNT }).map((_, index) => (
            <View key={index} style={styles.weekSkeletonPaperLine} />
          ))}
        </View>
        <View style={styles.weekCellBody}>
          {Array.from({ length: 4 }).map((_, index) => (
            <View key={index} style={styles.weekAppointmentSkeletonRow}>
              <Skeleton width={26} height={7} borderRadius={4} />
              <Skeleton width="56%" height={7} borderRadius={4} />
            </View>
          ))}
        </View>
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
  root: { flex: 1, backgroundColor: c.background },
  flex: { flex: 1 },
  compactWeekChanger: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
  },
  dayModeHeader: {
    minHeight: 54,
    paddingVertical: spacing.xs,
  },
  plannerSearch: {
    position: 'relative',
    zIndex: 20,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  patientSearchInput: {
    minWidth: 0,
  },
  patientSearchResults: {
    position: 'absolute',
    top: 44 + spacing.xs,
    left: spacing.xl,
    right: spacing.xl,
    zIndex: 21,
  },
  patientSearchErrorPanel: {
    backgroundColor: c.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.brandSoft,
    borderRadius: radius.xl,
    ...shadows.sm,
    elevation: 8,
  },
  patientSearchMessageRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  patientSearchMessage: {
    flex: 1,
    ...typography.subhead,
    color: c.labelSecondary,
  },
  patientSearchRetry: {
    ...typography.subhead,
    fontFamily: font('600'),
    fontWeight: '600',
    color: c.brand,
  },
  compactWeekButton: {
    width: 24,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  compactWeekButtonPressed: {
    opacity: 0.62,
    transform: [{ scale: 0.97 }],
  },
  compactWeekLabel: {
    fontFamily: font('600'),
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    color: c.labelSecondary,
    textTransform: 'capitalize',
  },
  compactWeekLoading: {
    width: 12,
    height: 12,
    transform: [{ scale: 0.6 }],
  },
  dayHeader: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
  },
  dayLabel: {
    flex: 1,
    fontFamily: font('700'),
    fontSize: 17,
    fontWeight: '700',
    color: c.brandDeep,
    letterSpacing: -0.3,
    textTransform: 'capitalize',
  },
  dayCount: {
    ...typography.footnote,
    color: c.labelSecondary,
  },
  listContent: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingTop: 0,
    paddingBottom: 120,
  },
  weekScroll: {
    paddingTop: spacing.xs,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  weekSkeleton: {
    gap: PLANNER_ROW_GAP,
    paddingHorizontal: PLANNER_GRID_SIDE_INSET,
    paddingTop: spacing.xs,
    paddingBottom: 120,
  },
  weekSkeletonRow: {
    height: PLANNER_CARD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'stretch',
    columnGap: PLANNER_COLUMN_GAP,
  },
  weekCellSkeleton: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'visible',
    backgroundColor: 'transparent',
    borderRadius: radius.xxl,
    height: PLANNER_CARD_HEIGHT,
  },
  weekCellSkeletonRight: {
    flexDirection: 'row-reverse',
  },
  weekSkeletonRail: {
    width: PLANNER_DATE_RAIL_WIDTH,
    height: PLANNER_DATE_RAIL_HEIGHT,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: c.backgroundTertiary,
    borderWidth: 1,
    borderColor: c.brandSoft,
    zIndex: 2,
  },
  weekSkeletonRailLeft: {
    marginRight: -StyleSheet.hairlineWidth,
    borderRightWidth: 1,
    borderRightColor: c.brandSoft,
    borderTopLeftRadius: radius.md,
    borderBottomLeftRadius: radius.md,
  },
  weekSkeletonRailRight: {
    marginLeft: -StyleSheet.hairlineWidth,
    borderLeftWidth: 1,
    borderLeftColor: c.brandSoft,
    borderTopRightRadius: radius.md,
    borderBottomRightRadius: radius.md,
  },
  weekSkeletonPage: {
    flex: 1,
    marginVertical: 3,
    marginHorizontal: 0,
    padding: 0,
    overflow: 'hidden',
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.fillTertiary as string,
    backgroundColor: c.backgroundTertiary,
    ...shadows.sm,
    elevation: 2,
  },
  weekCellBody: {
    flex: 1,
    zIndex: 1,
  },
  weekSkeletonPaperLines: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 8,
    opacity: 0.22,
  },
  weekSkeletonPaperLine: {
    flex: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.separator as string,
  },
  weekAppointmentSkeletonRow: {
    height: PLANNER_APPOINTMENT_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
  },
  weekSkeletonEmptyCell: {
    flex: 1,
    minWidth: 0,
    height: PLANNER_CARD_HEIGHT,
  },
  daySkeleton: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: 8,
  },
  dayCardSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: c.background,
    borderRadius: radius.xl,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  })
}
