import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  StatusBar,
  AppState,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'

import DashboardHeader from '../../components/dashboard/DashboardHeader'
import EmailVerificationBanner from '../../components/dashboard/EmailVerificationBanner'
import TodayHeroCard from '../../components/dashboard/TodayHeroCard'
import AppointmentRow from '../../components/dashboard/AppointmentRow'
import EmptyState from '../../components/ui/EmptyState'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import SwipeableRow, { type SwipeAction } from '../../components/ui/SwipeableRow'
import {
  HeroCardSkeleton,
  ListRowSkeleton,
  Skeleton,
} from '../../components/ui/Skeleton'
import { useToast } from '../../components/ui/Toast'

import { useI18n } from '../../i18n'
import { useAuthStore } from '../../stores/auth'
import { useUIStore } from '../../stores/ui'
import { useThemeStore } from '../../stores/theme'
import { useNetworkStore } from '../../stores/network'
import { canView, canManage } from '../../lib/permissions'
import { getDashboardSnapshot } from '../../api/dashboard'
import { updateAppointmentStatus } from '../../api/appointments'
import type { ApiAppointment, ApiListResponse } from '../../types'
import { addDays, toLocalDateKey } from '../../lib/format'
import { radius, spacing, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { useManualRefresh } from '../../lib/useManualRefresh'
import type { DashboardAppointmentView } from '../../types'
import type { MainTabParams } from '../../navigation'

const MAX_UPCOMING = 4
const MAX_OVERDUE = 3
export default function DashboardScreen() {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const effective = useThemeStore((s) => s.effective)
  const user = useAuthStore((s) => s.user)
  const toast = useToast()
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParams>>()
  const openCreateAppointment = useUIStore((s) => s.openCreateAppointment)
  const requestAppointmentsViewDate = useUIStore((s) => s.requestAppointmentsViewDate)
  const requestAppointmentsViewAppointment = useUIStore(
    (s) => s.requestAppointmentsViewAppointment
  )
  const queryClient = useQueryClient()
  const [now, setNow] = useState(() => new Date())

  const canViewAppointments = canView(user, 'appointments')
  const canCreateAppointment = canManage(user, 'appointments')
  const hasDashboardAccess = canViewAppointments
  const isOnline = useNetworkStore((s) => s.isOnline)

  useEffect(() => {
    const tick = () => setNow(new Date())
    const timer = setInterval(tick, 30_000)
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick()
    })
    return () => {
      clearInterval(timer)
      subscription.remove()
    }
  }, [])

  const todayKey = toLocalDateKey(now)
  const query = useQuery({
    queryKey: ['dashboard', 'snapshot', todayKey],
    queryFn: () => getDashboardSnapshot(todayKey),
    enabled: hasDashboardAccess,
    staleTime: 30_000,
  })
  const {
    isRefreshing,
    onRefresh,
  } = useManualRefresh(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    return query.refetch()
  })

  const data = query.data
  const isLoading = query.isLoading && !data

  // Keep every scheduled appointment, then split finished time slots into a
  // visible overdue section instead of hiding them or calling them "upcoming".
  const scheduledToday = useMemo(() => {
    if (!data) return [] as DashboardAppointmentView[]
    return data.today_appointments
      .filter((a) => a.status === 'scheduled')
      .map((a) => ({ a, mins: toMinutes(a.start_time) }))
      .sort((x, y) => x.mins - y.mins)
      .map(({ a }) => a)
  }, [data])

  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const overdueAppointments = useMemo(
    () =>
      scheduledToday.filter(
        (appointment) =>
          toMinutes(appointment.start_time) + appointment.duration_minutes <= nowMinutes
      ),
    [nowMinutes, scheduledToday]
  )
  const upcoming = useMemo(
    () =>
      scheduledToday.filter(
        (appointment) =>
          toMinutes(appointment.start_time) + appointment.duration_minutes > nowMinutes
      ),
    [nowMinutes, scheduledToday]
  )
  const scheduledCount = scheduledToday.length
  const totalTodayCount = data?.today_appointments.length ?? 0
  const allTodayCompleted = Boolean(
    totalTodayCount > 0 && data?.today_appointments.every((a) => a.status === 'completed')
  )
  const visibleUpcoming = upcoming.slice(0, MAX_UPCOMING)
  const visibleOverdue = overdueAppointments.slice(0, MAX_OVERDUE)
  const hiddenUpcomingCount = Math.max(0, upcoming.length - visibleUpcoming.length)
  const hiddenOverdueCount = Math.max(0, overdueAppointments.length - visibleOverdue.length)
  // Hero card's "next" badge wants the first future appointment specifically;
  // labeling a past-due slot as "next" would be misleading.
  const nextAppointment = useMemo(() => {
    if (upcoming.length === 0) return null
    return upcoming[0]
  }, [upcoming])

  const isAfterHours =
    now.getHours() * 60 + now.getMinutes() >= toMinutes(data?.working_hours_end ?? '17:00')

  const onViewAllAppointments = () => {
    if (!canViewAppointments) return
    Haptics.selectionAsync()
    navigation.navigate('Dashboard')
  }

  const onViewTomorrow = () => {
    if (!canViewAppointments) return
    Haptics.selectionAsync()
    requestAppointmentsViewDate(toLocalDateKey(addDays(now, 1)))
    navigation.navigate('Dashboard')
  }

  const onOpenAppointment = (appointment: DashboardAppointmentView) => {
    if (!canViewAppointments) return
    Haptics.selectionAsync()
    requestAppointmentsViewAppointment(appointment.appointment_date, appointment.id)
    navigation.navigate('Dashboard')
  }

  const onNewAppointment = () => {
    if (!canCreateAppointment) {
      toast.error(t('dashboard.noAccess'))
      return
    }
    Haptics.selectionAsync()
    openCreateAppointment()
  }

  // Optimistic status flip used by swipe actions. Patches both the dashboard
  // snapshot cache (which feeds this screen) and any appointments-list caches
  // so the change is reflected everywhere immediately.
  const updateApptStatus = (id: string, status: ApiAppointment['status']) => {
    // 1. Dashboard snapshot: nest update inside today_appointments
    queryClient.setQueriesData<any>({ queryKey: ['dashboard'] }, (old: any) => {
      if (!old?.today_appointments) return old
      return {
        ...old,
        today_appointments: old.today_appointments.map((a: DashboardAppointmentView) =>
          a.id === id ? { ...a, status } : a
        ),
      }
    })
    // 2. Appointments-list caches (week/day) — same shape as PaymentsScreen.
    queryClient.setQueriesData<ApiListResponse<ApiAppointment>>(
      { queryKey: ['appointments'] },
      (old) => {
        if (!old?.data) return old
        return { ...old, data: old.data.map((a) => (a.id === id ? { ...a, status } : a)) }
      }
    )
    // 3. Persist to server. On failure, invalidate so the cache resnaps to truth.
    if (status === 'scheduled') return
    updateAppointmentStatus(id, status)
      .then(() => {
        const verb =
          status === 'completed' ? Haptics.NotificationFeedbackType.Success :
          Haptics.NotificationFeedbackType.Warning
        Haptics.notificationAsync(verb)
        toast.success(t('appointments.detail.statusUpdated'))
      })
      .catch(() => {
        toast.error(t('appointments.edit.failed'))
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
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
        locations={[0, 0.3, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <StatusBar barStyle={effective === 'dark' ? 'light-content' : 'dark-content'} />

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={c.brand as string}
            />
          }
        >
          <DashboardHeader />

          <EmailVerificationBanner />

          {!hasDashboardAccess ? (
            <View style={styles.bodyPad}>
              <EmptyState
                iconName="lock-closed-outline"
                title={t('dashboard.noAccess')}
                tone="warning"
              />
            </View>
          ) : isLoading ? (
            <LoadingState />
          ) : query.isError && !data ? (
            <View style={styles.bodyPad}>
              <EmptyState
                iconName={isOnline ? 'cloud-offline-outline' : 'cloud-offline'}
                title={isOnline ? t('dashboard.loadFailed') : t('network.offline')}
                subtitle={!isOnline ? t('network.offlineHint') : undefined}
                tone={isOnline ? 'danger' : 'warning'}
                action={
                  <Button
                    title={t('common.retry')}
                    variant="tinted"
                    onPress={() => query.refetch()}
                    disabled={!isOnline}
                  />
                }
              />
            </View>
          ) : (
            <View style={styles.body}>
              {/* Hero card — Today's appointments + next */}
              {canViewAppointments ? (
                <TodayHeroCard
                  totalCount={totalTodayCount}
                  remainingCount={scheduledCount}
                  next={nextAppointment}
                  onPressViewAll={onViewAllAppointments}
                  onPressNext={
                    nextAppointment ? () => onOpenAppointment(nextAppointment) : undefined
                  }
                />
              ) : null}

              {canViewAppointments && visibleOverdue.length > 0 ? (
                <View>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleRow}>
                      <View style={[styles.sectionIcon, styles.overdueSectionIcon]}>
                        <Icon name="alert-outline" size={14} color={c.danger as string} />
                      </View>
                      <Text style={[styles.sectionTitle, { color: c.danger }]} numberOfLines={1}>
                        {t('dashboard.needsAttention')}
                      </Text>
                    </View>
                    <Pressable
                      onPress={onViewAllAppointments}
                      hitSlop={8}
                      style={styles.sectionActionBtn}
                      accessibilityRole="button"
                      accessibilityLabel={t('dashboard.viewAll')}
                    >
                      <Text style={styles.sectionAction}>{t('dashboard.viewAll')}</Text>
                      <Icon name="chevron-forward" size={14} color={c.brand as string} />
                    </Pressable>
                  </View>
                  {canCreateAppointment ? (
                    <Text style={styles.swipeHint}>{t('dashboard.swipeHint')}</Text>
                  ) : null}
                  <DashboardAppointmentList
                    appointments={visibleOverdue}
                    overdue
                    canManage={canCreateAppointment}
                    onOpen={onOpenAppointment}
                    onStatusChange={updateApptStatus}
                  />
                  {hiddenOverdueCount > 0 ? (
                    <ShowAllButton
                      count={overdueAppointments.length}
                      onPress={onViewAllAppointments}
                    />
                  ) : null}
                </View>
              ) : null}

              {/* Upcoming appointments section */}
              {canViewAppointments &&
              (visibleUpcoming.length > 0 || overdueAppointments.length === 0) ? (
              <View>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <View style={styles.sectionIcon}>
                      <Icon name="time-outline" size={14} color={c.brand as string} />
                    </View>
                    <Text style={styles.sectionTitle} numberOfLines={1}>
                      {t('dashboard.upcomingToday')}
                    </Text>
                  </View>
                  {visibleUpcoming.length > 0 ? (
                    <Pressable
                      onPress={onViewAllAppointments}
                      hitSlop={8}
                      style={styles.sectionActionBtn}
                      accessibilityRole="button"
                      accessibilityLabel={t('dashboard.viewAll')}
                    >
                      <Text style={styles.sectionAction} numberOfLines={1}>{t('dashboard.viewAll')}</Text>
                      <Icon name="chevron-forward" size={14} color={c.brand as string} />
                    </Pressable>
                  ) : null}
                </View>

                {visibleUpcoming.length === 0 ? (
                    allTodayCompleted ? (
                      <EmptyState
                        iconName="checkmark-circle-outline"
                        title={t('dashboard.allCompleted')}
                        tone="success"
                        action={
                          <Button
                            title={`${t('dashboard.viewAll')} (${totalTodayCount})`}
                            variant="tinted"
                            onPress={onViewAllAppointments}
                          />
                        }
                      />
                    ) : (
                      <EmptyState
                        iconName={isAfterHours ? 'moon-outline' : 'calendar-outline'}
                        title={
                          isAfterHours || totalTodayCount > 0
                            ? t('dashboard.todayDone')
                            : t('dashboard.todayAppointmentsEmpty')
                        }
                        tone={isAfterHours || totalTodayCount > 0 ? 'success' : 'neutral'}
                        action={
                          isAfterHours || totalTodayCount > 0 ? (
                            <Button
                              title={t('dashboard.viewTomorrow')}
                              variant="tinted"
                              onPress={onViewTomorrow}
                            />
                          ) : canCreateAppointment ? (
                            <Button
                              title={t('dashboard.scheduleAppointment')}
                              variant="tinted"
                              onPress={onNewAppointment}
                            />
                          ) : undefined
                        }
                      />
                    )
                  ) : (
                    <>
                      {canCreateAppointment && overdueAppointments.length === 0 ? (
                        <Text style={styles.swipeHint}>{t('dashboard.swipeHint')}</Text>
                      ) : null}
                      <DashboardAppointmentList
                        appointments={visibleUpcoming}
                        canManage={canCreateAppointment}
                        onOpen={onOpenAppointment}
                        onStatusChange={updateApptStatus}
                      />
                      {hiddenUpcomingCount > 0 ? (
                        <ShowAllButton count={upcoming.length} onPress={onViewAllAppointments} />
                      ) : null}
                    </>
                  )}
              </View>
              ) : null}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

interface DashboardAppointmentListProps {
  appointments: DashboardAppointmentView[]
  overdue?: boolean
  canManage: boolean
  onOpen: (appointment: DashboardAppointmentView) => void
  onStatusChange: (id: string, status: ApiAppointment['status']) => void
}

function DashboardAppointmentList({
  appointments,
  overdue = false,
  canManage,
  onOpen,
  onStatusChange,
}: DashboardAppointmentListProps) {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])

  return (
    <View style={styles.list}>
      {appointments.map((appointment, index) => {
        const swipeActions: SwipeAction[] = canManage
          ? [
              {
                key: 'complete',
                label: t('appointments.detail.markCompleted'),
                iconName: 'checkmark-circle',
                bg: '#16A34A',
                onPress: () => onStatusChange(appointment.id, 'completed'),
              },
              {
                key: 'cancel',
                label: t('appointments.detail.markCancelled'),
                iconName: 'close-circle',
                bg: '#DC2626',
                onPress: () => onStatusChange(appointment.id, 'cancelled'),
              },
            ]
          : []

        return (
          <React.Fragment key={appointment.id}>
            <SwipeableRow rightActions={swipeActions.length > 0 ? swipeActions : undefined}>
              <AppointmentRow
                appointment={appointment}
                highlightUpcoming={!overdue && index === 0}
                overdue={overdue}
                onPress={() => onOpen(appointment)}
              />
            </SwipeableRow>
            {index < appointments.length - 1 ? <View style={styles.separator} /> : null}
          </React.Fragment>
        )
      })}
    </View>
  )
}

function ShowAllButton({ count, onPress }: { count: number; onPress: () => void }) {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.showAll,
        pressed && { backgroundColor: c.fillQuaternary },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${t('dashboard.viewAll')} (${count})`}
    >
      <Text style={styles.showAllText}>
        {t('dashboard.viewAll')} ({count})
      </Text>
      <Icon name="chevron-forward" size={18} color={c.brand as string} />
    </Pressable>
  )
}

function LoadingState() {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  return (
    <View style={styles.body}>
      <HeroCardSkeleton />
      <View>
        <View style={styles.sectionHeader}>
          <Skeleton width={140} height={18} />
          <Skeleton width={70} height={14} />
        </View>
        <View style={styles.list}>
          <ListRowSkeleton />
          <View style={styles.separator} />
          <ListRowSkeleton />
          <View style={styles.separator} />
          <ListRowSkeleton />
        </View>
      </View>
    </View>
  )
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map((n) => parseInt(n, 10) || 0)
  return h * 60 + m
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    flex: { flex: 1 },
    scroll: { paddingBottom: 120 },
    body: {
      paddingHorizontal: spacing.xl,
      gap: spacing.lg,
    },
    bodyPad: { paddingHorizontal: spacing.xl },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
      paddingHorizontal: spacing.xs,
      gap: 12,
    },
    sectionTitleRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minWidth: 0,
    },
    sectionIcon: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: c.brandLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    overdueSectionIcon: {
      backgroundColor: 'rgba(255,59,48,0.10)',
    },
    swipeHint: {
      ...typography.caption1,
      color: c.labelTertiary,
      marginTop: -spacing.sm,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    sectionTitle: {
      // `flex: 1` + `flexShrink: 1` are critical: the Uzbek translation
      // "Yaqinlashayotgan navbatlar" is significantly longer than the
      // English / Russian counterparts and without an explicit shrink
      // constraint the text overflows its parent and visually overlaps
      // the right-side "View all" action.
      flex: 1,
      flexShrink: 1,
      fontFamily: font('700'),
      fontSize: 17,
      fontWeight: '700',
      color: c.brandDeep,
      letterSpacing: -0.3,
    },
    sectionActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    sectionAction: {
      ...typography.footnoteBold,
      color: c.brand,
    },
    list: {
      backgroundColor: c.background,
      borderRadius: radius.xxl,
      overflow: 'hidden',
      shadowColor: '#0F2E4C',
      shadowOpacity: 0.06,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 6 },
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.separator as string,
      marginLeft: 16 + 42 + 12,
    },
    showAll: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 13,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.separator as string,
      backgroundColor: c.brandLight,
    },
    showAllText: {
      ...typography.footnoteBold,
      color: c.brandDeep,
    },
  })
}
