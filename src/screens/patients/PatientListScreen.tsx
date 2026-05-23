import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  RefreshControl,
  StatusBar,
  Pressable,
  ActionSheetIOS,
  Alert,
  Platform,
  Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

import SearchBar from '../../components/ui/SearchBar'
import CategoryChips from '../../components/patients/CategoryChips'
import PatientCard from '../../components/patients/PatientCard'
import SectionHeader from '../../components/patients/SectionHeader'
import PatientCategoriesSheet from '../../components/patients/PatientCategoriesSheet'
import EmptyState from '../../components/ui/EmptyState'
import Icon from '../../components/ui/Icon'
import { ListRowSkeleton } from '../../components/ui/Skeleton'
import FadeInRow from '../../components/ui/FadeInRow'
import { useToast } from '../../components/ui/Toast'

import { useI18n } from '../../i18n'
import { useAuthStore } from '../../stores/auth'
import { useUIStore } from '../../stores/ui'
import { useThemeStore } from '../../stores/theme'
import { canView, canManage } from '../../lib/permissions'
import { listPatients, listCategories } from '../../api/patients'
import { groupPatientsByLetter } from '../../lib/groupPatients'
import { useDebouncedValue } from '../../lib/useDebouncedValue'
import { useColors, type Colors } from '../../lib/useColors'
import { spacing, typography } from '../../constants/theme'
import type { MainStackParams } from '../../navigation'
import type { ApiPatient } from '../../types'

type Nav = NativeStackNavigationProp<MainStackParams>

export default function PatientListScreen() {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const effective = useThemeStore((s) => s.effective)
  const user = useAuthStore((s) => s.user)
  const toast = useToast()
  const navigation = useNavigation<Nav>()
  const openPatientForm = useUIStore((s) => s.openPatientForm)

  const canViewPatients = canView(user, 'patients')
  const canEditPatient = canManage(user, 'patients')

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 250)
  const [categoryId, setCategoryId] = useState<string>('all')
  const [categoriesSheetOpen, setCategoriesSheetOpen] = useState(false)

  const categoriesQuery = useQuery({
    queryKey: ['patient-categories', 'list'],
    queryFn: listCategories,
    enabled: canViewPatients,
    staleTime: 5 * 60_000,
  })

  const listQuery = useQuery({
    queryKey: ['patients', 'list', { search: debouncedSearch, categoryId }],
    queryFn: () =>
      listPatients({
        search: debouncedSearch.trim() || undefined,
        category_id: categoryId === 'all' ? undefined : categoryId,
        per_page: 100,
      }),
    enabled: canViewPatients,
    staleTime: 30_000,
  })

  const data = listQuery.data?.data ?? []
  const total = listQuery.data?.meta.pagination.total ?? 0
  const isLoading = listQuery.isLoading && !listQuery.data
  const isRefreshing = listQuery.isFetching && Boolean(listQuery.data)
  // Note: use `search` (not debounced) so the filtered/empty state copy
  // updates as the user types without lagging behind keystrokes.
  const isFiltering = search.trim().length > 0 || categoryId !== 'all'

  const sections = useMemo(() => groupPatientsByLetter(data), [data])

  const onRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    listQuery.refetch()
  }

  const onOpenPatient = (id: string) => {
    navigation.navigate('PatientDetail', { id })
  }

  const onCallPatient = (patient: ApiPatient) => {
    const primary = patient.phone?.split('|')[0]?.trim()
    if (!primary) {
      toast.error(t('patients.actions.noPhone'))
      return
    }
    const digits = primary.replace(/[^\d+]/g, '')
    Linking.openURL(`tel:${digits}`).catch(() => {
      toast.error(t('patients.actions.callFailed'))
    })
  }

  const onLongPressPatient = (patient: ApiPatient) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const labels = {
      call: t('patients.actions.call'),
      open: t('patients.actions.open'),
      edit: t('patients.actions.edit'),
      cancel: t('common.cancel'),
    }

    if (Platform.OS === 'ios') {
      const options: string[] = [labels.call, labels.open]
      if (canEditPatient) options.push(labels.edit)
      options.push(labels.cancel)
      const cancelIdx = options.length - 1
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: patient.full_name,
          message: patient.phone ?? undefined,
          options,
          cancelButtonIndex: cancelIdx,
        },
        (idx) => {
          if (idx === 0) onCallPatient(patient)
          else if (idx === 1) onOpenPatient(patient.id)
          else if (idx === 2 && canEditPatient) openPatientForm(patient.id)
        }
      )
      return
    }

    // Android fallback: Alert.alert with up to 3 buttons
    const buttons = [
      { text: labels.call, onPress: () => onCallPatient(patient) },
      { text: labels.open, onPress: () => onOpenPatient(patient.id) },
      ...(canEditPatient
        ? [{ text: labels.edit, onPress: () => openPatientForm(patient.id) }]
        : []),
      { text: labels.cancel, style: 'cancel' as const },
    ]
    Alert.alert(patient.full_name, patient.phone ?? undefined, buttons)
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

        {/* Fixed top: title + count + manage categories */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title} numberOfLines={1}>{t('patients.title')}</Text>
            <Text style={styles.count} numberOfLines={1}>{t('patients.count', { n: total })}</Text>
          </View>
          {canViewPatients ? (
            <Pressable
              onPress={() => setCategoriesSheetOpen(true)}
              hitSlop={8}
              style={styles.headerAction}
            >
              <Icon name="pricetags-outline" size={18} color={c.brand as string} />
              <Text style={styles.headerActionText}>{t('patients.manageCategories')}</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Fixed: search + chips (don't scroll away) */}
        {canViewPatients ? (
          <View style={styles.controls}>
            <View style={styles.searchWrap}>
              <SearchBar
                value={search}
                onChangeText={setSearch}
                placeholder={t('patients.searchPlaceholder')}
              />
            </View>
            {(categoriesQuery.data?.length ?? 0) > 0 ? (
              <View style={styles.chipsWrap}>
                <CategoryChips
                  categories={categoriesQuery.data ?? []}
                  activeId={categoryId}
                  onSelect={setCategoryId}
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
            sections={sections}
            keyExtractor={(p) => p.id}
            renderItem={({ item, index }) => (
              <FadeInRow index={index}>
                <PatientCard
                  patient={item}
                  onPress={() => onOpenPatient(item.id)}
                  onLongPress={() => onLongPressPatient(item)}
                />
              </FadeInRow>
            )}
            renderSectionHeader={({ section }) => <SectionHeader title={section.title} />}
            ItemSeparatorComponent={() => <View style={styles.rowSeparator} />}
            SectionSeparatorComponent={() => null}
            stickySectionHeadersEnabled
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
          />
        )}
      </SafeAreaView>

      <PatientCategoriesSheet
        visible={categoriesSheetOpen}
        onClose={() => setCategoriesSheetOpen(false)}
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
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    headerLeft: {
      flex: 1,
      gap: 2,
    },
    title: {
      ...typography.title1,
      color: c.brandDeep,
    },
    count: {
      ...typography.footnote,
      color: c.labelSecondary,
    },
    headerAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: c.brandLight,
    },
    headerActionText: {
      fontFamily: typography.footnoteBold.fontFamily,
      fontSize: 12,
      fontWeight: '700',
      color: c.brand,
    },
    controls: {
      paddingBottom: spacing.sm,
      gap: 4,
    },
    searchWrap: {
      paddingHorizontal: spacing.xl,
    },
    chipsWrap: {
      paddingVertical: 4,
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
    },
  })
}
