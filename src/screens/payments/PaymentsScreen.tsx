import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useQuery } from '@tanstack/react-query'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as Haptics from 'expo-haptics'

import FinanceCard from '../../components/dashboard/FinanceCard'
import SearchBar from '../../components/ui/SearchBar'
import SegmentedControl from '../../components/ui/SegmentedControl'
import EmptyState from '../../components/ui/EmptyState'
import FadeSwitch from '../../components/ui/FadeSwitch'
import FadeInRow from '../../components/ui/FadeInRow'
import { ListRowSkeleton } from '../../components/ui/Skeleton'
import PatientDebtRow, { PatientDebtData } from '../../components/payments/PatientDebtRow'
import TreatmentHistoryRow from '../../components/payments/TreatmentHistoryRow'
import TreatmentDetailSheet from '../../components/payments/TreatmentDetailSheet'
import { TreatmentEditSheet } from '../../components/treatments'
import { useToast } from '../../components/ui/Toast'

import { useI18n } from '../../i18n'
import { useAuthStore } from '../../stores/auth'
import { useThemeStore } from '../../stores/theme'
import { useNetworkStore } from '../../stores/network'
import { canView } from '../../lib/permissions'
import { listTreatments } from '../../api/treatments'
import { formatCurrencyParts } from '../../lib/format'
import { spacing, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import type { ApiTreatment } from '../../types'
import type { MainStackParams } from '../../navigation'

type Tab = 'patients' | 'history'
type Nav = NativeStackNavigationProp<MainStackParams>

export default function PaymentsScreen() {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const effective = useThemeStore((s) => s.effective)
  const user = useAuthStore((s) => s.user)
  const toast = useToast()
  const navigation = useNavigation<Nav>()

  const canViewPayments = canView(user, 'payments')
  const isOnline = useNetworkStore((s) => s.isOnline)

  const [tab, setTab] = useState<Tab>('patients')
  const [search, setSearch] = useState('')
  const [selectedTreatment, setSelectedTreatment] = useState<ApiTreatment | null>(null)
  // Separate state for the edit-mode sheet — detail and edit can't be open
  // simultaneously (we close detail before opening edit) but each needs its
  // own treatment reference so the right one renders during the animation
  // handoff.
  const [editTreatment, setEditTreatment] = useState<ApiTreatment | null>(null)
  const [treatmentSheetOpen, setTreatmentSheetOpen] = useState(false)

  const query = useQuery({
    queryKey: ['treatments', 'list'],
    queryFn: () => listTreatments({}),
    enabled: canViewPayments,
    staleTime: 60_000,
  })

  const treatments = query.data?.data ?? []
  const isLoading = query.isLoading && !query.data
  const isRefreshing = query.isFetching && Boolean(query.data)

  // Aggregate by patient
  const patientGroups: PatientDebtData[] = useMemo(() => {
    const map = new Map<string, PatientDebtData>()
    for (const tr of treatments) {
      const existing = map.get(tr.patient_id)
      if (existing) {
        existing.totalDebt += tr.debt_amount
        existing.totalPaid += tr.paid_amount
        existing.balance += tr.balance
        existing.entryCount += 1
        if (
          !existing.lastEntryDate ||
          tr.treatment_date > existing.lastEntryDate
        ) {
          existing.lastEntryDate = tr.treatment_date
        }
      } else {
        map.set(tr.patient_id, {
          patientId: tr.patient_id,
          patientName: tr.patient_name ?? '—',
          totalDebt: tr.debt_amount,
          totalPaid: tr.paid_amount,
          balance: tr.balance,
          entryCount: 1,
          lastEntryDate: tr.treatment_date,
        })
      }
    }
    // Sort by absolute balance desc so big-debt and big-credit patients
    // both bubble to the top — matches the web /payments page which sorts
    // by |balance|. Previously credit (negative) patients sank to the
    // bottom even when their absolute amount was large.
    // Deterministic tiebreaks (match web): most recent entry first, then name —
    // so equal-balance patients keep a stable, identical order across platforms.
    return Array.from(map.values()).sort((a, b) => {
      const byBalance = Math.abs(b.balance) - Math.abs(a.balance)
      if (byBalance !== 0) return byBalance
      const aDate = a.lastEntryDate ?? ''
      const bDate = b.lastEntryDate ?? ''
      if (aDate !== bDate) return bDate.localeCompare(aDate)
      return a.patientName.localeCompare(b.patientName)
    })
  }, [treatments])

  const totals = useMemo(() => {
    let debt = 0
    let paid = 0
    for (const tr of treatments) {
      debt += tr.debt_amount
      paid += tr.paid_amount
    }
    return { debt, paid, balance: debt - paid }
  }, [treatments])

  const filteredPatients = useMemo(() => {
    if (!search.trim()) return patientGroups
    const q = search.trim().toLowerCase()
    return patientGroups.filter((g) => g.patientName.toLowerCase().includes(q))
  }, [patientGroups, search])

  const filteredTreatments = useMemo(() => {
    if (!search.trim()) return treatments
    const q = search.trim().toLowerCase()
    return treatments.filter(
      (t) =>
        (t.patient_name ?? '').toLowerCase().includes(q) ||
        t.treatment_type.toLowerCase().includes(q)
    )
  }, [treatments, search])

  const onRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    query.refetch()
  }

  const onOpenPatient = (id: string) => {
    Haptics.selectionAsync()
    navigation.navigate('PatientDetail', { id })
  }

  const onOpenTreatment = (id: string) => {
    const tr = treatments.find((t) => t.id === id)
    if (!tr) return
    Haptics.selectionAsync()
    setSelectedTreatment(tr)
    setTreatmentSheetOpen(true)
  }

  const debtParts = formatCurrencyParts(totals.debt, locale)
  const paidParts = formatCurrencyParts(totals.paid, locale)
  const balanceParts = formatCurrencyParts(totals.balance, locale)

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
          <Text style={styles.title} numberOfLines={1}>{t('payments.title')}</Text>
        </View>

        {/* Summary cards */}
        {canViewPayments ? (
          <View style={styles.summaryRow}>
            <FinanceCard
              iconName="trending-up-outline"
              label={t('payments.summary.totalPaid')}
              value={paidParts.value}
              unit={paidParts.unit}
              tone="success"
            />
            <FinanceCard
              iconName="warning-outline"
              label={t('payments.summary.totalDebt')}
              value={debtParts.value}
              unit={debtParts.unit}
              tone={totals.debt > 0 ? 'danger' : 'success'}
            />
            <FinanceCard
              iconName="wallet-outline"
              label={t('payments.summary.netBalance')}
              value={balanceParts.value}
              unit={balanceParts.unit}
              tone={
                totals.balance > 0 ? 'warning' :
                totals.balance < 0 ? 'success' :
                'neutral'
              }
            />
          </View>
        ) : null}

        {/* Tab toggle */}
        {canViewPayments ? (
          <View style={styles.toggleWrap}>
            <SegmentedControl<Tab>
              options={[
                { value: 'patients', label: t('payments.tabs.patients') },
                { value: 'history', label: t('payments.tabs.history') },
              ]}
              value={tab}
              onChange={(v) => {
                setSearch('')
                setTab(v)
              }}
            />
          </View>
        ) : null}

        {/* Search */}
        {canViewPayments ? (
          <View style={styles.searchWrap}>
            <SearchBar
              value={search}
              onChangeText={setSearch}
              placeholder={
                tab === 'patients'
                  ? t('payments.search.patient')
                  : t('payments.search.history')
              }
            />
          </View>
        ) : null}

        {/* Content */}
        <FadeSwitch watch={tab}>
        {!canViewPayments ? (
          <View style={styles.center}>
            <EmptyState
              iconName="lock-closed-outline"
              title={t('dashboard.noAccess')}
              tone="warning"
            />
          </View>
        ) : isLoading ? (
          <View style={styles.skeletonWrap}>
            {Array.from({ length: 8 }).map((_, i) => (
              <React.Fragment key={i}>
                <ListRowSkeleton />
                {i < 7 ? <View style={styles.rowSep} /> : null}
              </React.Fragment>
            ))}
          </View>
        ) : query.isError ? (
          <View style={styles.center}>
            <EmptyState
              iconName={isOnline ? 'cloud-offline-outline' : 'cloud-offline'}
              title={isOnline ? t('payments.loadFailed') : t('network.offline')}
              subtitle={!isOnline ? t('network.offlineHint') : undefined}
              tone={isOnline ? 'danger' : 'warning'}
            />
          </View>
        ) : tab === 'patients' ? (
          filteredPatients.length === 0 ? (
            <View style={styles.center}>
              <EmptyState
                iconName={search ? 'search-outline' : 'people-outline'}
                title={
                  search
                    ? t('payments.empty.filtered')
                    : t('payments.empty.patients')
                }
                subtitle={!search ? t('payments.empty.patientsSub') : undefined}
              />
            </View>
          ) : (
            <FlatList
              data={filteredPatients}
              keyExtractor={(p) => p.patientId}
              renderItem={({ item, index }) => (
                <FadeInRow index={index}>
                  <PatientDebtRow data={item} onPress={() => onOpenPatient(item.patientId)} />
                </FadeInRow>
              )}
              ItemSeparatorComponent={() => <View style={styles.rowSeparator} />}
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
        ) : filteredTreatments.length === 0 ? (
          <View style={styles.center}>
            <EmptyState
              iconName={search ? 'search-outline' : 'time-outline'}
              title={
                search ? t('payments.empty.filtered') : t('payments.empty.history')
              }
              subtitle={!search ? t('payments.empty.historySub') : undefined}
            />
          </View>
        ) : (
          <FlatList
            data={filteredTreatments}
            keyExtractor={(t: ApiTreatment) => t.id}
            renderItem={({ item, index }) => (
              <FadeInRow index={index}>
                <TreatmentHistoryRow
                  treatment={item}
                  onPress={() => onOpenTreatment(item.id)}
                />
              </FadeInRow>
            )}
            ItemSeparatorComponent={() => <View style={styles.rowSeparator} />}
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
        )}
        </FadeSwitch>
      </SafeAreaView>

      <TreatmentDetailSheet
        visible={treatmentSheetOpen}
        treatment={selectedTreatment}
        onClose={() => setTreatmentSheetOpen(false)}
        onUpdated={(updated) => setSelectedTreatment(updated)}
        onEditRequested={(tr) => {
          // Defer the edit sheet open by one frame so the detail sheet's
          // dismiss animation finishes first (otherwise two backdrops stack
          // and the entry sheet appears under the previous one on iOS).
          setTreatmentSheetOpen(false)
          setTimeout(() => setEditTreatment(tr), 220)
        }}
      />

      <TreatmentEditSheet
        visible={editTreatment !== null}
        patientId={editTreatment?.patient_id ?? ''}
        treatment={editTreatment}
        onClose={() => setEditTreatment(null)}
      />
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    flex: { flex: 1 },
    header: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
    },
    title: {
      ...typography.title1,
      color: c.brandDeep,
    },
    summaryRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
      marginBottom: spacing.md,
    },
    toggleWrap: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.sm,
    },
    searchWrap: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.sm,
    },
    listContent: {
      paddingBottom: 120,
    },
    rowSeparator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.separator as string,
      marginLeft: 20 + 40 + 12,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    skeletonWrap: {
      paddingTop: 4,
    },
    rowSep: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.separator as string,
      marginLeft: 14 + 42 + 12,
    },
  })
}
