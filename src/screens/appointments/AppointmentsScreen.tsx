import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  RefreshControl,
  StatusBar,
  Pressable,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'

import WeekStrip from '../../components/appointments/WeekStrip'
import WeekGridView from '../../components/appointments/WeekGridView'
import AppointmentTimelineCard from '../../components/appointments/AppointmentTimelineCard'
import NowLine from '../../components/appointments/NowLine'
import AppointmentDetailSheet from '../../components/appointments/AppointmentDetailSheet'
import AppointmentEditSheet from '../../components/appointments/AppointmentEditSheet'
import SwipeableWeek from '../../components/appointments/SwipeableWeek'
import SegmentedControl from '../../components/ui/SegmentedControl'
import FadeSwitch from '../../components/ui/FadeSwitch'
import { findConflictingIds } from '../../lib/appointmentConflicts'
import EmptyState from '../../components/ui/EmptyState'
import Icon from '../../components/ui/Icon'
import Skeleton from '../../components/ui/Skeleton'
import { useToast } from '../../components/ui/Toast'

import { useI18n } from '../../i18n'
import { useAuthStore } from '../../stores/auth'
import { useUIStore } from '../../stores/ui'
import { useThemeStore } from '../../stores/theme'
import { canView } from '../../lib/permissions'
import { listAppointments, updateAppointment, deleteAppointment } from '../../api/appointments'
import { cancelAppointmentReminder } from '../../lib/notifications'
import type { ApiListResponse } from '../../types'
import {
  addDays,
  formatDayMonth,
  formatMonthYear,
  formatWeekdayLong,
  getWeekStart,
  isSameDay,
  toLocalDateKey,
} from '../../lib/format'
import { radius, spacing, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import type { ApiAppointment } from '../../types'

type ViewMode = 'day' | 'week'

export default function AppointmentsScreen() {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const effective = useThemeStore((s) => s.effective)
  const user = useAuthStore((s) => s.user)
  const toast = useToast()
  const queryClient = useQueryClient()

  const canViewAppointments = canView(user, 'appointments')

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

  const allAppointments = weekQuery.data?.data ?? []
  const isLoading = weekQuery.isLoading && !weekQuery.data
  const isRefreshing = weekQuery.isFetching && Boolean(weekQuery.data)

  const selectedKey = toLocalDateKey(selectedDate)
  const dayAppointments = useMemo(
    () =>
      allAppointments
        .filter((a) => a.appointment_date === selectedKey)
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [allAppointments, selectedKey]
  )
  const dayConflictIds = useMemo(() => findConflictingIds(dayAppointments), [dayAppointments])

  // Build day list with optional "now" marker inserted at the current time.
  type DayItem =
    | { type: 'now'; id: string }
    | { type: 'appointment'; id: string; data: ApiAppointment; isPast: boolean }

  const todayKey = toLocalDateKey(new Date())
  const isOnTodayKey = selectedKey === todayKey
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes()

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

  const onRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    weekQuery.refetch()
  }

  const onJumpToToday = () => {
    Haptics.selectionAsync()
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    setSelectedDate(d)
  }

  const navigateWeek = (delta: number) => {
    Haptics.selectionAsync()
    setSelectedDate((d) => addDays(d, delta * 7))
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isOnToday = isSameDay(selectedDate, today)
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
  const onStatusChange = (id: string, status: ApiAppointment['status']) => {
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
    if (status !== 'scheduled') {
      cancelAppointmentReminder(id).catch(() => {})
    }
    updateAppointment(id, { status })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      })
      .catch(() => {
        toast.error(t('appointments.edit.failed'))
        queryClient.invalidateQueries({ queryKey: ['appointments'] })
      })
  }

  const onDeleteAppointment = (id: string) => {
    // Optimistic remove from every cached list.
    queryClient.setQueriesData<ApiListResponse<ApiAppointment>>(
      { queryKey: ['appointments'] },
      (old) => {
        if (!old?.data) return old
        return { ...old, data: old.data.filter((a) => a.id !== id) }
      }
    )
    cancelAppointmentReminder(id).catch(() => {})
    deleteAppointment(id)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      })
      .catch(() => {
        toast.error(t('appointments.edit.failed'))
        queryClient.invalidateQueries({ queryKey: ['appointments'] })
      })
  }

  const gradientColors: [string, string, string] =
    effective === 'dark'
      ? [c.background, c.background, c.background]
      : [c.brandSurface, '#FFFFFF', '#FFFFFF']

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={gradientColors}
        locations={[0, 0.2, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <StatusBar barStyle={effective === 'dark' ? 'light-content' : 'dark-content'} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {t('appointments.title')}
            </Text>
            <View style={styles.toggleWrap}>
              <SegmentedControl<ViewMode>
                options={[
                  { value: 'week', label: t('appointments.viewWeek') },
                  { value: 'day', label: t('appointments.viewDay') },
                ]}
                value={viewMode}
                onChange={setViewMode}
              />
            </View>
          </View>

          <View style={styles.monthRow}>
            <Pressable onPress={() => navigateWeek(-1)} hitSlop={8} style={styles.navBtn}>
              <Icon name="chevron-back" size={18} color={c.brand as string} />
            </Pressable>
            <Text style={styles.monthLabel}>{formatMonthYear(selectedDate, locale)}</Text>
            <Pressable onPress={() => navigateWeek(1)} hitSlop={8} style={styles.navBtn}>
              <Icon name="chevron-forward" size={18} color={c.brand as string} />
            </Pressable>
            <Pressable
              onPress={onJumpToToday}
              hitSlop={8}
              disabled={isOnToday}
              style={[styles.todayBtn, isOnToday && styles.todayBtnDisabled]}
            >
              <Text style={[styles.todayText, isOnToday && styles.todayTextDisabled]}>
                {t('appointments.todayLabel')}
              </Text>
            </Pressable>
          </View>
        </View>

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
        ) : isLoading ? (
          viewMode === 'week' ? (
            <View style={styles.weekSkeleton}>
              {Array.from({ length: 7 }).map((_, i) => (
                <View key={i} style={styles.weekCellSkeleton}>
                  <Skeleton width="60%" height={12} />
                  <Skeleton width="40%" height={20} style={{ marginTop: 6 }} />
                  <View style={styles.weekCellBody}>
                    <Skeleton width="90%" height={36} borderRadius={8} />
                    <Skeleton width="90%" height={36} borderRadius={8} />
                    <Skeleton width="70%" height={36} borderRadius={8} />
                  </View>
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
                if (dayAppts.length === 0) {
                  // Empty day → open create sheet prefilled with that date
                  useUIStore.getState().openCreateAppointment(key)
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
        onStatusChange={onStatusChange}
        onDelete={onDeleteAppointment}
        onEdit={(id) => {
          const apt = allAppointments.find((a) => a.id === id)
          if (!apt) return
          setDetailVisible(false)
          setTimeout(() => {
            setEditAppointment(apt)
            setEditVisible(true)
          }, 250)
        }}
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

function toMin(time: string): number {
  const [h, m] = time.split(':').map((n) => parseInt(n, 10) || 0)
  return h * 60 + m
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    flex: 1,
    ...typography.title1,
    color: c.brandDeep,
  },
  toggleWrap: {
    width: 144,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontFamily: font('600'),
    fontSize: 15,
    fontWeight: '600',
    color: c.labelSecondary,
    textTransform: 'capitalize',
  },
  todayBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: c.brandLight,
  },
  todayBtnDisabled: {
    backgroundColor: c.fillQuaternary,
  },
  todayText: {
    fontFamily: font('700'),
    fontSize: 12,
    fontWeight: '700',
    color: c.brand,
    letterSpacing: 0.1,
  },
  todayTextDisabled: {
    color: c.labelTertiary,
  },
  dayHeader: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
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
    paddingTop: spacing.xs,
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  weekCellSkeleton: {
    width: '47%',
    backgroundColor: c.background,
    borderRadius: radius.xl,
    padding: 12,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    minHeight: 240,
  },
  weekCellBody: {
    flex: 1,
    gap: 8,
    marginTop: 12,
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
