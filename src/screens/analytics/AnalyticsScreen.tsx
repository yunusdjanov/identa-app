import React, { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

import Icon from '../../components/ui/Icon'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import AppHeader, { HeaderIconButton } from '../../components/navigation/AppHeader'
import AnalyticsKpiCard from '../../components/analytics/AnalyticsKpiCard'
import AnalyticsRangeSelector from '../../components/analytics/AnalyticsRangeSelector'
import AnalyticsCurrencySelector from '../../components/analytics/AnalyticsCurrencySelector'
import AnalyticsTrendCard from '../../components/analytics/AnalyticsTrendCard'
import { Skeleton } from '../../components/ui/Skeleton'
import { useToast } from '../../components/ui/Toast'
import { useI18n } from '../../i18n'
import { useAuthStore } from '../../stores/auth'
import { canExportData, canView, canViewAnalytics } from '../../lib/permissions'
import { getAnalyticsSummary } from '../../api/analytics'
import {
  DEFAULT_ANALYTICS_RANGE,
  computeDelta,
  getPreviousRangeBounds,
  getRangeBounds,
  type AnalyticsRange,
} from '../../lib/analytics'
import { formatCurrencyParts, toLocalDateKey } from '../../lib/format'
import { formatStoredPhone } from '../../lib/phoneFormat'
import type { Locale } from '../../constants'
import { getFloatingTabBarContentInset } from '../../constants/navigation'
import { exportAnalyticsPdf } from '../../lib/analyticsExport'
import { font, radius, shadows, spacing, typography } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { useManualRefresh } from '../../lib/useManualRefresh'
import type { DashboardCurrency } from '../../types'
import type { MainStackParams } from '../../navigation'

const STATUS_ORDER = ['scheduled', 'completed', 'cancelled', 'no_show'] as const
const ANALYTICS_CONTENT_MAX_WIDTH = 960
const STATUS_COLOR: Record<(typeof STATUS_ORDER)[number], string> = {
  scheduled: '#3B82F6',
  completed: '#14B8A6',
  cancelled: '#94A3B8',
  no_show: '#F43F5E',
}

export default function AnalyticsScreen() {
  const { t, locale } = useI18n()
  const c = useColors()
  const insets = useSafeAreaInsets()
  const { width: screenWidth } = useWindowDimensions()
  const styles = useMemo(() => makeStyles(c), [c])
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParams>>()
  const toast = useToast()
  const user = useAuthStore((s) => s.user)

  const localCanPayments = canView(user, 'payments')
  const localCanPatients = canView(user, 'patients')
  const localCanAppointments = canView(user, 'appointments')
  const localCanAny = canViewAnalytics(user)

  const [range, setRange] = useState<AnalyticsRange>(DEFAULT_ANALYTICS_RANGE)
  const [currency, setCurrency] = useState<DashboardCurrency>('UZS')
  const [anchorNow, setAnchorNow] = useState(() => new Date())
  const [exporting, setExporting] = useState(false)
  const bounds = useMemo(
    () => getRangeBounds(range, anchorNow),
    [range, anchorNow]
  )
  const previousBounds = useMemo(
    () => getPreviousRangeBounds(range, anchorNow),
    [range, anchorNow]
  )
  const summaryParams = useMemo(
    () => ({
      range,
      current_from: toLocalDateKey(bounds.start),
      current_to: toLocalDateKey(bounds.end),
      previous_from: toLocalDateKey(previousBounds.start),
      previous_to: toLocalDateKey(previousBounds.end),
      currency,
    }),
    [range, bounds, previousBounds, currency]
  )

  const analyticsQuery = useQuery({
    queryKey: ['analytics', 'summary', summaryParams],
    queryFn: () => getAnalyticsSummary(summaryParams),
    enabled: localCanAny,
    placeholderData: (previousData) =>
      previousData?.currency === currency ? previousData : undefined,
    staleTime: 60_000,
  })
  const analytics = analyticsQuery.data
  const anchorDay = toLocalDateKey(anchorNow)
  useFocusEffect(
    useCallback(() => {
      const now = new Date()
      if (toLocalDateKey(now) !== anchorDay) setAnchorNow(now)
    }, [anchorDay])
  )

  const refreshAnalytics = useCallback(async () => {
    const now = new Date()
    if (toLocalDateKey(now) !== anchorDay) {
      setAnchorNow(now)
      return
    }
    await analyticsQuery.refetch()
  }, [analyticsQuery, anchorDay])
  const {
    isRefreshing,
    onRefresh,
  } = useManualRefresh(refreshAnalytics)
  const canPayments =
    localCanPayments && (analytics?.permissions.payments ?? true)
  const canPatients =
    localCanPatients && (analytics?.permissions.patients ?? true)
  const canAppointments =
    localCanAppointments && (analytics?.permissions.appointments ?? true)
  const canVisits = canAppointments || canPayments
  const canExport =
    canPayments && canExportData(user)
  const resolvedCurrency = analytics?.currency ?? currency

  const kpis = useMemo(() => {
    const revenueCurrent = analytics?.kpis.revenue.current ?? 0
    const revenuePrevious = analytics?.kpis.revenue.previous ?? 0
    const patientsCurrent = analytics?.kpis.patients.current ?? 0
    const patientsPrevious = analytics?.kpis.patients.previous ?? 0
    const visitsCurrent = analytics?.kpis.visits.current ?? 0
    const visitsPrevious = analytics?.kpis.visits.previous ?? 0
    return {
      revenue: {
        current: revenueCurrent,
        previous: revenuePrevious,
        delta: computeDelta(revenueCurrent, revenuePrevious),
      },
      debt: { current: analytics?.kpis.debt.current ?? 0 },
      patients: {
        current: patientsCurrent,
        previous: patientsPrevious,
        delta: computeDelta(patientsCurrent, patientsPrevious),
      },
      visits: {
        current: visitsCurrent,
        previous: visitsPrevious,
        delta: computeDelta(visitsCurrent, visitsPrevious),
      },
    }
  }, [analytics])

  const revenueParts = formatCurrencyParts(kpis.revenue.current, locale as Locale, resolvedCurrency)
  const debtParts = formatCurrencyParts(kpis.debt.current, locale as Locale, resolvedCurrency)

  const statusCounts = useMemo(
    () => {
      const counts = { scheduled: 0, completed: 0, cancelled: 0, no_show: 0 }
      for (const row of analytics?.appointment_status ?? []) counts[row.status] = row.count
      return counts
    },
    [analytics]
  )
  const topDebtors = analytics?.top_debtors ?? []
  const revenueSeries = useMemo(
    () => (analytics?.buckets ?? []).map((bucket) => bucket.revenue),
    [analytics]
  )
  const growthSeries = useMemo(
    () => (analytics?.buckets ?? []).map((bucket) => bucket.cumulative_patients),
    [analytics]
  )
  const statusTotal = STATUS_ORDER.reduce((total, status) => total + statusCounts[status], 0)
  const effectiveContentWidth = Math.min(screenWidth, ANALYTICS_CONTENT_MAX_WIDTH)
  const chartWidth = Math.max(220, effectiveContentWidth - spacing.md * 4 - 2)
  const wideLayout = effectiveContentWidth >= 760
  const rangeLabel = t(`analytics.range.${range}`)
  const formatMoney = (value: number) => {
    const parts = formatCurrencyParts(value, locale as Locale, resolvedCurrency)
    return `${parts.value} ${parts.unit}`
  }

  const handleRangeChange = useCallback((nextRange: AnalyticsRange) => {
    setRange(nextRange)
    setAnchorNow(new Date())
  }, [])

  const openOutstandingDebts = () => {
    navigation.navigate('Tabs', {
      screen: 'Payments',
      params: { outstandingOnly: true, requestId: Date.now() },
    })
  }

  const handleExport = async () => {
    if (!analytics || exporting) return
    setExporting(true)
    try {
      await exportAnalyticsPdf(analytics, t(`analytics.range.${range}`), locale as Locale, {
        title: t('analytics.export.title'),
        range: t('analytics.export.range'),
        generatedAt: t('analytics.export.generatedAt'),
        period: t('analytics.export.period'),
        revenue: t('analytics.export.revenue'),
        debt: t('analytics.export.debt'),
        patients: t('analytics.export.patients'),
        visits: t('analytics.export.visits'),
        shareTitle: t('analytics.export.shareTitle'),
      })
      toast.success(t('analytics.export.ready'))
    } catch {
      toast.error(t('analytics.export.failed'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AppHeader
        title={t('analytics.title')}
        subtitle={t('analytics.subtitle')}
        onBack={navigation.canGoBack?.() ? () => navigation.goBack() : undefined}
        backLabel={t('common.back')}
        showProfile
        actions={
          canExport ? (
            <HeaderIconButton
              icon="download-outline"
              label={t('analytics.export.action')}
              onPress={handleExport}
              disabled={!analytics}
              loading={exporting}
            />
          ) : undefined
        }
      />

      {localCanAny ? (
        <View style={styles.controls}>
          <AnalyticsRangeSelector
            value={range}
            onChange={handleRangeChange}
            loading={
              analyticsQuery.isFetching &&
              !analyticsQuery.isLoading &&
              !isRefreshing
            }
          />
          {canPayments ? (
            <AnalyticsCurrencySelector
              value={currency}
              onChange={setCurrency}
            />
          ) : null}
        </View>
      ) : null}

      {!localCanAny ? (
        <View style={styles.center}>
          <EmptyState iconName="lock-closed-outline" title={t('dashboard.noAccess')} tone="warning" />
        </View>
      ) : analyticsQuery.isLoading ? (
        <AnalyticsLoadingState
          financial={localCanPayments}
          patients={localCanPatients}
          visits={localCanAppointments || localCanPayments}
          wide={wideLayout}
        />
      ) : analyticsQuery.isError ? (
        <View style={styles.center}>
          <EmptyState
            iconName="alert-circle-outline"
            title={t('analytics.loadFailed')}
            tone="danger"
            action={
              <Button
                title={t('common.retry')}
                variant="secondary"
                onPress={() => analyticsQuery.refetch()}
                fullWidth
              />
            }
          />
        </View>
      ) : (
        <ScrollView
          testID="analytics-scroll"
          contentContainerStyle={[
            styles.content,
            {
              paddingBottom: getFloatingTabBarContentInset(insets.bottom),
            },
          ]}
          refreshControl={
            <RefreshControl
              testID="analytics-refresh-control"
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={c.brand as string}
            />
          }
        >
          <View style={styles.grid}>
            {canPayments ? (
              <>
                <AnalyticsKpiCard
                  label={t('analytics.kpi.revenue')}
                  description={t('analytics.kpiDescription.revenue')}
                  value={`${revenueParts.value} ${revenueParts.unit}`}
                  delta={kpis.revenue.delta}
                  icon="wallet-outline"
                  accent="teal"
                  wide={wideLayout}
                />
                <AnalyticsKpiCard
                  label={t('analytics.kpi.debt')}
                  description={t('analytics.kpiDescription.debt')}
                  value={`${debtParts.value} ${debtParts.unit}`}
                  delta={null}
                  tone="negative"
                  icon="cash-outline"
                  accent="rose"
                  wide={wideLayout}
                />
              </>
            ) : null}
            {canPatients ? (
              <AnalyticsKpiCard
                label={t('analytics.kpi.patients')}
                description={t('analytics.kpiDescription.patients')}
                value={String(kpis.patients.current)}
                delta={kpis.patients.delta}
                icon="people-outline"
                accent="blue"
                wide={wideLayout}
              />
            ) : null}
            {canVisits ? (
              <AnalyticsKpiCard
                label={t('analytics.kpi.visits')}
                description={t('analytics.kpiDescription.visits')}
                value={String(kpis.visits.current)}
                delta={kpis.visits.delta}
                icon="checkmark-circle-outline"
                accent="emerald"
                wide={wideLayout}
              />
            ) : null}
          </View>

          {canPayments && revenueSeries.length >= 2 ? (
            <View style={styles.section}>
              <AnalyticsTrendCard
                title={t('analytics.revenueTrendTitle')}
                rangeLabel={rangeLabel}
                data={revenueSeries}
                width={chartWidth}
                color="#14B8A6"
                icon="trending-up-outline"
                startValue={formatMoney(revenueSeries[0] ?? 0)}
                endValue={formatMoney(revenueSeries[revenueSeries.length - 1] ?? 0)}
              />
            </View>
          ) : null}

          {canAppointments ? (
            <View style={styles.section}>
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleWrap}>
                    <View style={styles.sectionIcon}>
                      <Icon name="pie-chart-outline" size={17} color={c.brand as string} />
                    </View>
                    <Text style={styles.sectionTitle}>{t('analytics.statusTitle')}</Text>
                  </View>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{statusTotal}</Text>
                  </View>
                </View>

                {statusTotal > 0 ? (
                  <View
                    style={styles.statusDistribution}
                    accessible
                    accessibilityRole="image"
                    accessibilityLabel={STATUS_ORDER.map(
                      (status) => `${t(`analytics.status.${status}`)}: ${statusCounts[status]}`
                    ).join(', ')}
                  >
                    {STATUS_ORDER.map((status) =>
                      statusCounts[status] > 0 ? (
                        <View
                          key={status}
                          style={[
                            styles.statusSegment,
                            {
                              flexGrow: statusCounts[status],
                              backgroundColor: STATUS_COLOR[status],
                            },
                          ]}
                        />
                      ) : null
                    )}
                  </View>
                ) : null}

                <View style={styles.statusGrid}>
                  {STATUS_ORDER.map((status) => (
                    <View
                      key={status}
                      style={styles.statusCell}
                      accessible
                      accessibilityLabel={`${t(`analytics.status.${status}`)}: ${statusCounts[status]}`}
                    >
                      <View style={[styles.dot, { backgroundColor: STATUS_COLOR[status] }]} />
                      <Text
                        style={styles.statusLabel}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.78}
                      >
                        {t(`analytics.status.${status}`)}
                      </Text>
                      <Text style={styles.statusCount}>{statusCounts[status]}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ) : null}

          {canPatients && growthSeries.length >= 2 ? (
            <View style={styles.section}>
              <AnalyticsTrendCard
                title={t('analytics.patientGrowthTitle')}
                rangeLabel={rangeLabel}
                data={growthSeries}
                width={chartWidth}
                color="#3B82F6"
                icon="people-outline"
                startValue={String(growthSeries[0] ?? 0)}
                endValue={String(growthSeries[growthSeries.length - 1] ?? 0)}
              />
            </View>
          ) : null}

          {canPayments ? (
            <View style={styles.section}>
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleWrap}>
                    <View style={[styles.sectionIcon, styles.sectionIconDanger]}>
                      <Icon name="alert-circle-outline" size={17} color="#C7464D" />
                    </View>
                    <View style={styles.sectionHeadingCopy}>
                      <Text style={styles.sectionTitle}>{t('analytics.topDebtorsTitle')}</Text>
                      {topDebtors.length > 0 ? (
                        <Text style={styles.sectionSubtitle}>
                          {formatMoney(
                            topDebtors.reduce((total, debtor) => total + debtor.debt, 0)
                          )}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <Pressable
                    onPress={openOutstandingDebts}
                    style={({ pressed }) => [
                      styles.debtorsAction,
                      pressed && styles.debtorsActionPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={t('analytics.allDebts')}
                  >
                    <Text style={styles.debtorsActionText}>{t('analytics.allDebts')}</Text>
                    <Icon name="chevron-forward" size={13} color={c.brand as string} />
                  </Pressable>
                </View>

                {topDebtors.length === 0 ? (
                  <View style={styles.emptyRow}>
                    <Icon name="checkmark-circle-outline" size={18} color={c.success as string} />
                    <Text style={styles.emptyText}>{t('analytics.topDebtorsEmpty')}</Text>
                  </View>
                ) : (
                  topDebtors.map((debtor, index) => {
                    const phone = formatStoredPhone(debtor.phone)
                    return (
                      <React.Fragment key={`${debtor.name}-${debtor.phone}-${index}`}>
                        <View
                          style={styles.debtorRow}
                          accessible
                          accessibilityLabel={`${index + 1}. ${debtor.name}. ${formatMoney(debtor.debt)}`}
                        >
                          <View style={styles.debtorRank}>
                            <Text style={styles.debtorRankText}>{index + 1}</Text>
                          </View>
                          <View style={styles.debtorCopy}>
                            <Text style={styles.debtorName} numberOfLines={1}>
                              {debtor.name}
                            </Text>
                            {phone ? (
                              <Text style={styles.debtorPhone} numberOfLines={1}>
                                {phone}
                              </Text>
                            ) : null}
                          </View>
                          <Text
                            style={styles.debtorDebt}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.7}
                          >
                            {formatMoney(debtor.debt)}
                          </Text>
                        </View>
                        {index < topDebtors.length - 1 ? (
                          <View style={styles.rowDivider} />
                        ) : null}
                      </React.Fragment>
                    )
                  })
                )}
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  )
}

function AnalyticsLoadingState({
  financial,
  patients,
  visits,
  wide,
}: {
  financial: boolean
  patients: boolean
  visits: boolean
  wide: boolean
}) {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const cardCount = (financial ? 2 : 0) + (patients ? 1 : 0) + (visits ? 1 : 0)

  return (
    <View
      style={styles.loadingContent}
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
    >
      <View style={styles.grid}>
        {Array.from({ length: cardCount }).map((_, index) => (
          <Skeleton
            key={index}
            height={108}
            borderRadius={radius.xl}
            style={[styles.loadingKpi, wide && styles.loadingKpiWide]}
          />
        ))}
      </View>
      <Skeleton width="100%" height={150} borderRadius={radius.xl} />
      <Skeleton width="100%" height={150} borderRadius={radius.xl} />
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.groupedBackground ?? c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    controls: {
      width: '100%',
      maxWidth: ANALYTICS_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
      paddingHorizontal: spacing.md,
    },
    content: {
      width: '100%',
      maxWidth: ANALYTICS_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
      padding: spacing.md,
    },
    loadingContent: {
      width: '100%',
      maxWidth: ANALYTICS_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
      gap: 10,
      padding: spacing.md,
    },
    loadingKpi: {
      width: '47.8%',
      flexGrow: 1,
    },
    loadingKpiWide: {
      width: '23.4%',
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    section: { marginTop: 10 },
    sectionCard: {
      overflow: 'hidden',
      backgroundColor: c.background,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.brandSoft,
      ...shadows.sm,
    },
    sectionHeader: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingHorizontal: 12,
      paddingTop: 6,
    },
    sectionTitleWrap: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sectionHeadingCopy: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    sectionSubtitle: {
      fontFamily: font('600'),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: '600',
      color: c.labelTertiary,
    },
    debtorsAction: {
      minHeight: 36,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: 8,
      borderRadius: radius.md,
      backgroundColor: c.brandSurface,
    },
    debtorsActionPressed: {
      opacity: 0.72,
    },
    debtorsActionText: {
      fontFamily: font('700'),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: '700',
      color: c.brand,
    },
    sectionIcon: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
      backgroundColor: c.brandSurface,
    },
    sectionIconDanger: {
      backgroundColor: '#FFF1F2',
    },
    sectionTitle: {
      flex: 1,
      minWidth: 0,
      fontFamily: font('700'),
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '700',
      color: c.label,
    },
    countBadge: {
      minWidth: 28,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
      borderRadius: radius.pill,
      backgroundColor: c.fillQuaternary,
    },
    countBadgeText: {
      fontFamily: font('700'),
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '700',
      color: c.labelSecondary,
    },
    statusDistribution: {
      height: 7,
      flexDirection: 'row',
      gap: 2,
      overflow: 'hidden',
      marginHorizontal: 12,
      marginTop: 3,
      borderRadius: radius.pill,
      backgroundColor: c.fillQuaternary,
    },
    statusSegment: {
      flexBasis: 0,
      minWidth: 3,
      borderRadius: radius.pill,
    },
    statusGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      padding: 10,
    },
    statusCell: {
      width: '48.8%',
      minHeight: 38,
      flexGrow: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: radius.md,
      backgroundColor: c.backgroundTertiary,
    },
    dot: { width: 8, height: 8, flexShrink: 0, borderRadius: 4 },
    statusLabel: {
      flex: 1,
      minWidth: 0,
      fontFamily: font('500'),
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '500',
      color: c.labelSecondary,
    },
    statusCount: {
      fontFamily: font('700'),
      fontSize: 13,
      lineHeight: 16,
      fontWeight: '700',
      color: c.label,
    },
    rowDivider: {
      height: StyleSheet.hairlineWidth,
      marginLeft: 52,
      backgroundColor: c.separator,
    },
    debtorRow: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    debtorRank: {
      width: 30,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
      backgroundColor: c.brandSurface,
    },
    debtorRankText: {
      fontFamily: font('700'),
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '700',
      color: c.brand,
    },
    debtorCopy: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    debtorName: {
      fontFamily: font('600'),
      fontSize: 13,
      lineHeight: 17,
      fontWeight: '600',
      color: c.label,
    },
    debtorPhone: {
      fontFamily: font('400'),
      fontSize: 10.5,
      lineHeight: 13,
      fontWeight: '400',
      color: c.labelTertiary,
    },
    debtorDebt: {
      maxWidth: '38%',
      fontFamily: font('700'),
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '700',
      color: '#C7464D',
      textAlign: 'right',
    },
    emptyRow: {
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    emptyText: {
      ...typography.subhead,
      color: c.labelSecondary,
    },
  })
}
