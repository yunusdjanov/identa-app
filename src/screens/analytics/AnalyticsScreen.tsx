import React, { useMemo, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

import Icon from '../../components/ui/Icon'
import EmptyState from '../../components/ui/EmptyState'
import { useI18n } from '../../i18n'
import { useAuthStore } from '../../stores/auth'
import { canView, canViewAnalytics } from '../../lib/permissions'
import { listTreatments } from '../../api/treatments'
import { listAppointments } from '../../api/appointments'
import { listPatients } from '../../api/patients'
import { getDashboardSnapshot } from '../../api/dashboard'
import {
  ANALYTICS_RANGES,
  DEFAULT_ANALYTICS_RANGE,
  computeAnalyticsKpis,
  computeAppointmentStatusCounts,
  computeTopDebtors,
  type AnalyticsRange,
  type KpiValue,
} from '../../lib/analytics'
import { formatCurrencyParts, toLocalDateKey } from '../../lib/format'
import type { Locale } from '../../constants'
import { font, radius, spacing, typography } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import type { MainStackParams } from '../../navigation'

const STATUS_ORDER = ['scheduled', 'completed', 'cancelled', 'no_show'] as const
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
  const styles = useMemo(() => makeStyles(c), [c])
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParams>>()
  const user = useAuthStore((s) => s.user)

  const canPayments = canView(user, 'payments')
  const canPatients = canView(user, 'patients')
  const canAppointments = canView(user, 'appointments')
  const canAny = canViewAnalytics(user)

  const [range, setRange] = useState<AnalyticsRange>(DEFAULT_ANALYTICS_RANGE)
  const todayKey = useMemo(() => toLocalDateKey(new Date()), [])

  const treatmentsQuery = useQuery({
    queryKey: ['analytics', 'treatments'],
    queryFn: () => listTreatments({ per_page: 500 }),
    enabled: canAny && canPayments,
    staleTime: 60_000,
  })
  const patientsQuery = useQuery({
    queryKey: ['analytics', 'patients'],
    queryFn: () => listPatients({ per_page: 500 }),
    enabled: canAny && canPatients,
    staleTime: 60_000,
  })
  const appointmentsQuery = useQuery({
    queryKey: ['analytics', 'appointments'],
    queryFn: () => listAppointments({ per_page: 500 }),
    enabled: canAny && canAppointments,
    staleTime: 60_000,
  })
  const snapshotQuery = useQuery({
    queryKey: ['dashboard', 'snapshot', todayKey],
    queryFn: () => getDashboardSnapshot(todayKey),
    enabled: canAny && canPayments,
    staleTime: 60_000,
  })

  const isLoading =
    (canPayments && (treatmentsQuery.isLoading || snapshotQuery.isLoading)) ||
    (canPatients && patientsQuery.isLoading) ||
    (canAppointments && appointmentsQuery.isLoading)

  const isError =
    treatmentsQuery.isError ||
    patientsQuery.isError ||
    appointmentsQuery.isError ||
    snapshotQuery.isError

  const kpis = useMemo(
    () =>
      computeAnalyticsKpis({
        range,
        treatments: treatmentsQuery.data?.data ?? [],
        patients: patientsQuery.data?.data ?? [],
        appointments: appointmentsQuery.data?.data ?? [],
        outstandingDebtTotal: snapshotQuery.data?.outstanding_debt_total ?? 0,
      }),
    [range, treatmentsQuery.data, patientsQuery.data, appointmentsQuery.data, snapshotQuery.data]
  )

  const revenueParts = formatCurrencyParts(kpis.revenue.current, locale as Locale)
  const debtParts = formatCurrencyParts(kpis.debt.current, locale as Locale)

  const statusCounts = useMemo(
    () => computeAppointmentStatusCounts(appointmentsQuery.data?.data ?? [], range),
    [appointmentsQuery.data, range]
  )
  const topDebtors = useMemo(
    () => computeTopDebtors(treatmentsQuery.data?.data ?? [], range),
    [treatmentsQuery.data, range]
  )

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.backBtn}>
          <Icon name="chevron-back" size={24} color={c.label as string} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('analytics.title')}</Text>
          <Text style={styles.subtitle}>{t('analytics.subtitle')}</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rangeRow}
      >
        {ANALYTICS_RANGES.map((r) => {
          const active = r === range
          return (
            <Pressable
              key={r}
              onPress={() => setRange(r)}
              style={[styles.rangeChip, active && { backgroundColor: c.brand, borderColor: c.brand }]}
            >
              <Text style={[styles.rangeText, active && styles.rangeTextActive]}>
                {t(`analytics.range.${r}`)}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {!canAny ? (
        <View style={styles.center}>
          <EmptyState iconName="lock-closed-outline" title={t('dashboard.noAccess')} tone="warning" />
        </View>
      ) : isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.brand as string} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <EmptyState iconName="alert-circle-outline" title={t('analytics.loadFailed')} tone="danger" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}>
          <View style={styles.grid}>
            <KpiCard
              c={c}
              styles={styles}
              t={t}
              label={t('analytics.kpi.revenue')}
              value={`${revenueParts.value} ${revenueParts.unit}`}
              kpi={kpis.revenue}
              locked={!canPayments}
            />
            <KpiCard
              c={c}
              styles={styles}
              t={t}
              label={t('analytics.kpi.debt')}
              value={`${debtParts.value} ${debtParts.unit}`}
              kpi={null}
              locked={!canPayments}
            />
            <KpiCard
              c={c}
              styles={styles}
              t={t}
              label={t('analytics.kpi.patients')}
              value={String(kpis.patients.current)}
              kpi={kpis.patients}
              locked={!canPatients}
            />
            <KpiCard
              c={c}
              styles={styles}
              t={t}
              label={t('analytics.kpi.completion')}
              value={`${Math.round(kpis.completion.current)}%`}
              kpi={kpis.completion}
              locked={!canAppointments}
            />
          </View>

          {canAppointments ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('analytics.statusTitle')}</Text>
              <View style={styles.sectionCard}>
                {STATUS_ORDER.map((s, i) => (
                  <View
                    key={s}
                    style={[styles.statusRow, i < STATUS_ORDER.length - 1 && styles.rowDivider]}
                  >
                    <View style={[styles.dot, { backgroundColor: STATUS_COLOR[s] }]} />
                    <Text style={styles.statusLabel}>{t(`analytics.status.${s}`)}</Text>
                    <Text style={styles.statusCount}>{statusCounts[s]}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {canPayments ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('analytics.topDebtorsTitle')}</Text>
              {topDebtors.length === 0 ? (
                <Text style={styles.emptyText}>{t('analytics.topDebtorsEmpty')}</Text>
              ) : (
                <View style={styles.sectionCard}>
                  {topDebtors.map((d, i) => {
                    const parts = formatCurrencyParts(d.debt, locale as Locale)
                    return (
                      <View
                        key={d.patientId}
                        style={[styles.debtorRow, i < topDebtors.length - 1 && styles.rowDivider]}
                      >
                        <Text style={styles.debtorRank}>{i + 1}</Text>
                        <Text style={styles.debtorName} numberOfLines={1}>
                          {d.name}
                        </Text>
                        <Text style={styles.debtorDebt}>
                          {parts.value} {parts.unit}
                        </Text>
                      </View>
                    )
                  })}
                </View>
              )}
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  )
}

function KpiCard({
  c,
  styles,
  t,
  label,
  value,
  kpi,
  locked,
}: {
  c: Colors
  styles: ReturnType<typeof makeStyles>
  t: (k: string) => string
  label: string
  value: string
  kpi: KpiValue | null
  locked: boolean
}) {
  if (locked) {
    return (
      <View style={styles.card}>
        <View style={styles.lockRow}>
          <Icon name="lock-closed-outline" size={14} color={c.labelTertiary as string} />
          <Text style={styles.cardLabel}>{label}</Text>
        </View>
        <Text style={styles.lockedValue}>{t('dashboard.noAccess')}</Text>
      </View>
    )
  }
  const delta = kpi?.delta ?? null
  const up = delta != null && delta >= 0
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue} numberOfLines={1}>
        {value}
      </Text>
      {kpi === null ? (
        <Text style={styles.deltaNeutral}>—</Text>
      ) : delta == null ? (
        <Text style={styles.deltaNeutral}>{t('analytics.noBaseline')}</Text>
      ) : (
        <View style={styles.deltaRow}>
          <Icon
            name={up ? 'arrow-up' : 'arrow-down'}
            size={13}
            color={(up ? c.success : c.danger) as string}
          />
          <Text style={[styles.deltaText, { color: (up ? c.success : c.danger) as string }]}>
            {Math.abs(delta).toFixed(0)}%
          </Text>
        </View>
      )}
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.groupedBackground ?? c.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    backBtn: { padding: 4, marginLeft: -4 },
    title: { ...typography.title2, color: c.label },
    subtitle: { ...typography.footnote, color: c.labelSecondary },
    rangeRow: { gap: 8, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
    rangeChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radius.pill,
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.separator as string,
    },
    rangeText: { ...typography.subhead, color: c.labelSecondary, fontWeight: '600' },
    rangeTextActive: { color: '#FFFFFF' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    card: {
      width: '47.8%',
      flexGrow: 1,
      backgroundColor: c.background,
      borderRadius: radius.xl,
      padding: spacing.md,
      gap: 6,
      borderWidth: 1,
      borderColor: c.separator as string,
    },
    cardLabel: { ...typography.footnote, color: c.labelSecondary },
    cardValue: { ...typography.title2, color: c.label, fontFamily: font('700'), fontWeight: '700' },
    deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    deltaText: { ...typography.caption1, fontWeight: '700' },
    deltaNeutral: { ...typography.caption1, color: c.labelTertiary },
    lockRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    lockedValue: { ...typography.subhead, color: c.labelTertiary },
    section: { marginTop: spacing.lg, gap: spacing.sm },
    sectionTitle: { ...typography.headline, color: c.label, paddingHorizontal: 2 },
    sectionCard: {
      backgroundColor: c.background,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: c.separator as string,
      paddingHorizontal: spacing.md,
    },
    rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.separator as string },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    statusLabel: { flex: 1, ...typography.body, color: c.label },
    statusCount: { ...typography.body, color: c.labelSecondary, fontFamily: font('700'), fontWeight: '700' },
    debtorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
    debtorRank: {
      width: 22,
      ...typography.footnote,
      color: c.labelTertiary,
      fontFamily: font('700'),
      fontWeight: '700',
    },
    debtorName: { flex: 1, ...typography.body, color: c.label },
    debtorDebt: { ...typography.subhead, color: c.danger, fontFamily: font('700'), fontWeight: '700' },
    emptyText: { ...typography.subhead, color: c.labelTertiary, paddingHorizontal: 2 },
  })
}
