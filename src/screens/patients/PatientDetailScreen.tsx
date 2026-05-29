import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

import PatientAvatar from '../../components/ui/PatientAvatar'
import FinanceCard from '../../components/dashboard/FinanceCard'
import TreatmentHistoryRow from '../../components/payments/TreatmentHistoryRow'
import TreatmentDetailSheet from '../../components/payments/TreatmentDetailSheet'
import { TreatmentEditSheet } from '../../components/treatments'
import Icon, { IconName } from '../../components/ui/Icon'
import EmptyState from '../../components/ui/EmptyState'
import Button from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'

import { useI18n } from '../../i18n'
import { useAuthStore } from '../../stores/auth'
import { useUIStore } from '../../stores/ui'
import { canManage } from '../../lib/permissions'
import { isOfflineError } from '../../lib/offlineGuard'
import { getPatient, getPatientOverview, archivePatient, restorePatient } from '../../api/patients'
import { listTreatments } from '../../api/treatments'
import { formatCurrencyParts } from '../../lib/format'
import { radius, spacing, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import type { MainStackParams } from '../../navigation'
import type { ApiTreatment } from '../../types'

type Route = RouteProp<MainStackParams, 'PatientDetail'>
type Nav = NativeStackNavigationProp<MainStackParams, 'PatientDetail'>

export default function PatientDetailScreen() {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const toast = useToast()
  const user = useAuthStore((s) => s.user)

  const canManagePatient = canManage(user, 'patients')
  const canCreateAppointment = canManage(user, 'appointments')

  const patientQuery = useQuery({
    queryKey: ['patients', 'detail', route.params.id],
    queryFn: () => getPatient(route.params.id),
    staleTime: 60_000,
  })

  const overviewQuery = useQuery({
    queryKey: ['patients', 'overview', route.params.id],
    queryFn: () => getPatientOverview(route.params.id),
    staleTime: 60_000,
  })

  const treatmentsQuery = useQuery({
    queryKey: ['treatments', 'list', { patient_id: route.params.id }],
    queryFn: () => listTreatments({ patient_id: route.params.id }),
    staleTime: 60_000,
  })

  const patient = patientQuery.data
  const overview = overviewQuery.data
  const treatments = treatmentsQuery.data?.data ?? []
  const isLoading = patientQuery.isLoading && !patient

  // Treatment sheets — split intentionally:
  //   • Detail sheet: view treatment + record payment (focused on $ flow)
  //   • Edit sheet:   change fields / teeth / photos (focused on records)
  // Tapping a row opens detail; tapping "+" or "Edit" opens edit.
  const [detailTreatment, setDetailTreatment] = useState<ApiTreatment | null>(null)
  const [editState, setEditState] = useState<
    | { mode: 'create' }
    | { mode: 'edit'; treatment: ApiTreatment }
    | null
  >(null)
  const canManageTreatments = canManage(user, 'patients')

  const onBack = () => {
    Haptics.selectionAsync()
    navigation.goBack()
  }

  const onCall = () => {
    if (!patient?.phone) return
    Haptics.selectionAsync()
    Linking.openURL(`tel:${patient.phone.replace(/\s/g, '')}`).catch(() => {})
  }

  const onSchedule = () => {
    if (!canCreateAppointment) return
    Haptics.selectionAsync()
    useUIStore.getState().openCreateAppointment()
  }

  const onEdit = () => {
    if (!canManagePatient) return
    Haptics.selectionAsync()
    useUIStore.getState().openPatientForm(route.params.id)
  }

  const queryClient = useQueryClient()

  const archiveMutation = useMutation({
    mutationFn: () => archivePatient(route.params.id),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      toast.success(t('patients.detail.archivedToast'))
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      navigation.goBack()
    },
    onError: (err) => {
      if (isOfflineError(err)) return
      toast.error(t('patients.form.failed'))
    },
  })

  const restoreMutation = useMutation({
    mutationFn: () => restorePatient(route.params.id),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      toast.success(t('patients.detail.restoredToast'))
      queryClient.invalidateQueries({ queryKey: ['patients'] })
    },
    onError: (err) => {
      if (isOfflineError(err)) return
      toast.error(t('patients.form.failed'))
    },
  })

  const onArchivePress = () => {
    Alert.alert(t('patients.detail.archiveConfirm'), t('patients.detail.archiveConfirmSub'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('patients.detail.actions.archive'),
        style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          archiveMutation.mutate()
        },
      },
    ])
  }

  const debtParts = overview ? formatCurrencyParts(overview.total_debt, locale) : null
  const paidParts = overview ? formatCurrencyParts(overview.total_paid, locale) : null
  const balanceParts = overview ? formatCurrencyParts(overview.total_balance, locale) : null

  if (isLoading) {
    return (
      <View style={[styles.root, styles.center]}>
        <SafeAreaView style={styles.flex} edges={['top']}>
          <StatusBar barStyle="dark-content" />
          <ActivityIndicator color={c.brand as string} />
        </SafeAreaView>
      </View>
    )
  }

  if (!patient) {
    return (
      <View style={[styles.root, styles.center]}>
        <EmptyState iconName="alert-circle-outline" title={t('patients.notFound')} />
      </View>
    )
  }

  const dob = patient.date_of_birth ? new Date(patient.date_of_birth) : null
  const dobLabel = dob
    ? new Intl.DateTimeFormat(localeToIntl(locale), {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(dob)
    : null

  const hasMedical = Boolean(
    patient.allergies || patient.current_medications || patient.medical_history
  )

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[c.brandSurface, c.background, c.background]}
        locations={[0, 0.2, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" />

        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={onBack} hitSlop={12} style={styles.iconBtn}>
            <Icon name="chevron-back" size={22} color={c.brand as string} />
          </Pressable>
          <Text style={styles.topTitle} numberOfLines={1}>
            {patient.full_name}
          </Text>
          {canManagePatient ? (
            <Pressable onPress={onEdit} hitSlop={12} style={styles.iconBtn}>
              <Icon name="create-outline" size={20} color={c.brand as string} />
            </Pressable>
          ) : (
            <View style={{ width: 34 }} />
          )}
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={styles.hero}>
            <PatientAvatar
              name={patient.full_name}
              size={80}
              uri={patient.photo_thumbnail_url ?? patient.photo_url}
            />
            <Text style={styles.heroName} numberOfLines={1}>
              {patient.full_name}
            </Text>
            <Text style={styles.heroId}>{patient.patient_id}</Text>
            {patient.categories && patient.categories.length > 0 ? (
              <View style={styles.heroCategoryRow}>
                {patient.categories.slice(0, 3).map((cat) => (
                  <View
                    key={cat.id}
                    style={[styles.heroCategoryPill, { backgroundColor: `${cat.color}1A` }]}
                  >
                    <View style={[styles.heroCategoryDot, { backgroundColor: cat.color }]} />
                    <Text style={[styles.heroCategoryText, { color: cat.color }]}>
                      {cat.name}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Quick actions */}
            <View style={styles.actions}>
              <ActionButton
                c={c}
                iconName="call-outline"
                label={t('patients.detail.actions.call')}
                onPress={onCall}
                disabled={!patient.phone}
              />
              <ActionButton
                c={c}
                iconName="calendar-outline"
                label={t('patients.detail.actions.schedule')}
                onPress={onSchedule}
                disabled={!canCreateAppointment}
                primary
              />
              <ActionButton
                c={c}
                iconName="create-outline"
                label={t('patients.detail.actions.edit')}
                onPress={onEdit}
                disabled={!canManagePatient}
              />
            </View>
          </View>

          {/* Contact */}
          <Section c={c} title={t('patients.detail.sections.contact')}>
            {patient.phone ? (
              <DetailRow
                c={c}
                iconName="call-outline"
                label={t('patients.detail.contact.phone')}
                value={patient.phone}
                onPress={onCall}
              />
            ) : null}
            {patient.secondary_phone ? (
              <DetailRow
                c={c}
                iconName="call-outline"
                label={t('patients.detail.contact.phoneSecondary')}
                value={patient.secondary_phone}
              />
            ) : null}
            {patient.address ? (
              <DetailRow
                c={c}
                iconName="location-outline"
                label={t('patients.detail.contact.address')}
                value={patient.address}
              />
            ) : null}
            {dobLabel ? (
              <DetailRow
                c={c}
                iconName="gift-outline"
                label={t('patients.detail.contact.dob')}
                value={dobLabel}
              />
            ) : null}
          </Section>

          {/* Medical */}
          {hasMedical ? (
            <Section c={c} title={t('patients.detail.sections.medical')}>
              {patient.allergies ? (
                <DetailRow
                  c={c}
                  iconName="warning-outline"
                  iconColor={c.danger}
                  iconBg="rgba(255, 59, 48, 0.10)"
                  label={t('patients.detail.medical.allergies')}
                  value={patient.allergies}
                />
              ) : null}
              {patient.current_medications ? (
                <DetailRow
                  c={c}
                  iconName="medkit-outline"
                  iconColor={c.brand}
                  iconBg={c.brandLight}
                  label={t('patients.detail.medical.medications')}
                  value={patient.current_medications}
                />
              ) : null}
              {patient.medical_history ? (
                <DetailRow
                  c={c}
                  iconName="document-text-outline"
                  label={t('patients.detail.medical.history')}
                  value={patient.medical_history}
                />
              ) : null}
            </Section>
          ) : null}

          {/* Balance */}
          {overview && debtParts && paidParts && balanceParts ? (
            <View style={styles.balanceSectionWrap}>
              <Text style={styles.sectionTitle}>{t('patients.detail.sections.balance')}</Text>
              <View style={styles.balanceRow}>
                <FinanceCard
                  iconName="trending-up-outline"
                  label={t('patients.detail.balance.totalPaid')}
                  value={paidParts.value}
                  unit={paidParts.unit}
                  tone="success"
                />
                <FinanceCard
                  iconName="warning-outline"
                  label={t('patients.detail.balance.totalDebt')}
                  value={debtParts.value}
                  unit={debtParts.unit}
                  tone={overview.total_debt > 0 ? 'danger' : 'success'}
                />
                <FinanceCard
                  iconName="wallet-outline"
                  label={t('patients.detail.balance.balance')}
                  value={balanceParts.value}
                  unit={balanceParts.unit}
                  tone={
                    overview.total_balance > 0
                      ? 'warning'
                      : overview.total_balance < 0
                        ? 'success'
                        : 'neutral'
                  }
                />
              </View>
            </View>
          ) : null}

          {/* Odontogram quick-link */}
          <Pressable
            style={styles.odontogramLink}
            onPress={() => {
              Haptics.selectionAsync()
              navigation.navigate('PatientOdontogram', {
                patientId: route.params.id,
                patientName: patient?.full_name,
              })
            }}
            accessibilityRole="button"
          >
            <View style={styles.odontogramIconBubble}>
              <Icon name="medical-outline" size={20} color={c.brand as string} />
            </View>
            <View style={styles.odontogramLinkText}>
              <Text style={styles.odontogramLinkTitle}>{t('odontogram.open')}</Text>
              <Text style={styles.odontogramLinkSub}>{t('odontogram.pickerHint')}</Text>
            </View>
            <Icon name="chevron-forward" size={18} color={c.labelTertiary as string} />
          </Pressable>

          {/* Treatment history */}
          <View>
            <View style={styles.historyHeader}>
              <Text style={styles.sectionTitle}>{t('patients.detail.sections.history')}</Text>
              {canManageTreatments ? (
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync()
                    setEditState({ mode: 'create' })
                  }}
                  hitSlop={8}
                  style={styles.historyAddBtn}
                  accessibilityRole="button"
                  accessibilityLabel={t('treatment.create')}
                >
                  <Icon name="add" size={18} color={c.brand as string} />
                  <Text style={styles.historyAddText}>{t('treatment.create')}</Text>
                </Pressable>
              ) : null}
            </View>
            {treatments.length === 0 ? (
              <EmptyState
                iconName="time-outline"
                title={t('patients.detail.noHistory')}
                style={{ paddingVertical: spacing.xl }}
              />
            ) : (
              <View style={styles.historyList}>
                {treatments.map((tr, idx) => (
                  <React.Fragment key={tr.id}>
                    <TreatmentHistoryRow
                      treatment={tr}
                      onPress={() => setDetailTreatment(tr)}
                    />
                    {idx < treatments.length - 1 ? <View style={styles.rowSep} /> : null}
                  </React.Fragment>
                ))}
              </View>
            )}
          </View>

          {/* Archive / restore — write action, gated by patients.manage. */}
          {canManagePatient ? (
            patient.is_archived ? (
              <Button
                title={t('patients.detail.actions.unarchive')}
                variant="secondary"
                size="lg"
                fullWidth
                loading={restoreMutation.isPending}
                onPress={() => restoreMutation.mutate()}
                style={{ marginTop: spacing.xl }}
              />
            ) : (
              <Button
                title={t('patients.detail.actions.archive')}
                variant="destructive"
                size="lg"
                fullWidth
                loading={archiveMutation.isPending}
                onPress={onArchivePress}
                style={{ marginTop: spacing.xl }}
              />
            )
          ) : null}
        </ScrollView>
      </SafeAreaView>

      <TreatmentDetailSheet
        visible={detailTreatment !== null}
        treatment={detailTreatment}
        onClose={() => setDetailTreatment(null)}
        onEditRequested={(tr) => {
          // Close the detail (read+payment) sheet and open the edit
          // (fields+teeth+photos) sheet for the same row. We defer the open
          // by one frame so the dismiss animation can play before the new
          // sheet slides in — otherwise the two backdrops stack and look glitchy.
          setDetailTreatment(null)
          setTimeout(() => setEditState({ mode: 'edit', treatment: tr }), 220)
        }}
      />

      <TreatmentEditSheet
        visible={editState !== null}
        patientId={route.params.id}
        treatment={editState?.mode === 'edit' ? editState.treatment : null}
        onClose={() => setEditState(null)}
      />
    </View>
  )
}

function Section({
  c,
  title,
  children,
}: {
  c: Colors
  title: string
  children: React.ReactNode
}) {
  const styles = useMemo(() => makeStyles(c), [c])
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  )
}

function DetailRow({
  c,
  iconName,
  iconColor,
  iconBg,
  label,
  value,
  onPress,
}: {
  c: Colors
  iconName: IconName
  iconColor?: string
  iconBg?: string
  label: string
  value: string
  onPress?: () => void
}) {
  const styles = useMemo(() => makeStyles(c), [c])
  const resolvedIconColor = iconColor ?? c.brand
  const resolvedIconBg = iconBg ?? c.brandLight
  const Inner = (
    <View style={styles.detailRow}>
      <View style={[styles.detailIcon, { backgroundColor: resolvedIconBg }]}>
        <Icon name={iconName} size={16} color={resolvedIconColor} />
      </View>
      <View style={styles.detailText}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  )

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.7 }}>
        {Inner}
      </Pressable>
    )
  }
  return Inner
}

function ActionButton({
  c,
  iconName,
  label,
  onPress,
  disabled,
  primary,
}: {
  c: Colors
  iconName: IconName
  label: string
  onPress: () => void
  disabled?: boolean
  primary?: boolean
}) {
  const styles = useMemo(() => makeStyles(c), [c])
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionBtn,
        primary && styles.actionBtnPrimary,
        disabled && styles.actionBtnDisabled,
        pressed && !disabled && styles.actionBtnPressed,
      ]}
    >
      <Icon
        name={iconName}
        size={20}
        color={primary ? '#FFFFFF' : (c.brandDeep as string)}
      />
      <Text style={[styles.actionLabel, primary && styles.actionLabelPrimary]}>{label}</Text>
    </Pressable>
  )
}

function localeToIntl(locale: string): string {
  if (locale === 'uz') return 'uz-UZ'
  if (locale === 'ru') return 'ru-RU'
  return 'en-US'
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    flex: { flex: 1 },
    center: { alignItems: 'center', justifyContent: 'center' },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: 10,
    },
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.brandLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    topTitle: {
      flex: 1,
      ...typography.headline,
      color: c.brandDeep,
      textAlign: 'center',
    },
    scroll: {
      paddingBottom: 60,
      gap: spacing.lg,
    },
    hero: {
      alignItems: 'center',
      paddingTop: spacing.md,
      paddingHorizontal: spacing.xl,
      gap: 6,
    },
    heroName: {
      ...typography.title2,
      color: c.brandDeep,
      marginTop: 10,
      textAlign: 'center',
    },
    heroId: {
      fontFamily: font('600'),
      fontSize: 13,
      fontWeight: '600',
      color: c.labelSecondary,
      letterSpacing: 0.4,
    },
    heroCategoryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 6,
      marginTop: 8,
    },
    heroCategoryPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.pill,
    },
    heroCategoryDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    heroCategoryText: {
      fontFamily: font('600'),
      fontSize: 11,
      fontWeight: '600',
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.md,
      width: '100%',
      marginTop: spacing.lg,
    },
    actionBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: radius.xl,
      backgroundColor: c.brandLight,
    },
    actionBtnPrimary: {
      backgroundColor: c.brand,
    },
    actionBtnDisabled: {
      opacity: 0.4,
    },
    actionBtnPressed: {
      opacity: 0.85,
    },
    actionLabel: {
      fontFamily: font('600'),
      fontSize: 12,
      fontWeight: '600',
      color: c.brandDeep,
    },
    actionLabelPrimary: {
      color: '#FFFFFF',
    },
    sectionTitle: {
      fontFamily: font('700'),
      fontSize: 12,
      fontWeight: '700',
      color: c.labelSecondary,
      letterSpacing: 0.6,
      paddingHorizontal: spacing.xl,
      marginBottom: 8,
    },
    sectionCard: {
      backgroundColor: c.background,
      borderRadius: radius.xl,
      marginHorizontal: 16,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      overflow: 'hidden',
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    detailIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailText: { flex: 1, gap: 2 },
    detailLabel: {
      fontFamily: font('600'),
      fontSize: 11,
      fontWeight: '600',
      color: c.labelSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    detailValue: {
      ...typography.body,
      color: c.label,
    },
    balanceSectionWrap: {
      gap: 8,
    },
    balanceRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: 16,
    },
    historyList: {
      backgroundColor: c.background,
      borderRadius: radius.xl,
      marginHorizontal: 16,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
    historyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingRight: 16,
    },
    odontogramLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginHorizontal: 16,
      backgroundColor: c.background,
      borderRadius: radius.xl,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
    odontogramIconBubble: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.brandLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    odontogramLinkText: {
      flex: 1,
    },
    odontogramLinkTitle: {
      ...typography.bodyEmphasized,
      fontFamily: font('600'),
      color: c.label,
    },
    odontogramLinkSub: {
      ...typography.footnote,
      color: c.labelSecondary as string,
      marginTop: 2,
    },
    historyAddBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: radius.pill,
      backgroundColor: c.brandLight,
    },
    historyAddText: {
      fontFamily: font('600'),
      fontSize: 12,
      color: c.brand as string,
    },
    rowSep: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.separator as string,
      marginLeft: 20 + 38 + 12,
    },
  })
}
