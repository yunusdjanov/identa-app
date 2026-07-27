import React, { useEffect, useState, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  RefreshControl,
  StatusBar,
  Pressable,
  Linking,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import {
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

import SearchBar from '../../components/ui/SearchBar'
import CategoryChips from '../../components/patients/CategoryChips'
import PatientCard from '../../components/patients/PatientCard'
import RecentPatientsPanel, {
  RECENT_PATIENT_DISPLAY_LIMIT,
} from '../../components/patients/RecentPatientsPanel'
import SectionHeader from '../../components/patients/SectionHeader'
import EmptyState from '../../components/ui/EmptyState'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import { ListRowSkeleton } from '../../components/ui/Skeleton'
import FadeInRow from '../../components/ui/FadeInRow'
import AppHeader, { HeaderIconButton } from '../../components/navigation/AppHeader'
import { useToast } from '../../components/ui/Toast'
import { useDialog } from '../../components/ui/Dialog'

import { useI18n } from '../../i18n'
import { useAuthStore } from '../../stores/auth'
import { useUIStore } from '../../stores/ui'
import { useThemeStore } from '../../stores/theme'
import { canExportData, canView, canManage } from '../../lib/permissions'
import {
  listPatients,
  listPatientsForExport,
  listCategories,
  listRecentPatients,
  clearRecentPatients,
  getPatient,
} from '../../api/patients'
import { isOfflineError } from '../../lib/offlineGuard'
import { groupPatientsByLetter } from '../../lib/groupPatients'
import { useDebouncedValue } from '../../lib/useDebouncedValue'
import {
  formatStoredPhone,
  getPhoneCallUrl,
  getTelegramPhoneUrl,
} from '../../lib/phoneFormat'
import { useColors, type Colors } from '../../lib/useColors'
import { spacing, typography } from '../../constants/theme'
import { exportPatientsPdf } from '../../lib/patientExport'
import {
  getPatientInactiveBefore,
  isPatientCategoryFilter,
} from '../../lib/patientFilters'
import {
  DEFAULT_PATIENT_LIST_SORT,
  loadPatientListSort,
  savePatientListSort,
  type PatientListSort,
} from '../../lib/patientSortPreference'
import { useManualRefresh } from '../../lib/useManualRefresh'
import type { MainStackParams } from '../../navigation'
import type { ApiPatient } from '../../types'

type Nav = NativeStackNavigationProp<MainStackParams>

const PATIENTS_PAGE_SIZE = 30
const PATIENT_CONTENT_MAX_WIDTH = 760

export default function PatientListScreen() {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const effective = useThemeStore((s) => s.effective)
  const user = useAuthStore((s) => s.user)
  const toast = useToast()
  const { actionSheet } = useDialog()
  const navigation = useNavigation<Nav>()
  const openPatientForm = useUIStore((s) => s.openPatientForm)
  const queryClient = useQueryClient()

  const canViewPatients = canView(user, 'patients')
  const canEditPatient = canManage(user, 'patients')
  const canExportPatients = canExportData(user)

  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [recentDismissed, setRecentDismissed] = useState(false)
  const debouncedSearch = useDebouncedValue(search, 250)
  const [sort, setSort] = useState<PatientListSort>(DEFAULT_PATIENT_LIST_SORT)
  const [isSortHydrated, setIsSortHydrated] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [categoryId, setCategoryId] = useState('all')

  useEffect(() => {
    let active = true
    setIsSortHydrated(false)
    loadPatientListSort(user?.id).then((storedSort) => {
      if (!active) return
      setSort(storedSort)
      setIsSortHydrated(true)
    })
    return () => {
      active = false
    }
  }, [user?.id])

  const categoriesQuery = useQuery({
    queryKey: ['patient-categories', 'list'],
    queryFn: listCategories,
    enabled: canViewPatients,
    staleTime: 5 * 60_000,
  })

  const categories = categoriesQuery.data ?? []

  // A category can be deleted from the web while mobile still has it
  // selected. Reset that stale filter after the refreshed category list
  // arrives instead of leaving the patient list permanently empty.
  useEffect(() => {
    if (
      categoriesQuery.isSuccess &&
      isPatientCategoryFilter(categoryId) &&
      !categories.some((category) => category.id === categoryId)
    ) {
      setCategoryId('all')
    }
  }, [categories, categoriesQuery.isSuccess, categoryId])

  const listQuery = useInfiniteQuery({
    queryKey: ['patients', 'list', { search: debouncedSearch, sort, categoryId }],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      listPatients(
        {
          search: debouncedSearch.trim() || undefined,
          category_id: isPatientCategoryFilter(categoryId) ? categoryId : undefined,
          archived: categoryId === 'archived' ? true : undefined,
          inactive_before: getPatientInactiveBefore(categoryId),
          // Alphabetical server sorting keeps SectionList sections globally
          // correct while pages are appended. Without it, each page is sorted
          // locally and letters jump around as the user scrolls.
          sort,
          page: pageParam,
          per_page: PATIENTS_PAGE_SIZE,
        },
        { signal }
      ),
    getNextPageParam: (lastPage) => {
      const pagination = lastPage.meta.pagination
      const currentPage = pagination.page ?? pagination.current_page ?? 1
      const totalPages = pagination.total_pages ?? pagination.last_page ?? 1
      return currentPage < totalPages ? currentPage + 1 : undefined
    },
    enabled: canViewPatients && isSortHydrated,
    staleTime: 30_000,
  })

  const recentPatientsQuery = useQuery({
    queryKey: ['patients', 'recent'],
    queryFn: listRecentPatients,
    enabled: canViewPatients,
    staleTime: 60_000,
  })

  const recentShortcuts = (recentPatientsQuery.data ?? []).slice(
    0,
    RECENT_PATIENT_DISPLAY_LIMIT
  )
  const shouldLoadRecentPhotos =
    canViewPatients &&
    categoryId === 'all' &&
    searchFocused &&
    !recentDismissed &&
    search.trim().length === 0
  const recentDetailQueries = useQueries({
    queries: recentShortcuts.map((patient) => ({
      queryKey: ['patients', 'detail', patient.id],
      // Deliberately omit rememberRecent: photo hydration must not reshuffle
      // the shortcuts merely because the search panel became visible.
      queryFn: () => getPatient(patient.id),
      enabled: shouldLoadRecentPhotos,
      staleTime: 5 * 60_000,
    })),
  })
  const recentPatients = recentShortcuts.map((patient, index) => {
    const detail = recentDetailQueries[index]?.data
    return detail
      ? {
          ...patient,
          photo_url: detail.photo_url,
          photo_thumbnail_url: detail.photo_thumbnail_url,
          photo_preview_url: detail.photo_preview_url,
          photo_thumbnail_ready: detail.photo_thumbnail_ready,
          photo_preview_ready: detail.photo_preview_ready,
          photo_scan_status: detail.photo_scan_status,
        }
      : patient
  })

  const data = useMemo(
    () => listQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [listQuery.data]
  )
  const total = listQuery.data?.pages[0]?.meta.pagination.total ?? 0
  const isLoading = !isSortHydrated || (listQuery.isLoading && !listQuery.data)
  const {
    isRefreshing,
    onRefresh,
  } = useManualRefresh(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    return Promise.all([listQuery.refetch(), categoriesQuery.refetch()])
  })
  // Note: use `search` (not debounced) so the filtered/empty state copy
  // updates as the user types without lagging behind keystrokes.
  const isFiltering = search.trim().length > 0 || categoryId !== 'all'

  const sections = useMemo(
    () => sort === 'full_name' ? groupPatientsByLetter(data) : [{ title: '', data }],
    [data, sort]
  )

  const onOpenPatient = (id: string) => {
    navigation.navigate('PatientDetail', { id })
  }

  const clearRecentMutation = useMutation({
    mutationFn: clearRecentPatients,
    onSuccess: () => {
      queryClient.setQueryData(['patients', 'recent'], [])
    },
    onError: (error) => {
      if (isOfflineError(error)) return
      toast.error(t('patients.recent.clearFailed'))
    },
  })

  const onCallPatient = (patient: ApiPatient) => {
    const url = getPhoneCallUrl(patient.phone)
    if (!url) {
      toast.error(t('patients.actions.noPhone'))
      return
    }
    Linking.openURL(url).catch(() => {
      toast.error(t('patients.actions.callFailed'))
    })
  }

  const onTelegramPatient = (url: string) => {
    Linking.openURL(url).catch(() => {
      toast.error(t('patients.actions.telegramFailed'))
    })
  }

  const onLongPressPatient = async (patient: ApiPatient) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const telegramUrl = getTelegramPhoneUrl(patient.phone)
    const actions = [
      {
        label: t('patients.actions.callShort'),
        icon: 'call-outline' as const,
        run: () => onCallPatient(patient),
      },
      {
        label: t('patients.actions.telegram'),
        icon: 'paper-plane-outline' as const,
        disabled: !telegramUrl,
        run: () => {
          if (telegramUrl) onTelegramPatient(telegramUrl)
        },
      },
      {
        label: t('patients.actions.openShort'),
        icon: 'open-outline' as const,
        run: () => onOpenPatient(patient.id),
      },
      ...(canEditPatient
        ? [{
            label: t('patients.actions.editShort'),
            icon: 'create-outline' as const,
            run: () => openPatientForm(patient.id),
          }]
        : []),
    ]
    const idx = await actionSheet({
      title: patient.full_name,
      message: formatStoredPhone(patient.phone) || undefined,
      options: actions.map((action) => ({
        label: action.label,
        icon: action.icon,
        disabled: 'disabled' in action ? action.disabled : false,
      })),
      layout: 'grid',
      cancelLabel: t('common.close'),
    })
    actions[idx]?.run()
  }

  const openSortMenu = async () => {
    const options = [
      {
        label: t('patients.sort.alphabetical'),
        icon: sort === 'full_name' ? 'checkmark-circle-outline' as const : 'text-outline' as const,
      },
      {
        label: t('patients.sort.recentlyUpdated'),
        icon: sort === '-updated_at' ? 'checkmark-circle-outline' as const : 'time-outline' as const,
      },
    ]
    const selected = await actionSheet({
      title: t('patients.sort.title'),
      options,
    })
    const nextSort: PatientListSort | null =
      selected === 0 ? 'full_name' : selected === 1 ? '-updated_at' : null
    if (!nextSort || nextSort === sort) return
    setSort(nextSort)
    savePatientListSort(user?.id, nextSort).catch(() => {})
  }

  const handleExport = async () => {
    if (data.length === 0 || isExporting) return
    setIsExporting(true)
    try {
      const exportPatients = await listPatientsForExport({
        search: debouncedSearch.trim() || undefined,
        category_id: isPatientCategoryFilter(categoryId) ? categoryId : undefined,
        archived: categoryId === 'archived' ? true : undefined,
        inactive_before: getPatientInactiveBefore(categoryId),
        sort,
      })
      await exportPatientsPdf(exportPatients, locale, {
        title: t('patients.export.title'),
        generatedAt: t('patients.export.generatedAt'),
        loadedCount: t('patients.export.loadedCount'),
        name: t('patients.export.columns.name'),
        phone: t('patients.export.columns.phone'),
        dateOfBirth: t('patients.export.columns.dateOfBirth'),
        categories: t('patients.export.columns.categories'),
        lastVisit: t('patients.export.columns.lastVisit'),
        empty: t('patients.export.empty'),
        shareTitle: t('patients.export.shareTitle'),
      })
      toast.success(t('patients.export.ready'))
    } catch {
      toast.error(t('patients.export.failed'))
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
      <LinearGradient
        colors={gradientColors}
        locations={[0, 0.2, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <StatusBar barStyle={effective === 'dark' ? 'light-content' : 'dark-content'} />

        <AppHeader
          title={t('patients.title')}
          subtitle={t('patients.count', { n: total })}
          showProfile
          actions={
            canViewPatients && canExportPatients ? (
              <HeaderIconButton
                icon="download-outline"
                label={t('patients.export.action')}
                onPress={handleExport}
                disabled={data.length === 0}
                loading={isExporting}
              />
            ) : undefined
          }
        />

        {/* Fixed search controls stay visible while the patient list scrolls. */}
        {canViewPatients ? (
          <View style={styles.controls}>
            <View style={styles.searchRow}>
              <View style={styles.searchFlex}>
                <SearchBar
                  value={search}
                  onChangeText={setSearch}
                  onFocus={() => {
                    setSearchFocused(true)
                    setRecentDismissed(false)
                  }}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
                  placeholder={t('patients.searchPlaceholder')}
                // Spin while either the debounce is still pending (user typed
                // but query hasn't fired) or the query itself is in flight.
                // Without this the screen feels static during the 250ms
                // debounce + ~300ms network round-trip and users assume the
                // search did nothing.
                  loading={
                    (search.trim() !== debouncedSearch.trim()) ||
                    (isFiltering && listQuery.isFetching && !isRefreshing)
                  }
                />
              </View>
              <Pressable
                onPress={openSortMenu}
                style={({ pressed }) => [
                  styles.sortButton,
                  sort !== 'full_name' && styles.sortButtonActive,
                  pressed && styles.headerIconPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('patients.sort.title')}
              >
                <Icon
                  name={sort === 'full_name' ? 'swap-vertical-outline' : 'time-outline'}
                  size={20}
                  color={sort === 'full_name' ? c.labelSecondary as string : c.brand as string}
                />
              </Pressable>
            </View>
            <CategoryChips
              categories={categories}
              activeId={categoryId}
              onSelect={(nextCategoryId) => {
                setRecentDismissed(true)
                setCategoryId(nextCategoryId)
              }}
              showReset={isFiltering}
              onReset={() => {
                setSearch('')
                setCategoryId('all')
                setRecentDismissed(true)
              }}
            />
            {categoriesQuery.isError ? (
              <View style={styles.categoryError} accessibilityRole="alert">
                <Icon
                  name="cloud-offline-outline"
                  size={16}
                  color={c.warning as string}
                />
                <Text style={styles.categoryErrorText}>
                  {t('patients.categoriesLoadFailed')}
                </Text>
                <Pressable
                  onPress={() => categoriesQuery.refetch()}
                  disabled={categoriesQuery.isFetching}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.categoryRetry,
                    pressed && styles.headerIconPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.retry')}
                  accessibilityState={{ disabled: categoriesQuery.isFetching }}
                >
                  {categoriesQuery.isFetching ? (
                    <ActivityIndicator size="small" color={c.warning as string} />
                  ) : (
                    <Text style={styles.categoryRetryText}>{t('common.retry')}</Text>
                  )}
                </Pressable>
              </View>
            ) : null}
            {categoryId === 'all' &&
            searchFocused && !recentDismissed && search.trim().length === 0 &&
            (recentPatientsQuery.data?.length ?? 0) > 0 ? (
              <View style={styles.recentOverlay}>
                <RecentPatientsPanel
                  patients={recentPatients}
                  clearing={clearRecentMutation.isPending}
                  onClear={() => clearRecentMutation.mutate()}
                  onDismiss={() => setRecentDismissed(true)}
                  onSelect={(patient) => {
                    setSearchFocused(false)
                    onOpenPatient(patient.id)
                  }}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Scrollable: section list */}
        {!canViewPatients ? (
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
                {i < 7 ? <View style={styles.rowSeparator} /> : null}
              </React.Fragment>
            ))}
          </View>
        ) : listQuery.isError && data.length === 0 ? (
          <View style={styles.center}>
            <EmptyState
              iconName="alert-circle-outline"
              title={t('patients.loadFailed')}
              tone="danger"
              action={
                <Button
                  title={t('common.retry')}
                  variant="secondary"
                  onPress={() => listQuery.refetch()}
                />
              }
            />
          </View>
        ) : data.length === 0 ? (
          <View style={styles.center}>
            <EmptyState
              iconName={isFiltering ? 'search-outline' : 'people-outline'}
              title={isFiltering ? t('patients.empty.filtered') : t('patients.empty.default')}
              subtitle={
                isFiltering ? t('patients.empty.filteredSub') : t('patients.empty.defaultSub')
              }
            />
          </View>
        ) : (
          <SectionList
            style={styles.list}
            sections={sections}
            keyExtractor={(p) => p.id}
            renderItem={({ item, index }) => (
              <FadeInRow index={index}>
                <PatientCard
                  patient={item}
                  onPress={() => onOpenPatient(item.id)}
                  onLongPress={() => onLongPressPatient(item)}
                  searchQuery={debouncedSearch}
                  action={{
                    accessibilityLabel: t('patients.actions.more'),
                    onPress: () => onLongPressPatient(item),
                  }}
                />
              </FadeInRow>
            )}
            renderSectionHeader={({ section }) =>
              section.title ? <SectionHeader title={section.title} /> : null
            }
            ItemSeparatorComponent={() => <View style={styles.rowSeparator} />}
            SectionSeparatorComponent={() => null}
            stickySectionHeadersEnabled={sort === 'full_name'}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            // Virtualization tuning. Defaults are conservative; these give a
            // noticeably smoother scroll for lists of 200+ rows without the
            // complexity of a full getItemLayout (variable section sizes
            // make that calculation gnarly for SectionList).
            initialNumToRender={12}
            maxToRenderPerBatch={10}
            windowSize={7}
            removeClippedSubviews
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                tintColor={c.brand as string}
              />
            }
            onEndReached={() => {
              if (listQuery.hasNextPage && !listQuery.isFetchingNextPage) {
                listQuery.fetchNextPage()
              }
            }}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              listQuery.isFetchingNextPage ? (
                <ActivityIndicator
                  style={styles.listFooter}
                  color={c.brand as string}
                  accessibilityLabel={t('patients.loadingMore')}
                />
              ) : listQuery.isFetchNextPageError ? (
                <Pressable
                  onPress={() => listQuery.fetchNextPage()}
                  style={styles.loadMoreRetry}
                  accessibilityRole="button"
                  accessibilityLabel={t('patients.loadMoreFailed')}
                >
                  <Icon name="refresh-outline" size={16} color={c.danger as string} />
                  <Text style={styles.loadMoreRetryText}>{t('patients.loadMoreFailed')}</Text>
                </Pressable>
              ) : null
            }
          />
        )}
      </SafeAreaView>

    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    flex: { flex: 1 },
    headerIconPressed: { opacity: 0.65 },
    controls: {
      position: 'relative',
      zIndex: 20,
      paddingBottom: spacing.sm,
      gap: 4,
      width: '100%',
      maxWidth: PATIENT_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: spacing.xl,
    },
    searchFlex: { flex: 1 },
    sortButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.fillQuaternary,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    sortButtonActive: {
      backgroundColor: c.brandLight,
      borderColor: c.brand,
    },
    recentOverlay: {
      position: 'absolute',
      top: '100%',
      left: spacing.xl,
      right: spacing.xl,
      zIndex: 30,
    },
    categoryError: {
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      marginHorizontal: spacing.xl,
      paddingHorizontal: 10,
      borderRadius: 12,
      backgroundColor: 'rgba(255, 149, 0, 0.08)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.warning,
    },
    categoryErrorText: {
      ...typography.footnote,
      flex: 1,
      color: c.labelSecondary,
      fontWeight: '500',
    },
    categoryRetry: {
      minHeight: 32,
      minWidth: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    categoryRetryText: {
      ...typography.footnote,
      color: c.warning,
      fontWeight: '700',
    },
    list: {
      width: '100%',
      maxWidth: PATIENT_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
    },
    listContent: {
      paddingBottom: 120, // tab bar clearance
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
      width: '100%',
      maxWidth: PATIENT_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
    },
    listFooter: {
      paddingVertical: spacing.lg,
    },
    loadMoreRetry: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: spacing.lg,
    },
    loadMoreRetryText: {
      ...typography.footnote,
      color: c.danger,
      fontWeight: '600',
    },
  })
}
