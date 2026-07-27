import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SectionList,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as Haptics from 'expo-haptics'

import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import FadeInRow from '../../components/ui/FadeInRow'
import Icon from '../../components/ui/Icon'
import SearchBar from '../../components/ui/SearchBar'
import SegmentedControl from '../../components/ui/SegmentedControl'
import { ListRowSkeleton } from '../../components/ui/Skeleton'
import { useDialog } from '../../components/ui/Dialog'
import { useToast } from '../../components/ui/Toast'
import ExpenseFormSheet from '../../components/payments/ExpenseFormSheet'
import ExpenseRow from '../../components/payments/ExpenseRow'
import AppHeader, {
  HeaderIconButton,
} from '../../components/navigation/AppHeader'
import PatientDebtRow, { type PatientDebtData } from '../../components/payments/PatientDebtRow'
import { useI18n } from '../../i18n'
import { useAuthStore } from '../../stores/auth'
import { useThemeStore } from '../../stores/theme'
import { useNetworkStore } from '../../stores/network'
import { canExportData, canManage, canView } from '../../lib/permissions'
import { useDebouncedValue } from '../../lib/useDebouncedValue'
import {
  formatCurrencyParts,
  formatMonthYear,
  fromLocalDateKey,
} from '../../lib/format'
import { getPatientPhotoThumbnailUri } from '../../lib/patientPhoto'
import {
  deletePaymentExpense,
  listPaymentExpenses,
  listPaymentLedgerPatients,
  type MoneyCurrency,
  type PaymentExpense,
} from '../../api/payments'
import type { Locale } from '../../constants'
import { spacing, font, radius } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { useManualRefresh } from '../../lib/useManualRefresh'
import { getFloatingTabBarContentInset } from '../../constants/navigation'
import {
  buildPaymentExpensesPdfHtml,
  buildPaymentPatientsPdfHtml,
  exportFinanceListPdf,
  loadPaymentExpensesForExport,
  loadPaymentPatientsForExport,
  type FinanceListExportLabels,
} from '../../lib/financeListExport'
import type { MainStackParams, MainTabParams } from '../../navigation'
import type { RouteProp } from '@react-navigation/native'

type Tab = 'patients' | 'expenses'
type Nav = NativeStackNavigationProp<MainStackParams>
type ExpenseSection = {
  key: string
  title: string
  data: PaymentExpense[]
}
const PAGE_SIZE = 20
const CURRENCIES: MoneyCurrency[] = ['UZS', 'USD']

export default function PaymentsScreen({
  route,
}: {
  route?: RouteProp<MainTabParams, 'Payments'>
}) {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const effective = useThemeStore((state) => state.effective)
  const user = useAuthStore((state) => state.user)
  const isOnline = useNetworkStore((state) => state.isOnline)
  const navigation = useNavigation<Nav>()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const { confirm } = useDialog()
  const toast = useToast()

  const canViewPayments = canView(user, 'payments')
  const canManagePayments = canManage(user, 'payments')
  const canExportFinance = canExportData(user)

  const [tab, setTab] = useState<Tab>('patients')
  const [search, setSearch] = useState('')
  const [outstandingOnly, setOutstandingOnly] = useState(
    route?.params?.outstandingOnly === true
  )
  const [expenseFormOpen, setExpenseFormOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<PaymentExpense | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const debouncedSearch = useDebouncedValue(search.trim(), 350)

  useEffect(() => {
    if (!route?.params?.outstandingOnly) return
    setTab('patients')
    setOutstandingOnly(true)
  }, [route?.params?.outstandingOnly, route?.params?.requestId])

  const patientQuery = useInfiniteQuery({
    queryKey: ['payments', 'ledger', 'patients', debouncedSearch, outstandingOnly],
    queryFn: ({ pageParam }) =>
      listPaymentLedgerPatients({
        page: pageParam,
        per_page: PAGE_SIZE,
        search: debouncedSearch || undefined,
        outstanding: outstandingOnly,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const pagination = lastPage.meta.pagination
      return pagination.page < pagination.total_pages ? pagination.page + 1 : undefined
    },
    enabled: canViewPayments,
    staleTime: 30_000,
  })
  const patientSummaryQuery = useQuery({
    // Overall cards are deliberately isolated from list search, filters and
    // pagination. Only a real finance mutation or an explicit refresh should
    // change these values.
    queryKey: ['payments', 'summary', 'patients'],
    queryFn: () =>
      listPaymentLedgerPatients({
        page: 1,
        per_page: 1,
      }),
    enabled: canViewPayments,
    staleTime: 30_000,
  })

  const expenseQuery = useInfiniteQuery({
    queryKey: ['payments', 'expenses', debouncedSearch],
    queryFn: ({ pageParam }) =>
      listPaymentExpenses({
        page: pageParam,
        per_page: PAGE_SIZE,
        search: debouncedSearch || undefined,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const pagination = lastPage.meta.pagination
      return pagination.page < pagination.total_pages ? pagination.page + 1 : undefined
    },
    enabled: canViewPayments && tab === 'expenses',
    staleTime: 30_000,
  })
  const expenseSummaryQuery = useQuery({
    // Keep expense totals global as well; the searchable list has its own
    // filtered query and must never become the source for these cards.
    queryKey: ['payments', 'summary', 'expenses'],
    queryFn: () =>
      listPaymentExpenses({
        page: 1,
        per_page: 1,
      }),
    enabled: canViewPayments && tab === 'expenses',
    staleTime: 30_000,
  })

  const patientRows: PatientDebtData[] = useMemo(
    () =>
      (patientQuery.data?.pages.flatMap((page) => page.data) ?? []).map((row) => ({
        patientId: row.patient_id,
        patientName: row.patient_name,
        patientPhone: row.patient_phone ?? undefined,
        patientPhotoUri:
          getPatientPhotoThumbnailUri(row.patient_id) ?? undefined,
        totalDebt: row.total_debt,
        totalPaid: row.total_paid,
        balance: row.balance,
        balancesByCurrency: row.balances_by_currency,
        entryCount: row.entry_count,
      })),
    [patientQuery.data]
  )
  const expenseRows = useMemo(
    () => expenseQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [expenseQuery.data]
  )
  const expenseSections = useMemo(
    () => groupExpensesByMonth(expenseRows, locale),
    [expenseRows, locale]
  )
  const ledgerSummary = patientSummaryQuery.data?.meta.summary
  const expenseSummary = expenseSummaryQuery.data?.meta.summary
  const activeQuery = tab === 'patients' ? patientQuery : expenseQuery
  const activeSummaryQuery =
    tab === 'patients' ? patientSummaryQuery : expenseSummaryQuery
  const isLoading = activeQuery.isLoading && !activeQuery.data
  const {
    isRefreshing,
    onRefresh,
  } = useManualRefresh(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    return Promise.all([activeQuery.refetch(), activeSummaryQuery.refetch()])
  })
  const isError = activeQuery.isError && !activeQuery.data
  const rowsEmpty = tab === 'patients' ? patientRows.length === 0 : expenseRows.length === 0
  const hasActiveFilter =
    search.trim().length > 0 || (tab === 'patients' && outstandingOnly)
  const isSearchLoading =
    search.trim() !== debouncedSearch ||
    (debouncedSearch.length > 0 &&
      activeQuery.isFetching &&
      !activeQuery.isLoading &&
      !isRefreshing)

  const deleteExpenseMutation = useMutation({
    mutationFn: deletePaymentExpense,
    onSuccess: () => {
      toast.success(t('payments.expenses.deleted'))
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: () => toast.error(t('payments.expenses.deleteFailed')),
  })

  const requestDeleteExpense = async (expense: PaymentExpense) => {
    const accepted = await confirm({
      title: t('payments.expenses.deleteTitle'),
      message: t('payments.expenses.deleteConfirm', { title: expense.title }),
      confirmLabel: t('common.delete'),
      destructive: true,
    })
    if (accepted) deleteExpenseMutation.mutate(expense.id)
  }

  const openNewExpense = () => {
    setEditingExpense(null)
    setExpenseFormOpen(true)
  }

  const handleExport = async () => {
    if (
      !canExportFinance ||
      isExporting ||
      isSearchLoading ||
      rowsEmpty
    ) {
      return
    }
    setIsExporting(true)
    const labels: FinanceListExportLabels = {
      title:
        tab === 'patients'
          ? t('payments.title')
          : t('payments.tabs.expenses'),
      generatedAt: t('payments.patientLedger.export.generatedAt'),
      patient: t('payments.patientLedger.export.patient'),
      phone: t('payments.patientLedger.export.phone'),
      entries: t('payments.patientLedger.export.entries'),
      workPrice: t('payments.patientLedger.workPrice'),
      paid: t('payments.patientLedger.paid'),
      balance: t('payments.patient.balance'),
      debt: t('payments.patient.debt'),
      advance: t('payments.patient.advance'),
      date: t('payments.expenses.date'),
      expense: t('payments.expenses.title'),
      quantity: t('payments.expenses.quantity'),
      amount: t('payments.expenses.amount'),
      empty:
        tab === 'patients'
          ? t('payments.empty.patients')
          : t('payments.empty.expenses'),
      shareTitle: t('payments.patientLedger.export.shareTitle'),
    }

    try {
      const html =
        tab === 'patients'
          ? buildPaymentPatientsPdfHtml(
              await loadPaymentPatientsForExport({
                search: search.trim() || undefined,
                outstanding: outstandingOnly,
              }),
              locale,
              labels
            )
          : buildPaymentExpensesPdfHtml(
              await loadPaymentExpensesForExport({
                search: search.trim() || undefined,
              }),
              locale,
              labels
            )
      await exportFinanceListPdf(html, labels.shareTitle)
      toast.success(t('payments.patientLedger.export.ready'))
    } catch {
      toast.error(t('payments.patientLedger.export.failed'))
    } finally {
      setIsExporting(false)
    }
  }

  const gradientColors: [string, string, string] =
    effective === 'dark'
      ? [c.background, c.background, c.background]
      : [c.brandSurface, '#FFFFFF', '#FFFFFF']

  return (
    <View style={styles.root}>
      <LinearGradient colors={gradientColors} locations={[0, 0.2, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <StatusBar barStyle={effective === 'dark' ? 'light-content' : 'dark-content'} />

        <AppHeader
          title={t('payments.title')}
          showProfile
          actions={
            <HeaderIconButton
              icon="download-outline"
              label={t('payments.patientLedger.export.action')}
              onPress={() => {
                void handleExport()
              }}
              disabled={
                !canExportFinance ||
                rowsEmpty ||
                isLoading ||
                isError ||
                isSearchLoading
              }
              loading={isExporting}
            />
          }
        />

        {canViewPayments ? (
          <>
            {tab === 'patients' ? (
              <View style={styles.summaryRow}>
                <SummaryCard
                  label={t('payments.summary.totalDebt')}
                  icon="receipt-outline"
                  tone="danger"
                  values={currencySummary(ledgerSummary?.totals_by_currency, 'total_debt')}
                  loading={patientSummaryQuery.isLoading && !patientSummaryQuery.data}
                  unavailable={patientSummaryQuery.isError && !patientSummaryQuery.data}
                />
                <SummaryCard
                  label={t('payments.summary.totalPaid')}
                  icon="arrow-down-circle-outline"
                  tone="success"
                  values={currencySummary(ledgerSummary?.totals_by_currency, 'total_paid')}
                  loading={patientSummaryQuery.isLoading && !patientSummaryQuery.data}
                  unavailable={patientSummaryQuery.isError && !patientSummaryQuery.data}
                />
                <SummaryCard
                  label={t('payments.summary.netBalance')}
                  icon="wallet-outline"
                  tone="warning"
                  values={currencySummary(ledgerSummary?.totals_by_currency, 'total_balance')}
                  loading={patientSummaryQuery.isLoading && !patientSummaryQuery.data}
                  unavailable={patientSummaryQuery.isError && !patientSummaryQuery.data}
                />
              </View>
            ) : (
              <View style={styles.summaryRow}>
                <SummaryCard
                  label={t('payments.summary.expenseTotal')}
                  icon="receipt-outline"
                  tone="danger"
                  values={simpleCurrencySummary(expenseSummary?.totals_by_currency)}
                  loading={expenseSummaryQuery.isLoading && !expenseSummaryQuery.data}
                  unavailable={expenseSummaryQuery.isError && !expenseSummaryQuery.data}
                />
                <SummaryCard
                  label={t('payments.summary.expenseCurrentMonth')}
                  icon="calendar-outline"
                  tone="warning"
                  values={simpleCurrencySummary(expenseSummary?.current_month_by_currency)}
                  loading={expenseSummaryQuery.isLoading && !expenseSummaryQuery.data}
                  unavailable={expenseSummaryQuery.isError && !expenseSummaryQuery.data}
                />
                <SummaryCard
                  label={t('payments.summary.expenseRecords')}
                  icon="list-outline"
                  tone="neutral"
                  count={expenseSummary?.total_count ?? 0}
                  loading={expenseSummaryQuery.isLoading && !expenseSummaryQuery.data}
                  unavailable={expenseSummaryQuery.isError && !expenseSummaryQuery.data}
                />
              </View>
            )}

            <View style={styles.toggleWrap}>
              <SegmentedControl<Tab>
                options={[
                  { value: 'patients', label: t('payments.tabs.patients') },
                  { value: 'expenses', label: t('payments.tabs.expenses') },
                ]}
                value={tab}
                onChange={(next) => {
                  setSearch('')
                  setTab(next)
                }}
              />
            </View>

            <View style={styles.searchRow}>
              <View style={styles.searchFlex}>
                <SearchBar
                  value={search}
                  onChangeText={setSearch}
                  placeholder={
                    tab === 'patients'
                      ? t('payments.search.patient')
                      : t('payments.search.expense')
                  }
                  loading={isSearchLoading}
                  maxLength={160}
                />
              </View>
              {tab === 'patients' ? (
                <Pressable
                  onPress={() => setOutstandingOnly((value) => !value)}
                  style={[
                    styles.filterButton,
                    outstandingOnly && styles.filterButtonActive,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: outstandingOnly }}
                  accessibilityLabel={t('payments.filters.outstanding')}
                >
                  <Icon
                    name={outstandingOnly ? 'close-circle-outline' : 'alert-circle-outline'}
                    size={19}
                    color={(outstandingOnly ? '#C7464D' : c.labelSecondary) as string}
                  />
                </Pressable>
              ) : canManagePayments ? (
                <Pressable
                  testID="expense-add-action"
                  onPress={openNewExpense}
                  style={({ pressed }) => [
                    styles.expenseAddButton,
                    pressed && styles.expenseAddButtonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t('payments.expenses.add')}
                >
                  <Icon name="add" size={21} color="#FFFFFF" />
                </Pressable>
              ) : null}
            </View>
          </>
        ) : null}

        {!canViewPayments ? (
          <View style={styles.center}>
            <EmptyState iconName="lock-closed-outline" title={t('dashboard.noAccess')} tone="warning" />
          </View>
        ) : isLoading ? (
          <View style={styles.skeletonWrap}>
            {Array.from({ length: 7 }).map((_, index) => (
              <React.Fragment key={index}>
                <ListRowSkeleton />
                {index < 6 ? (
                  <View
                    style={[
                      styles.separator,
                      tab === 'patients'
                        ? styles.patientSeparator
                        : styles.expenseSeparator,
                    ]}
                  />
                ) : null}
              </React.Fragment>
            ))}
          </View>
        ) : isError ? (
          <View style={styles.center}>
            <EmptyState
              iconName={isOnline ? 'cloud-offline-outline' : 'cloud-offline'}
              title={isOnline ? t('payments.loadFailed') : t('network.offline')}
              subtitle={!isOnline ? t('network.offlineHint') : undefined}
              tone={isOnline ? 'danger' : 'warning'}
              action={<Button title={t('common.retry')} variant="secondary" onPress={() => activeQuery.refetch()} />}
            />
          </View>
        ) : rowsEmpty ? (
          <View style={styles.center}>
            <EmptyState
              iconName={
                hasActiveFilter
                  ? 'search-outline'
                  : tab === 'patients'
                    ? 'people-outline'
                    : 'receipt-outline'
              }
              title={
                hasActiveFilter
                  ? t('payments.empty.filtered')
                  : tab === 'patients'
                    ? t('payments.empty.patients')
                    : t('payments.empty.expenses')
              }
              action={
                hasActiveFilter ? (
                  <Button
                    title={t('common.clear')}
                    variant="secondary"
                    size="md"
                    onPress={() => {
                      setSearch('')
                      setOutstandingOnly(false)
                    }}
                  />
                ) : tab === 'expenses' && canManagePayments ? (
                  <Button
                    title={t('payments.expenses.add')}
                    size="md"
                    onPress={openNewExpense}
                  />
                ) : undefined
              }
            />
          </View>
        ) : tab === 'patients' ? (
          <FlatList
            data={patientRows}
            keyExtractor={(item) => item.patientId}
            renderItem={({ item, index }) => (
              <FadeInRow index={index}>
                <PatientDebtRow
                  data={item}
                  onPress={() =>
                    navigation.navigate('PaymentPatientDetail', {
                      id: item.patientId,
                    })
                  }
                />
              </FadeInRow>
            )}
            ItemSeparatorComponent={() => (
              <View style={[styles.separator, styles.patientSeparator]} />
            )}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: getFloatingTabBarContentInset(insets.bottom) },
            ]}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={c.brand as string} />}
            onEndReached={() => {
              if (patientQuery.hasNextPage && !patientQuery.isFetchingNextPage) patientQuery.fetchNextPage()
            }}
            onEndReachedThreshold={0.4}
            ListFooterComponent={patientQuery.isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={c.brand as string} /> : null}
          />
        ) : (
          <SectionList
            sections={expenseSections}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <FadeInRow index={index}>
                <ExpenseRow
                  expense={item}
                  canManage={
                    canManagePayments && !deleteExpenseMutation.isPending
                  }
                  onEdit={() => {
                    setEditingExpense(item)
                    setExpenseFormOpen(true)
                  }}
                  onDelete={() => requestDeleteExpense(item)}
                />
              </FadeInRow>
            )}
            renderSectionHeader={({ section }) => (
              <View style={styles.expenseMonthHeader}>
                <Text
                  style={styles.expenseMonthLabel}
                  accessibilityRole="header"
                >
                  {section.title}
                </Text>
                <View style={styles.expenseMonthLine} />
              </View>
            )}
            stickySectionHeadersEnabled={false}
            ItemSeparatorComponent={() => (
              <View style={[styles.separator, styles.expenseSeparator]} />
            )}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: getFloatingTabBarContentInset(insets.bottom) },
            ]}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={c.brand as string} />}
            onEndReached={() => {
              if (expenseQuery.hasNextPage && !expenseQuery.isFetchingNextPage) expenseQuery.fetchNextPage()
            }}
            onEndReachedThreshold={0.4}
            ListFooterComponent={expenseQuery.isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={c.brand as string} /> : null}
          />
        )}
      </SafeAreaView>

      <ExpenseFormSheet
        visible={expenseFormOpen}
        expense={editingExpense}
        onClose={() => {
          setExpenseFormOpen(false)
          setEditingExpense(null)
        }}
      />
    </View>
  )
}

type SummaryValue = { currency: MoneyCurrency; amount: number }
type SummaryTone = 'success' | 'danger' | 'warning' | 'neutral'

const SUMMARY_TONE_PALETTE: Record<
  SummaryTone,
  { surface: string; accent: string }
> = {
  success: { surface: '#EFFAF3', accent: '#16805A' },
  danger: { surface: '#FFF2F1', accent: '#C7464D' },
  warning: { surface: '#FFF7E8', accent: '#A65F00' },
  neutral: { surface: '#EEF7FC', accent: '#347CA5' },
}

function currencySummary(
  summary: Record<MoneyCurrency, { total_debt: number; total_paid: number; total_balance: number }> | undefined,
  field: 'total_debt' | 'total_paid' | 'total_balance'
): SummaryValue[] {
  return CURRENCIES.map((currency) => ({ currency, amount: Number(summary?.[currency]?.[field] ?? 0) }))
}

function simpleCurrencySummary(summary: Record<MoneyCurrency, number> | undefined): SummaryValue[] {
  return CURRENCIES.map((currency) => ({ currency, amount: Number(summary?.[currency] ?? 0) }))
}

function groupExpensesByMonth(
  expenses: PaymentExpense[],
  locale: Locale
): ExpenseSection[] {
  const sections = new Map<string, ExpenseSection>()
  const newestFirst = [...expenses].sort((left, right) => {
    const byDate = right.expense_date.localeCompare(left.expense_date)
    if (byDate !== 0) return byDate
    return (right.created_at ?? '').localeCompare(left.created_at ?? '')
  })

  for (const expense of newestFirst) {
    const monthKey = expense.expense_date.slice(0, 7)
    const existing = sections.get(monthKey)
    if (existing) {
      existing.data.push(expense)
      continue
    }

    sections.set(monthKey, {
      key: monthKey,
      title: formatMonthYear(fromLocalDateKey(`${monthKey}-01`), locale),
      data: [expense],
    })
  }

  return Array.from(sections.values())
}

function SummaryCard({
  label,
  icon,
  tone,
  values,
  count,
  loading = false,
  unavailable = false,
}: {
  label: string
  icon: 'arrow-down-circle-outline' | 'alert-circle-outline' | 'wallet-outline' | 'receipt-outline' | 'calendar-outline' | 'list-outline'
  tone: SummaryTone
  values?: SummaryValue[]
  count?: number
  loading?: boolean
  unavailable?: boolean
}) {
  const { locale, t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const palette = SUMMARY_TONE_PALETTE[tone]
  const visible = values?.filter((item) => item.currency === 'UZS' || item.amount !== 0) ?? []
  const formattedValues = visible.map(({ currency, amount }) => ({
    currency,
    ...formatCurrencyParts(amount, locale, currency),
  }))
  const accessibilityValue =
    loading
      ? t('common.loading')
      : unavailable
      ? '\u2014'
      : count !== undefined
      ? String(count)
      : formattedValues.map(({ value, unit }) => `${value} ${unit}`).join(', ')

  return (
    <View
      style={[styles.summaryCard, { backgroundColor: palette.surface }]}
      accessible
      accessibilityLabel={`${label}: ${accessibilityValue}`}
      accessibilityState={{ busy: loading }}
    >
      <View style={styles.summaryHeader}>
        <Text
          style={[styles.summaryLabel, { color: palette.accent }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.68}
        >
          {label}
        </Text>
        <Icon name={icon} size={15} color={palette.accent} />
      </View>
      {loading ? (
        <View style={styles.summaryLoading}>
          <ActivityIndicator size="small" color={palette.accent} />
        </View>
      ) : unavailable ? (
        <Text style={styles.summaryUnavailable}>{'\u2014'}</Text>
      ) : count !== undefined ? (
        <Text style={styles.summaryValue}>{count}</Text>
      ) : (
        <View style={styles.summaryValues}>
          {formattedValues.map(({ currency, value, unit }) => (
            <Text
              key={currency}
              style={[
                styles.summaryValue,
                formattedValues.length > 1 && styles.summaryValueMulti,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.68}
            >
              {value}<Text style={styles.summaryUnit}> {unit}</Text>
            </Text>
          ))}
        </View>
      )}
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    flex: { flex: 1 },
    summaryRow: {
      flexDirection: 'row',
      gap: 7,
      paddingHorizontal: spacing.lg,
      marginBottom: 10,
    },
    summaryCard: {
      flex: 1,
      minWidth: 0,
      minHeight: 64,
      justifyContent: 'center',
      gap: 4,
      borderRadius: radius.lg,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    summaryHeader: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 3,
    },
    summaryLabel: {
      flex: 1,
      minWidth: 0,
      fontFamily: font('600'),
      fontSize: 9.5,
      fontWeight: '600',
      lineHeight: 12,
    },
    summaryValue: {
      fontFamily: font('700'),
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 16,
      color: c.label,
      letterSpacing: -0.25,
    },
    summaryValues: {
      gap: 3,
    },
    summaryValueMulti: {
      fontSize: 11.5,
      lineHeight: 13,
    },
    summaryUnit: {
      fontFamily: font('500'),
      fontSize: 8.5,
      fontWeight: '500',
      color: c.labelSecondary,
      letterSpacing: 0,
    },
    summaryLoading: {
      minHeight: 29,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    summaryUnavailable: {
      fontFamily: font('600'),
      fontSize: 14,
      lineHeight: 16,
      fontWeight: '600',
      color: c.labelTertiary,
    },
    toggleWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
    },
    searchFlex: { flex: 1 },
    filterButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.fillQuaternary,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    filterButtonActive: {
      backgroundColor: '#FFF2F1',
      borderColor: '#F2C8C6',
    },
    expenseAddButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.brand,
    },
    expenseAddButtonPressed: {
      opacity: 0.84,
      transform: [{ scale: 0.97 }],
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
    skeletonWrap: { paddingTop: spacing.xs },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.separator,
    },
    patientSeparator: {
      marginLeft: 76,
    },
    expenseSeparator: {
      marginLeft: 64,
      marginRight: spacing.xl,
    },
    expenseMonthHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingTop: 10,
      paddingBottom: 6,
      paddingHorizontal: spacing.xl,
    },
    expenseMonthLabel: {
      fontFamily: font('700'),
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 14,
      color: c.brandDeep,
      textTransform: 'capitalize',
    },
    expenseMonthLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.brandSoft,
    },
    listContent: {},
    footer: { paddingVertical: spacing.lg },
  })
}
