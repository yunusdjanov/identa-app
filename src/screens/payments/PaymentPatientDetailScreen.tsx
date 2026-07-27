import React, { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as Haptics from 'expo-haptics'

import AppHeader, {
  HeaderIconButton,
} from '../../components/navigation/AppHeader'
import PaymentLedgerTreatmentRow from '../../components/payments/PaymentLedgerTreatmentRow'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import Icon, { type IconName } from '../../components/ui/Icon'
import PatientAvatar from '../../components/ui/PatientAvatar'
import Skeleton from '../../components/ui/Skeleton'
import { useToast } from '../../components/ui/Toast'
import {
  listPaymentLedgerHistory,
  listPaymentLedgerPatients,
} from '../../api/payments'
import { useI18n } from '../../i18n'
import { useAuthStore } from '../../stores/auth'
import { useNetworkStore } from '../../stores/network'
import { useThemeStore } from '../../stores/theme'
import { canExportData, canView } from '../../lib/permissions'
import {
  formatStoredPhone,
  getPhoneCallUrl,
  getTelegramPhoneUrl,
} from '../../lib/phoneFormat'
import { toIntlLocale } from '../../lib/format'
import {
  exportPaymentLedgerPdf,
  loadPatientLedgerForExport,
} from '../../lib/paymentLedgerExport'
import { useManualRefresh } from '../../lib/useManualRefresh'
import type { Locale } from '../../constants'
import { font, radius, spacing, typography } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import type { MainStackParams } from '../../navigation'

type Route = RouteProp<MainStackParams, 'PaymentPatientDetail'>
type Nav = NativeStackNavigationProp<MainStackParams, 'PaymentPatientDetail'>

const LEDGER_PAGE_SIZE = 20

export default function PaymentPatientDetailScreen() {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const toast = useToast()
  const effective = useThemeStore((state) => state.effective)
  const user = useAuthStore((state) => state.user)
  const isOnline = useNetworkStore((state) => state.isOnline)
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const insets = useSafeAreaInsets()
  const patientId = route.params.id
  const hasAccess = canView(user, 'payments')
  const canExportLedger = canExportData(user)
  const [isExporting, setIsExporting] = useState(false)

  const patientQuery = useQuery({
    queryKey: ['payments', 'patient-profile', patientId],
    queryFn: () =>
      listPaymentLedgerPatients({
        patient_id: patientId,
        page: 1,
        per_page: 1,
      }),
    enabled: hasAccess,
    staleTime: 60_000,
  })
  const treatmentsQuery = useInfiniteQuery({
    queryKey: ['payments', 'patient-ledger', patientId],
    queryFn: ({ pageParam }) =>
      listPaymentLedgerHistory({
        patient_id: patientId,
        page: pageParam,
        per_page: LEDGER_PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const pagination = lastPage.meta.pagination
      return pagination.page < pagination.total_pages
        ? pagination.page + 1
        : undefined
    },
    enabled: hasAccess,
    staleTime: 60_000,
  })
  const treatments = useMemo(() => {
    const seen = new Set<string>()
    return (treatmentsQuery.data?.pages ?? []).flatMap((page) =>
      page.data.filter((entry) => {
        if (seen.has(entry.id)) return false
        seen.add(entry.id)
        return true
      })
    )
  }, [treatmentsQuery.data])
  const knownTotal =
    treatmentsQuery.data?.pages[0]?.meta.pagination.total
  const patient = patientQuery.data?.data[0]
  const {
    isRefreshing,
    onRefresh,
  } = useManualRefresh(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    return Promise.all([patientQuery.refetch(), treatmentsQuery.refetch()])
  })

  const gradientColors: [string, string, string] =
    effective === 'dark'
      ? [c.background, c.background, c.background]
      : [c.brandSurface, '#FFFFFF', '#FFFFFF']

  if (!hasAccess) {
    return (
      <ScreenFrame colors={gradientColors}>
        <AppHeader
          title={t('payments.title')}
          onBack={() => navigation.goBack()}
          backLabel={t('common.back')}
        />
        <View style={styles.center}>
          <EmptyState
            iconName="lock-closed-outline"
            title={t('dashboard.noAccess')}
            tone="warning"
          />
        </View>
      </ScreenFrame>
    )
  }

  if (patientQuery.isLoading && !patient) {
    return (
      <ScreenFrame colors={gradientColors}>
        <AppHeader
          title={t('payments.title')}
          onBack={() => navigation.goBack()}
          backLabel={t('common.back')}
        />
        <View style={styles.center}>
          <ActivityIndicator
            color={c.brand as string}
            accessibilityRole="progressbar"
            accessibilityLabel={t('common.loading')}
          />
        </View>
      </ScreenFrame>
    )
  }

  if (!patient) {
    return (
      <ScreenFrame colors={gradientColors}>
        <AppHeader
          title={t('payments.title')}
          onBack={() => navigation.goBack()}
          backLabel={t('common.back')}
        />
        <View style={styles.center}>
          <EmptyState
            iconName={isOnline ? 'alert-circle-outline' : 'cloud-offline'}
            title={
              isOnline ? t('patients.notFound') : t('network.offline')
            }
            subtitle={!isOnline ? t('network.offlineHint') : undefined}
            tone={isOnline ? 'danger' : 'warning'}
            action={
              <Button
                title={t('common.retry')}
                variant="secondary"
                onPress={() => patientQuery.refetch()}
              />
            }
          />
        </View>
      </ScreenFrame>
    )
  }

  const phone = formatStoredPhone(patient.patient_phone)
  const secondaryPhone = formatStoredPhone(patient.patient_secondary_phone)
  const dob = patient.patient_date_of_birth
    ? formatPatientDate(patient.patient_date_of_birth, locale)
    : null
  const photoUris =
    patient.patient_photo_scan_status === 'pending' ||
    patient.patient_photo_scan_status === 'rejected'
      ? []
      : [
          patient.patient_photo_thumbnail_ready === false
            ? null
            : patient.patient_photo_thumbnail_url,
          patient.patient_photo_preview_ready === false
            ? null
            : patient.patient_photo_preview_url,
          patient.patient_photo_url,
        ].filter((value): value is string => Boolean(value))
  const openPhoneUrl = (
    url: string | null,
    failureMessage: string
  ) => {
    if (!url) return
    void Haptics.selectionAsync()
    void Linking.openURL(url).catch(() => toast.error(failureMessage))
  }
  const handleExport = async () => {
    if (!canExportLedger || treatments.length === 0 || isExporting) return
    setIsExporting(true)
    try {
      const completeLedger =
        treatmentsQuery.hasNextPage === false
          ? treatments
          : await loadPatientLedgerForExport(patientId)
      await exportPaymentLedgerPdf(patient, completeLedger, locale, {
        title: t('payments.patientLedger.export.title'),
        generatedAt: t('payments.patientLedger.export.generatedAt'),
        patient: t('payments.patientLedger.export.patient'),
        phone: t('payments.patientLedger.export.phone'),
        entries: t('payments.patientLedger.export.entries'),
        date: t('payments.patientLedger.export.date'),
        work: t('payments.patientLedger.export.work'),
        workPrice: t('payments.patientLedger.workPrice'),
        paid: t('payments.patientLedger.paid'),
        debt: t('payments.patientLedger.debt'),
        advance: t('payments.patient.advance'),
        totals: t('payments.patientLedger.export.totals'),
        empty: t('payments.patientLedger.empty'),
        shareTitle: t('payments.patientLedger.export.shareTitle'),
      })
      toast.success(t('payments.patientLedger.export.ready'))
    } catch {
      toast.error(t('payments.patientLedger.export.failed'))
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={gradientColors}
        locations={[0, 0.2, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <StatusBar
          barStyle={effective === 'dark' ? 'light-content' : 'dark-content'}
        />
        <AppHeader
          title={patient.patient_name}
          onBack={() => navigation.goBack()}
          backLabel={t('common.back')}
          actions={
            <HeaderIconButton
              icon="download-outline"
              label={t('payments.patientLedger.export.action')}
              onPress={handleExport}
              disabled={
                !canExportLedger ||
                treatments.length === 0 ||
                treatmentsQuery.isLoading
              }
              loading={isExporting}
            />
          }
        />

        <FlatList
          data={treatments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PaymentLedgerTreatmentRow treatment={item} />
          )}
          ItemSeparatorComponent={() => <View style={styles.rowGap} />}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={c.brand as string}
            />
          }
          ListHeaderComponent={
            <View style={styles.headerContent}>
              <View style={styles.profileCard}>
                <View style={styles.avatarFrame}>
                  <PatientAvatar
                    name={patient.patient_name}
                    size={76}
                    initialsFontSize={22}
                    uri={photoUris}
                    style={styles.avatar}
                  />
                </View>
                <View style={styles.contacts}>
                  {phone ? (
                    <ContactLine
                      icon="call-outline"
                      label={t('patients.detail.contact.phone')}
                      value={phone}
                      actions={[
                        {
                          icon: 'call-outline',
                          label: `${t('patients.actions.call')}: ${phone}`,
                          onPress: () =>
                            openPhoneUrl(
                              getPhoneCallUrl(patient.patient_phone),
                              t('patients.actions.callFailed')
                            ),
                        },
                        {
                          icon: 'paper-plane-outline',
                          label: `${t('patients.actions.telegram')}: ${phone}`,
                          onPress: () =>
                            openPhoneUrl(
                              getTelegramPhoneUrl(patient.patient_phone),
                              t('patients.actions.telegramFailed')
                            ),
                        },
                      ]}
                    />
                  ) : null}
                  {secondaryPhone ? (
                    <ContactLine
                      icon="phone-portrait-outline"
                      label={t('patients.detail.contact.phoneSecondary')}
                      value={secondaryPhone}
                      actions={[
                        {
                          icon: 'call-outline',
                          label: `${t('patients.actions.call')}: ${secondaryPhone}`,
                          onPress: () =>
                            openPhoneUrl(
                              getPhoneCallUrl(patient.patient_secondary_phone),
                              t('patients.actions.callFailed')
                            ),
                        },
                        {
                          icon: 'paper-plane-outline',
                          label: `${t('patients.actions.telegram')}: ${secondaryPhone}`,
                          onPress: () =>
                            openPhoneUrl(
                              getTelegramPhoneUrl(patient.patient_secondary_phone),
                              t('patients.actions.telegramFailed')
                            ),
                        },
                      ]}
                    />
                  ) : null}
                  {patient.patient_address ? (
                    <ContactLine
                      icon="location-outline"
                      label={t('patients.detail.contact.address')}
                      value={patient.patient_address}
                      multiline
                    />
                  ) : null}
                  {dob ? (
                    <ContactLine
                      icon="gift-outline"
                      label={t('patients.detail.contact.dob')}
                      value={dob}
                    />
                  ) : null}
                </View>
              </View>

              <View style={styles.ledgerHeading}>
                <View>
                  <Text style={styles.sectionTitle}>
                    {t('payments.patientLedger.title')}
                  </Text>
                  {treatmentsQuery.data ? (
                    <Text style={styles.sectionSubtitle}>
                      {t('payments.patientLedger.entries', {
                        n: knownTotal ?? treatments.length,
                      })}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          }
          ListEmptyComponent={
            treatmentsQuery.isLoading && !treatmentsQuery.data ? (
              <View style={styles.skeletonList}>
                {Array.from({ length: 3 }).map((_, index) => (
                  <LedgerSkeleton key={index} />
                ))}
              </View>
            ) : treatmentsQuery.isError ? (
              <EmptyState
                iconName={isOnline ? 'cloud-offline-outline' : 'cloud-offline'}
                title={
                  isOnline
                    ? t('payments.patientLedger.loadFailed')
                    : t('network.offline')
                }
                subtitle={!isOnline ? t('network.offlineHint') : undefined}
                tone={isOnline ? 'danger' : 'warning'}
                action={
                  <Button
                    title={t('common.retry')}
                    variant="secondary"
                    size="md"
                    onPress={() => treatmentsQuery.refetch()}
                  />
                }
              />
            ) : (
              <EmptyState
                iconName="receipt-outline"
                title={t('payments.patientLedger.empty')}
              />
            )
          }
          ListFooterComponent={
            treatmentsQuery.isFetchingNextPage ? (
              <ActivityIndicator
                style={styles.footer}
                color={c.brand as string}
              />
            ) : null
          }
          onEndReached={() => {
            if (
              treatmentsQuery.hasNextPage &&
              !treatmentsQuery.isFetchingNextPage
            ) {
              void treatmentsQuery.fetchNextPage()
            }
          }}
          onEndReachedThreshold={0.35}
        />
      </SafeAreaView>
    </View>
  )
}

function ScreenFrame({
  colors,
  children,
}: {
  colors: [string, string, string]
  children: React.ReactNode
}) {
  const c = useColors()
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <LinearGradient
        colors={colors}
        locations={[0, 0.2, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" />
        {children}
      </SafeAreaView>
    </View>
  )
}

function ContactLine({
  icon,
  label,
  value,
  multiline = false,
  actions = [],
}: {
  icon: IconName
  label: string
  value: string
  multiline?: boolean
  actions?: Array<{
    icon: IconName
    label: string
    onPress: () => void
  }>
}) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  return (
    <View style={styles.contactLine}>
      <View
        style={styles.contactCopy}
        accessible
        accessibilityLabel={`${label}: ${value}`}
      >
        <View style={styles.contactIcon}>
          <Icon name={icon} size={15} color={c.brand as string} />
        </View>
        <Text
          style={styles.contactValue}
          numberOfLines={multiline ? 2 : 1}
          adjustsFontSizeToFit={!multiline}
          minimumFontScale={0.84}
        >
          {value}
        </Text>
      </View>
      {actions.length > 0 ? (
        <View style={styles.contactActions}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              onPress={action.onPress}
              hitSlop={8}
              style={({ pressed }) => [
                styles.contactAction,
                pressed && styles.contactActionPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              <Icon
                name={action.icon}
                size={14}
                color={c.brand as string}
              />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  )
}

function LedgerSkeleton() {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonHeading}>
        <Skeleton width="48%" height={14} borderRadius={6} />
        <Skeleton width={76} height={22} borderRadius={8} />
      </View>
      <Skeleton width="100%" height={44} borderRadius={10} />
    </View>
  )
}

function formatPatientDate(value: string, locale: Locale): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return value
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  )
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    flex: { flex: 1 },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    listContent: {
      flexGrow: 1,
      paddingHorizontal: spacing.lg,
    },
    headerContent: {
      gap: spacing.lg,
      paddingBottom: spacing.sm,
    },
    profileCard: {
      minHeight: 108,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
      padding: spacing.lg,
      borderRadius: radius.xxl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.brandSoft,
      backgroundColor: c.background,
      shadowColor: '#000000',
      shadowOpacity: 0.045,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    avatarFrame: {
      width: 80,
      height: 80,
      padding: 2,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.brandSoft,
      backgroundColor: c.brandSurface,
    },
    avatar: {
      borderRadius: radius.lg,
      backgroundColor: c.fillQuaternary,
    },
    contacts: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    contactLine: {
      minHeight: 24,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    contactCopy: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    contactIcon: {
      width: 20,
      height: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    contactValue: {
      flex: 1,
      minWidth: 0,
      fontFamily: font('500'),
      fontSize: 13,
      lineHeight: 17,
      fontWeight: '500',
      color: c.label,
    },
    contactActions: {
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    contactAction: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.brandSoft,
      backgroundColor: c.brandSurface,
    },
    contactActionPressed: {
      opacity: 0.68,
      transform: [{ scale: 0.96 }],
    },
    ledgerHeading: {
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    sectionTitle: {
      ...typography.headline,
      color: c.brandDeep,
    },
    sectionSubtitle: {
      marginTop: 1,
      ...typography.caption1,
      color: c.labelSecondary,
    },
    rowGap: {
      height: spacing.sm,
    },
    skeletonList: {
      gap: spacing.sm,
    },
    skeletonCard: {
      gap: 10,
      padding: spacing.md,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.separator,
      backgroundColor: c.background,
    },
    skeletonHeading: {
      minHeight: 24,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    footer: {
      paddingVertical: spacing.lg,
    },
  })
}
