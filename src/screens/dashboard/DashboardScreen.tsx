import React, { useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'

import DashboardHeader from '../../components/dashboard/DashboardHeader'
import TodayHeroCard from '../../components/dashboard/TodayHeroCard'
import FinanceCard from '../../components/dashboard/FinanceCard'
import AppointmentRow from '../../components/dashboard/AppointmentRow'
import EmptyState from '../../components/ui/EmptyState'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import SwipeableRow, { type SwipeAction } from '../../components/ui/SwipeableRow'
import {
  HeroCardSkeleton,
  StatCardSkeleton,
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
import { updateAppointment } from '../../api/appointments'
import { cancelAppointmentReminder } from '../../lib/notifications'
import type { ApiAppointment, ApiListResponse } from '../../types'
import { formatCurrencyParts, toLocalDateKey } from '../../lib/format'
import { radius, spacing, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import type { DashboardAppointmentView } from '../../types'
import type { MainTabParams } from '../../navigation'

const AFTER_HOURS_THRESHOLD = 17 * 60 // 17:00 — pivot empty-state copy to "tomorrow" after this

const MAX_UPCOMING = 4

export default function DashboardScreen() {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const effective = useThemeStore((s) => s.effective)
  const user = useAuthStore((s) => s.user)
  const toast = useToast()
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParams>>()
  const openCreateAppointment = useUIStore((s) => s.openCreateAppointment)
  const queryClient = useQueryClient()

  const canViewAppointments = canView(user, 'appointments')
  const canViewPayments = canView(user, 'payments')
  const canCreateAppointment = canManage(user, 'appointments')
  const isOnline = useNetworkStore((s) => s.isOnline)

  const isAfterHours = useMemo(() => {
    const now = new Date()
    return now.getHours() * 60 + now.getMinutes() >= AFTER_HOURS_THRESHOLD
  }, [])

  const todayKey = useMemo(() => toLocalDateKey(new Date()), [])
  const query = useQuery({
    queryKey: ['dashboard', 'snapshot', todayKey],
    queryFn: () => getDashboardSnapshot(todayKey),
    staleTime: 30_000,
  })

  const data = query.data
  const isLoading = query.isLoading && !data
  const isRefreshing = query.isFetching && Boolean(data)

  const upcoming = useMemo(() => {
    if (!data) return [] as DashboardAppointmentView[]
    const now = new Date()
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    return data.today_appointments
      .filter((a) => a.status === 'scheduled')
      .map((a) => ({ a, mins: toMinutes(a.start_time) }))
      .filter(({ mins }) => mins >= nowMinutes)
      .sort((x, y) => x.mins - y.mins)
      .map(({ a }) => a)
  }, [data])

  const todayCount = data?.today_appointments.filter((a) => a.status === 'scheduled').length ?? 0
  const visibleUpcoming = upcoming.slice(0, MAX_UPCOMING)
  const hiddenCount = Math.max(0, todayCount - visibleUpcoming.length)
  const nextAppointment = upcoming[0] ?? null

  const revenueParts = data ? formatCurrencyParts(data.revenue_this_month, locale) : null
  const debtParts = data ? formatCurrencyParts(data.outstanding_debt_total, locale) : null

  // Synthetic 7-day trend for the sparkline. The mock backend doesn't return
  // history yet — we derive a smooth wobble around the current total so the
  // chart reads as "this is what the last week looked like". Real backend
  // will replace this with snapshot history.
  const revenueTrend = useMemo(
    () => buildTrend(data?.revenue_this_month ?? 0, 7, 'up'),
    [data?.revenue_this_month]
  )
  const debtTrend = useMemo(
    () => buildTrend(data?.outstanding_debt_total ?? 0, 7, 'down'),
    [data?.outstanding_debt_total]
  )

  // Formatter that mirrors formatCurrencyParts.value for the animated counter.
  const formatRevenue = React.useCallback(
    (n: number) => formatCurrencyParts(Math.round(n), locale).value,
    [locale]
  )

  const onRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    query.refetch()
  }

  const onViewAllAppointments = () => {
    if (!canViewAppointments) return
    Haptics.selectionAsync()
    navigation.navigate('Appointments')
  }

  const onViewPayments = () => {
    if (!canViewPayments) return
    Haptics.selectionAsync()
    navigation.navigate('Payments')
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
    // Cancel any pending reminder since the appointment is no longer scheduled.
    if (status !== 'scheduled') {
      cancelAppointmentReminder(id).catch(() => {})
    }
    // 3. Persist to server. On failure, invalidate so the cache resnaps to truth.
    updateAppointment(id, { status })
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

          {isLoading ? (
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
                  count={todayCount}
                  next={nextAppointment}
                  onPressViewAll={onViewAllAppointments}
                  onPressNext={onViewAllAppointments}
                />
              ) : (
                <LockedCard t={t} />
              )}

              {/* Finance cards — Revenue + Debt */}
              {canViewPayments && data && revenueParts && debtParts ? (
                <View style={styles.financeRow}>
                  <FinanceCard
                    iconName="trending-up-outline"
                    label={t('dashboard.thisMonthRevenue')}
                    value={revenueParts.value}
                    unit={revenueParts.unit}
                    // Blue gradient — keeps the two finance cards visually
                    // distinct from each other even when there's no debt
                    // (otherwise both render in the same green success tone).
                    tone="info"
                    numericValue={data.revenue_this_month}
                    formatValue={formatRevenue}
                    trend={revenueTrend}
                    onPress={onViewPayments}
                  />
                  <FinanceCard
                    iconName="warning-outline"
                    label={t('dashboard.outstandingDebt')}
                    value={debtParts.value}
                    unit={debtParts.unit}
                    // Green when there's no debt (success), red when there's
                    // outstanding balance to recover (danger). Keeps the card
                    // semantically meaningful at a glance.
                    tone={data.outstanding_debt_total > 0 ? 'danger' : 'success'}
                    numericValue={data.outstanding_debt_total}
                    formatValue={formatRevenue}
                    trend={debtTrend}
                    onPress={onViewPayments}
                  />
                </View>
              ) : !canViewPayments ? (
                <LockedCard t={t} />
              ) : null}

              {/* Upcoming appointments section */}
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
                    <Pressable onPress={onViewAllAppointments} hitSlop={8} style={styles.sectionActionBtn}>
                      <Text style={styles.sectionAction} numberOfLines={1}>{t('dashboard.viewAll')}</Text>
                      <Icon name="chevron-forward" size={14} color={c.brand as string} />
                    </Pressable>
                  ) : null}
                </View>

                {canViewAppointments ? (
                  visibleUpcoming.length === 0 ? (
                    todayCount === 0 ? (
                      <EmptyState
                        iconName={isAfterHours ? 'moon-outline' : 'calendar-outline'}
                        title={
                          isAfterHours
                            ? t('dashboard.todayDone')
                            : t('dashboard.todayAppointmentsEmpty')
                        }
                        tone={isAfterHours ? 'success' : 'neutral'}
                        action={
                          isAfterHours ? (
                            <Button
                              title={t('dashboard.viewTomorrow')}
                              variant="tinted"
                              onPress={onViewAllAppointments}
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
                    ) : (
                      <EmptyState
                        iconName="checkmark-circle-outline"
                        title={t('dashboard.allCompleted')}
                        tone="success"
                        action={
                          <Button
                            title={`${t('dashboard.viewAll')} (${todayCount})`}
                            variant="tinted"
                            onPress={onViewAllAppointments}
                          />
                        }
                      />
                    )
                  ) : (
                    <View style={styles.list}>
                      {visibleUpcoming.map((a, idx) => {
                        const swipeActions: SwipeAction[] = canCreateAppointment
                          ? [
                              {
                                key: 'complete',
                                label: t('appointments.detail.markCompleted'),
                                iconName: 'checkmark-circle',
                                bg: '#16A34A',
                                onPress: () => updateApptStatus(a.id, 'completed'),
                              },
                              {
                                key: 'cancel',
                                label: t('appointments.detail.markCancelled'),
                                iconName: 'close-circle',
                                bg: '#DC2626',
                                onPress: () => updateApptStatus(a.id, 'cancelled'),
                              },
                            ]
                          : []
                        return (
                          <React.Fragment key={a.id}>
                            <SwipeableRow
                              rightActions={swipeActions.length > 0 ? swipeActions : undefined}
                            >
                              <AppointmentRow
                                appointment={a}
                                highlightUpcoming={idx === 0}
                                onPress={onViewAllAppointments}
                              />
                            </SwipeableRow>
                            {idx < visibleUpcoming.length - 1 ? (
                              <View style={styles.separator} />
                            ) : null}
                          </React.Fragment>
                        )
                      })}

                      {hiddenCount > 0 ? (
                        <Pressable
                          onPress={onViewAllAppointments}
                          style={({ pressed }) => [
                            styles.showAll,
                            pressed && { backgroundColor: c.fillQuaternary },
                          ]}
                        >
                          <Text style={styles.showAllText}>
                            {t('dashboard.viewAll')} ({todayCount})
                          </Text>
                          <Icon name="chevron-forward" size={18} color={c.brand as string} />
                        </Pressable>
                      ) : null}
                    </View>
                  )
                ) : (
                  <LockedCard t={t} />
                )}
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

function LoadingState() {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  return (
    <View style={styles.body}>
      <HeroCardSkeleton />
      <View style={styles.financeRow}>
        <StatCardSkeleton />
        <StatCardSkeleton />
      </View>
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

function LockedCard({ t }: { t: (k: string) => string }) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  return (
    <View style={styles.lockedCard}>
      <Icon name="lock-closed-outline" size={22} color={c.labelSecondary as string} />
      <Text style={styles.lockedText}>{t('dashboard.noAccess')}</Text>
    </View>
  )
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map((n) => parseInt(n, 10) || 0)
  return h * 60 + m
}

// Deterministic synthetic 7-day trend. Builds a series of values that ends
// at `current` and trends generally upward / downward depending on
// `direction`. Seeded by the current value so the chart is stable across
// re-renders but changes meaningfully when the underlying number does.
function buildTrend(current: number, points: number, direction: 'up' | 'down'): number[] {
  if (current <= 0) return Array.from({ length: points }, () => 0)
  let seed = Math.floor(current) || 1
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  const base = direction === 'up' ? current * 0.65 : current * 1.35
  const arr: number[] = []
  for (let i = 0; i < points - 1; i++) {
    const progress = i / (points - 1)
    const eased = direction === 'up' ? progress : 1 - progress
    // Smooth interpolation from base toward current, plus +/-10% jitter.
    const target = base + (current - base) * eased
    const jitter = (rand() - 0.5) * current * 0.18
    arr.push(Math.max(0, target + jitter))
  }
  arr.push(current)
  return arr
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
    financeRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
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
    lockedCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: spacing.lg,
      backgroundColor: c.fillQuaternary,
      borderRadius: radius.xl,
    },
    lockedText: {
      ...typography.subhead,
      color: c.labelSecondary,
    },
  })
}
