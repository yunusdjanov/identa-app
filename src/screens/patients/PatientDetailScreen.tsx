import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
  ActivityIndicator,
  Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

import PatientAvatar from '../../components/ui/PatientAvatar'
import TreatmentHistoryRow from '../../components/payments/TreatmentHistoryRow'
import { TreatmentEditSheet } from '../../components/treatments'
import Icon, { IconName } from '../../components/ui/Icon'
import EmptyState from '../../components/ui/EmptyState'
import Button from '../../components/ui/Button'
import Skeleton from '../../components/ui/Skeleton'
import OverflowMenuButton from '../../components/ui/OverflowMenuButton'
import CompactIconButton from '../../components/ui/CompactIconButton'
import { useToast } from '../../components/ui/Toast'
import { useDialog } from '../../components/ui/Dialog'
import AppHeader from '../../components/navigation/AppHeader'
import PatientGeneralPhotos, {
  PATIENT_GENERAL_PHOTO_LIMIT,
} from '../../components/patients/PatientGeneralPhotos'
import PatientCategoryBadge from '../../components/patients/PatientCategoryBadge'
import ImagePickerSheet, { type PickedAsset } from '../../components/gallery/ImagePickerSheet'
import LightboxViewer from '../../components/gallery/LightboxViewer'

import { useI18n } from '../../i18n'
import { useAuthStore } from '../../stores/auth'
import { useUIStore } from '../../stores/ui'
import { canManage, canView } from '../../lib/permissions'
import { getPatientPhotoUris } from '../../lib/patientPhoto'
import {
  formatStoredPhone,
  getPhoneCallUrl,
  getTelegramPhoneUrl,
} from '../../lib/phoneFormat'
import {
  loadProtectedPatientPhoto,
  normalizeProtectedPatientMediaUri,
} from '../../lib/protectedPatientPhoto'
import {
  getKnownTreatmentTotal,
  getNextTreatmentPageParam,
  mergeTreatmentHistoryPages,
} from '../../lib/treatmentPagination'
import { isOfflineError } from '../../lib/offlineGuard'
import {
  getPatient,
  getPatientOverview,
  archivePatient,
  restorePatient,
  forceDeletePatient,
  uploadPatientGeneralPhoto,
  replacePatientGeneralPhoto,
  deletePatientGeneralPhoto,
} from '../../api/patients'
import { deletePatientTreatment, listPatientTreatments } from '../../api/treatments'
import {
  formatCurrencyParts,
  formatDayMonth,
  fromLocalDateKey,
} from '../../lib/format'
import { radius, spacing, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { API_URL } from '../../constants'
import type { MainStackParams } from '../../navigation'
import type { ApiPatient, ApiPatientClinicalPhoto, ApiTreatment } from '../../types'

type Route = RouteProp<MainStackParams, 'PatientDetail'>
type Nav = NativeStackNavigationProp<MainStackParams, 'PatientDetail'>

const PATIENT_GENERAL_PHOTO_MAX_BYTES = 5 * 1024 * 1024
const TREATMENT_HISTORY_PAGE_SIZE = 10
const PATIENT_CONTENT_MAX_WIDTH = 760

interface CompactContactAction {
  iconName: IconName
  label: string
  onPress: () => void
}

export default function PatientDetailScreen() {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const toast = useToast()
  const { actionSheet, confirm } = useDialog()
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.tokens?.access_token)
  const queryClient = useQueryClient()
  const patientDetailQueryKey = ['patients', 'detail', route.params.id] as const

  const canViewPatient = canView(user, 'patients')
  const canManagePatient = canManage(user, 'patients')
  const canCreateAppointment = canManage(user, 'appointments')
  const canViewAppointments = canView(user, 'appointments')
  const canViewPayments = canView(user, 'payments')

  const patientQuery = useQuery({
    queryKey: patientDetailQueryKey,
    queryFn: () => getPatient(route.params.id, { rememberRecent: true }),
    staleTime: 60_000,
    // Opening the record is also what updates the backend's profile-scoped
    // recent list. A fresh cached row must not skip that side effect.
    refetchOnMount: 'always',
    // Scan results are asynchronous. Poll only while this patient's General
    // Photos contain a pending item, then stop automatically.
    refetchInterval: (query) =>
      query.state.data?.oral_photo_galleries?.smile?.some(
        (photo) => photo.scan_status === 'pending'
      )
        ? 3_000
        : false,
    enabled: canViewPatient,
  })

  useEffect(() => {
    if (canViewPatient && patientQuery.data && !patientQuery.data.is_archived) {
      queryClient.invalidateQueries({ queryKey: ['patients', 'recent'] })
    }
  }, [canViewPatient, patientQuery.data, queryClient])

  const overviewQuery = useQuery({
    queryKey: ['patients', 'overview', route.params.id],
    queryFn: () => getPatientOverview(route.params.id),
    staleTime: 60_000,
    // The overview only feeds finance and appointment sections. Avoid a
    // request that cannot produce visible content for restricted roles.
    enabled: canViewPatient && (canViewAppointments || canViewPayments),
  })

  const treatmentsQuery = useInfiniteQuery({
    queryKey: ['treatments', 'list', { patient_id: route.params.id }],
    queryFn: ({ pageParam }) =>
      listPatientTreatments(route.params.id, {
        page: pageParam,
        per_page: TREATMENT_HISTORY_PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      getNextTreatmentPageParam(
        lastPage,
        lastPageParam,
        TREATMENT_HISTORY_PAGE_SIZE
      ),
    staleTime: 60_000,
    enabled: canViewPatient,
  })

  const patient = patientQuery.data
  const overview = overviewQuery.data
  const treatments = useMemo(
    () => mergeTreatmentHistoryPages(treatmentsQuery.data?.pages),
    [treatmentsQuery.data]
  )
  const treatmentTotal = getKnownTreatmentTotal(treatmentsQuery.data?.pages[0])
  const isLoading = patientQuery.isLoading && !patient

  // History rows edit the record directly; creation uses the same focused sheet.
  const [editState, setEditState] = useState<
    | { mode: 'create' }
    | { mode: 'edit'; treatment: ApiTreatment }
    | null
  >(null)
  const [generalPhotoPickerVisible, setGeneralPhotoPickerVisible] = useState(false)
  const [replaceGeneralPhoto, setReplaceGeneralPhoto] = useState<ApiPatientClinicalPhoto | null>(null)
  const [generalPhotoUploadingCount, setGeneralPhotoUploadingCount] = useState(0)
  const [previewLoadingPhotoId, setPreviewLoadingPhotoId] = useState<string | null>(null)
  const [generalPhotoPreview, setGeneralPhotoPreview] = useState<{
    photo: ApiPatientClinicalPhoto
    uri: string
  } | null>(null)
  const canManageTreatments = canManage(user, 'patients')

  const treatmentDeleteMutation = useMutation({
    mutationFn: (treatmentId: string) =>
      deletePatientTreatment(route.params.id, treatmentId),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      toast.success(t('treatment.deleted'))
      queryClient.invalidateQueries({ queryKey: ['treatments'] })
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (err) => {
      if (isOfflineError(err)) return
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      toast.error(t('treatment.deleteFailed'))
    },
  })

  const onDeleteTreatment = async (treatment: ApiTreatment) => {
    if (!canManageTreatments || patient?.is_archived || treatmentDeleteMutation.isPending) return

    const selected = await actionSheet({
      title: treatment.treatment_type,
      message: formatDayMonth(fromLocalDateKey(treatment.treatment_date), locale),
      options: [
        {
          label: t('common.delete'),
          icon: 'trash-outline',
          destructive: true,
        },
      ],
      layout: 'grid',
      cancelLabel: t('common.close'),
    })

    if (selected !== 0) return

    const confirmed = await confirm({
      title: t('treatment.deleteConfirmTitle'),
      message: `${t('treatment.deleteConfirmBody')}\n\n${treatment.treatment_type}`,
      confirmLabel: t('common.delete'),
      destructive: true,
    })
    if (confirmed) treatmentDeleteMutation.mutate(treatment.id)
  }

  const onBack = () => {
    Haptics.selectionAsync()
    navigation.goBack()
  }

  const onCallPhone = (phone: string) => {
    const url = getPhoneCallUrl(phone)
    if (!url) return
    Haptics.selectionAsync()
    Linking.openURL(url).catch(() => toast.error(t('patients.actions.callFailed')))
  }

  const onTelegram = (url: string) => {
    Haptics.selectionAsync()
    Linking.openURL(url).catch(() => toast.error(t('patients.actions.telegramFailed')))
  }

  const onSchedule = () => {
    if (!canCreateAppointment || patient?.is_archived) return
    Haptics.selectionAsync()
    // Pre-select this patient so the create sheet opens skipping the search
    // step — matches the web's `?patientId=` deep link from the detail page.
    useUIStore.getState().openCreateAppointment({ patient: patient ?? undefined })
  }

  const onEdit = () => {
    if (!canManagePatient || patient?.is_archived) return
    Haptics.selectionAsync()
    useUIStore.getState().openPatientForm(route.params.id)
  }

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

  const forceDeleteMutation = useMutation({
    mutationFn: () => forceDeletePatient(route.params.id),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      toast.success(t('patients.detail.deletedPermanent'))
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      navigation.goBack()
    },
    onError: (err) => {
      if (isOfflineError(err)) return
      toast.error(t('patients.form.failed'))
    },
  })

  const updatePatientAfterGeneralPhotoMutation = (updatedPatient: ApiPatient) => {
    queryClient.setQueryData(patientDetailQueryKey, updatedPatient)
    queryClient.invalidateQueries({ queryKey: ['patients', 'list'] })
  }

  const generalPhotoUploadMutation = useMutation({
    mutationFn: async ({
      assets,
      replacePhotoId,
    }: {
      assets: PickedAsset[]
      replacePhotoId?: string
    }) => {
      let updatedPatient: ApiPatient | null = null
      setGeneralPhotoUploadingCount(replacePhotoId ? 0 : assets.length)

      for (let index = 0; index < assets.length; index += 1) {
        const asset = assets[index]!
        updatedPatient = replacePhotoId
          ? await replacePatientGeneralPhoto(route.params.id, replacePhotoId, asset)
          : await uploadPatientGeneralPhoto(route.params.id, asset)
        updatePatientAfterGeneralPhotoMutation(updatedPatient)
        if (!replacePhotoId) {
          setGeneralPhotoUploadingCount(assets.length - index - 1)
        }
      }

      if (!updatedPatient) throw new Error('No photo selected')
      return updatedPatient
    },
    onSuccess: (updatedPatient) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      const processing = updatedPatient.oral_photo_galleries?.smile?.some(
        (photo) => photo.scan_status === 'pending'
      )
      toast.success(t(
        processing
          ? 'patients.detail.generalPhotos.processing'
          : 'patients.detail.generalPhotos.uploaded'
      ))
    },
    onError: (err) => {
      if (isOfflineError(err)) return
      toast.error(t('patients.detail.generalPhotos.uploadFailed'))
    },
    onSettled: () => {
      setGeneralPhotoUploadingCount(0)
      setReplaceGeneralPhoto(null)
      queryClient.invalidateQueries({ queryKey: patientDetailQueryKey })
    },
  })

  const generalPhotoDeleteMutation = useMutation({
    mutationFn: (photoId: string) => deletePatientGeneralPhoto(route.params.id, photoId),
    onSuccess: (updatedPatient) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      updatePatientAfterGeneralPhotoMutation(updatedPatient)
      setGeneralPhotoPreview(null)
      toast.success(t('patients.detail.generalPhotos.deleted'))
    },
    onError: (err) => {
      if (isOfflineError(err)) return
      toast.error(t('patients.detail.generalPhotos.uploadFailed'))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: patientDetailQueryKey })
    },
  })

  const generalPhotos = patient?.oral_photo_galleries?.smile ?? []
  const remainingGeneralPhotoSlots = Math.max(
    0,
    PATIENT_GENERAL_PHOTO_LIMIT - generalPhotos.length
  )

  const openGeneralPhotoPicker = (photo?: ApiPatientClinicalPhoto) => {
    if (!canManagePatient || patient?.is_archived || generalPhotoUploadMutation.isPending) return
    setReplaceGeneralPhoto(photo ?? null)
    setGeneralPhotoPickerVisible(true)
  }

  const onPickedGeneralPhotos = (assets: PickedAsset[]) => {
    const accepted = assets.filter((asset) => {
      return typeof asset.fileSize !== 'number' || asset.fileSize <= PATIENT_GENERAL_PHOTO_MAX_BYTES
    })
    if (accepted.length !== assets.length) {
      toast.error(t('patients.detail.generalPhotos.tooLarge'))
    }
    if (accepted.length === 0) return

    const selected = replaceGeneralPhoto
      ? accepted.slice(0, 1)
      : accepted.slice(0, remainingGeneralPhotoSlots)
    if (selected.length === 0) return
    generalPhotoUploadMutation.mutate({
      assets: selected,
      replacePhotoId: replaceGeneralPhoto?.id,
    })
  }

  const onRemoveGeneralPhoto = async (photo: ApiPatientClinicalPhoto) => {
    if (!canManagePatient || patient?.is_archived || generalPhotoDeleteMutation.isPending) return
    const ok = await confirm({
      title: t('patients.detail.generalPhotos.deleteConfirm'),
      message: t('patients.detail.generalPhotos.deleteConfirmSub'),
      confirmLabel: t('common.delete'),
      destructive: true,
    })
    if (ok) generalPhotoDeleteMutation.mutate(photo.id)
  }

  const onManageGeneralPhoto = async (photo: ApiPatientClinicalPhoto) => {
    if (!canManagePatient || patient?.is_archived || generalPhotoUploadMutation.isPending) return
    Haptics.selectionAsync()
    const index = await actionSheet({
      title: t('patients.detail.generalPhotos.title'),
      options: [
        {
          label: t('patients.detail.generalPhotos.replace'),
          icon: 'create-outline',
        },
        {
          label: t('patients.detail.generalPhotos.remove'),
          icon: 'trash-outline',
          destructive: true,
        },
      ],
    })
    if (index === 0) {
      setGeneralPhotoPreview(null)
      openGeneralPhotoPicker(photo)
    } else if (index === 1) {
      await onRemoveGeneralPhoto(photo)
    }
  }

  const onPressGeneralPhoto = async (photo: ApiPatientClinicalPhoto) => {
    if (photo.scan_status !== 'approved') {
      await onManageGeneralPhoto(photo)
      return
    }

    const remoteUri = photo.preview_url ?? photo.url ?? photo.thumbnail_url
    if (!remoteUri) {
      toast.error(t('patients.detail.generalPhotos.previewFailed'))
      return
    }

    setPreviewLoadingPhotoId(photo.id)
    try {
      const normalizedUri = normalizeProtectedPatientMediaUri(remoteUri)
      const isProtected = normalizedUri === API_URL ||
        normalizedUri.startsWith(`${API_URL}/`) ||
        normalizedUri.startsWith(`${API_URL}?`)
      const previewUri = isProtected
        ? accessToken && user?.id
          ? await loadProtectedPatientPhoto(normalizedUri, accessToken, user.id)
          : null
        : normalizedUri
      if (!previewUri) throw new Error('Protected media session unavailable')
      setGeneralPhotoPreview({ photo, uri: previewUri })
    } catch {
      toast.error(t('patients.detail.generalPhotos.previewFailed'))
    } finally {
      setPreviewLoadingPhotoId(null)
    }
  }

  // Keep overflow focused on lifecycle management. Call, Telegram and Edit
  // already live in the profile card and should not be duplicated here.
  const onMoreActions = async () => {
    if (!patient) return
    Haptics.selectionAsync()

    const actions = patient.is_archived
      ? [
          {
            key: 'restore' as const,
            label: t('patients.detail.actions.unarchive'),
            icon: 'arrow-undo-outline' as const,
          },
          {
            key: 'delete' as const,
            label: t('patients.detail.deletePermanent'),
            icon: 'trash-outline' as const,
            destructive: true,
          },
        ]
      : [
          {
            key: 'archive' as const,
            label: t('patients.detail.actions.archive'),
            icon: 'archive-outline' as const,
            destructive: true,
          },
        ]

    const idx = await actionSheet({
      title: patient.full_name,
      message: formatStoredPhone(patient.phone) || undefined,
      options: actions.map(({ label, icon, destructive }) => ({
        label,
        icon,
        destructive,
      })),
      layout: 'grid',
      cancelLabel: t('common.close'),
    })
    const selected = actions[idx]?.key

    if (selected === 'archive') {
      const ok = await confirm({
        title: t('patients.detail.archiveConfirm'),
        message: t('patients.detail.archiveConfirmSub'),
        confirmLabel: t('patients.detail.actions.archive'),
        destructive: true,
      })
      if (ok) archiveMutation.mutate()
    } else if (selected === 'restore') {
      restoreMutation.mutate()
    } else if (selected === 'delete') {
      const ok = await confirm({
        title: t('patients.detail.deletePermanentConfirm'),
        message: t('patients.detail.deletePermanentConfirmSub'),
        confirmLabel: t('common.delete'),
        destructive: true,
        // Mirror the web: must type the patient's name to enable delete.
        requireText: patient.full_name,
        requireTextLabel: t('patients.detail.deletePermanentTypeName', { name: patient.full_name }),
        requireTextPlaceholder: patient.full_name,
      })
      if (ok) forceDeleteMutation.mutate()
    }
  }

  const balanceCurrencies = overview && canViewPayments
    ? (['UZS', 'USD'] as const)
        .map((currency) => {
          const summary = overview.totals_by_currency?.[currency] ??
            (currency === 'UZS'
              ? {
                  total_debt: overview.total_debt,
                  total_paid: overview.total_paid,
                  total_balance: overview.total_balance,
                }
              : { total_debt: 0, total_paid: 0, total_balance: 0 })
          return { currency, summary }
        })
        .filter(({ currency, summary }) =>
          currency === 'UZS' ||
          summary.total_debt !== 0 ||
          summary.total_paid !== 0 ||
          summary.total_balance !== 0
        )
    : []
  const financeCurrencyValues = balanceCurrencies.map(({ currency, summary }) => ({
    currency,
    paid: formatCurrencyParts(summary.total_paid, locale, currency),
    debt: formatCurrencyParts(summary.total_debt, locale, currency),
    balance: formatCurrencyParts(summary.total_balance, locale, currency),
  }))

  if (!canViewPatient) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
          <StatusBar barStyle="dark-content" />
          <AppHeader
            title={t('tabs.patients')}
            onBack={onBack}
            backLabel={t('common.back')}
          />
          <View style={styles.center}>
            <EmptyState
              iconName="lock-closed-outline"
              title={t('dashboard.noAccess')}
              tone="warning"
            />
          </View>
        </SafeAreaView>
      </View>
    )
  }

  if (isLoading) {
    return (
      <View style={styles.root}>
        <SafeAreaView
          style={styles.flex}
          edges={['top', 'left', 'right']}
          testID="patient-detail-loading"
        >
          <StatusBar barStyle="dark-content" />
          <AppHeader
            title={t('tabs.patients')}
            onBack={onBack}
            backLabel={t('common.back')}
          />
          <View style={[styles.flex, styles.center]}>
            <ActivityIndicator
              color={c.brand as string}
              accessibilityRole="progressbar"
              accessibilityLabel={t('common.loading')}
            />
          </View>
        </SafeAreaView>
      </View>
    )
  }

  if (patientQuery.isError && !patient) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
          <StatusBar barStyle="dark-content" />
          <AppHeader
            title={t('tabs.patients')}
            onBack={onBack}
            backLabel={t('common.back')}
          />
          <View style={styles.center}>
            <EmptyState
              iconName="cloud-offline-outline"
              title={t('patients.loadFailed')}
              tone="danger"
              action={
                <Button
                  title={t('common.retry')}
                  size="md"
                  loading={patientQuery.isFetching}
                  onPress={() => patientQuery.refetch()}
                />
              }
            />
          </View>
        </SafeAreaView>
      </View>
    )
  }

  if (!patient) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
          <StatusBar barStyle="dark-content" />
          <AppHeader
            title={t('tabs.patients')}
            onBack={onBack}
            backLabel={t('common.back')}
          />
          <View style={styles.center}>
            <EmptyState iconName="alert-circle-outline" title={t('patients.notFound')} />
          </View>
        </SafeAreaView>
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
  const primaryTelegramUrl = getTelegramPhoneUrl(patient.phone)
  const secondaryTelegramUrl = getTelegramPhoneUrl(patient.secondary_phone)
  const primaryCallUrl = getPhoneCallUrl(patient.phone)
  const secondaryCallUrl = getPhoneCallUrl(patient.secondary_phone)
  const primaryPhoneLabel = formatStoredPhone(patient.phone)
  const secondaryPhoneLabel = formatStoredPhone(patient.secondary_phone)
  const primaryPhoneActions: CompactContactAction[] = [
    ...(primaryCallUrl
      ? [{
          iconName: 'call-outline' as const,
          label: `${t('patients.actions.call')}: ${primaryPhoneLabel}`,
          onPress: () => onCallPhone(patient.phone!),
        }]
      : []),
    ...(primaryTelegramUrl
      ? [{
          iconName: 'paper-plane-outline' as const,
          label: `${t('patients.actions.telegram')}: ${primaryPhoneLabel}`,
          onPress: () => onTelegram(primaryTelegramUrl),
        }]
      : []),
  ]
  const secondaryPhoneActions: CompactContactAction[] = [
    ...(secondaryCallUrl
      ? [{
          iconName: 'call-outline' as const,
          label: `${t('patients.actions.call')}: ${secondaryPhoneLabel}`,
          onPress: () => onCallPhone(patient.secondary_phone!),
        }]
      : []),
    ...(secondaryTelegramUrl
      ? [{
          iconName: 'paper-plane-outline' as const,
          label: `${t('patients.actions.telegram')}: ${secondaryPhoneLabel}`,
          onPress: () => onTelegram(secondaryTelegramUrl),
        }]
      : []),
  ]

  // Vital chips under the hero — matches the web detail card's "quick vitals"
  // tiles (appointment count / last visit / age). Each chip is only rendered
  // when its data is present, so an empty patient has none.
  // Calendar-correct age via the shared helper (matches web computePatientAge).
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[c.brandSurface, c.background, c.background]}
        locations={[0, 0.2, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" />

        <AppHeader
          title={patient.full_name}
          supportingContent={
            patient.categories?.[0] ? (
              <PatientCategoryBadge
                category={patient.categories[0]}
                additionalCount={Math.max(0, patient.categories.length - 1)}
                style={styles.headerCategoryBadge}
              />
            ) : undefined
          }
          onBack={onBack}
          backLabel={t('common.back')}
          actions={
            canManagePatient ? (
              <OverflowMenuButton
                label={t('patients.actions.more')}
                onPress={onMoreActions}
                loading={
                  archiveMutation.isPending ||
                  restoreMutation.isPending ||
                  forceDeleteMutation.isPending
                }
              />
            ) : undefined
          }
        />

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Compact patient summary. The header owns the name; this card
            groups the approved profile photo, contacts and quick actions. */}
          <View style={styles.hero}>
            <View style={styles.profileMain}>
              <View style={styles.profilePhotoFrame}>
                <PatientAvatar
                  name={patient.full_name}
                  size={76}
                  initialsFontSize={22}
                  uri={getPatientPhotoUris(patient)}
                  style={styles.profilePhoto}
                />
                {canManagePatient && !patient.is_archived ? (
                  <Pressable
                    onPress={onEdit}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.profilePhotoEdit,
                      pressed && styles.profilePhotoEditPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={t('patients.detail.actions.edit')}
                  >
                    <Icon name="camera-outline" size={14} color="#FFFFFF" />
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.profileContacts}>
                {patient.phone ? (
                  <CompactContactRow
                    c={c}
                    iconName="call-outline"
                    label={t('patients.detail.contact.phone')}
                    value={primaryPhoneLabel}
                    trailingActions={primaryPhoneActions}
                  />
                ) : null}
                {patient.secondary_phone ? (
                  <CompactContactRow
                    c={c}
                    iconName="phone-portrait-outline"
                    label={t('patients.detail.contact.phoneSecondary')}
                    value={secondaryPhoneLabel}
                    trailingActions={secondaryPhoneActions}
                  />
                ) : null}
                {patient.address ? (
                  <CompactContactRow
                    c={c}
                    iconName="location-outline"
                    label={t('patients.detail.contact.address')}
                    value={patient.address}
                    multiline
                  />
                ) : null}
                {dobLabel ? (
                  <CompactContactRow
                    c={c}
                    iconName="gift-outline"
                    label={t('patients.detail.contact.dob')}
                    value={dobLabel}
                  />
                ) : null}
                {patient.photo_scan_status === 'pending' ? (
                  <View style={styles.photoPendingRow}>
                    <Icon name="time-outline" size={13} color={c.warning as string} />
                    <Text style={styles.photoPendingHint} numberOfLines={1}>
                      {t('patients.detail.photoPending')}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Quick actions */}
            <View style={styles.actions}>
              <ActionButton
                c={c}
                iconName="calendar-outline"
                label={t('patients.detail.actions.schedule')}
                onPress={onSchedule}
                disabled={!canCreateAppointment || patient.is_archived}
                primary
              />
              <ActionButton
                c={c}
                iconName="create-outline"
                label={t('patients.detail.actions.edit')}
                onPress={onEdit}
                disabled={!canManagePatient || patient.is_archived}
              />
            </View>
          </View>

          <PatientGeneralPhotos
            photos={generalPhotos}
            canManage={canManagePatient}
            manageDisabled={Boolean(patient.is_archived) || generalPhotoUploadMutation.isPending}
            uploadingCount={generalPhotoUploadingCount}
            busyPhotoId={previewLoadingPhotoId ?? generalPhotoDeleteMutation.variables ?? null}
            onAdd={() => openGeneralPhotoPicker()}
            onPressPhoto={onPressGeneralPhoto}
          />

          {/* Medical */}
          <Section c={c} title={t('patients.detail.sections.medical')}>
            <DetailRow
              c={c}
              iconName="warning-outline"
              iconColor={c.danger}
              iconBg="rgba(255, 59, 48, 0.08)"
              label={t('patients.detail.medical.allergies')}
              value={patient.allergies?.trim() || '—'}
              onPress={canManagePatient && !patient.is_archived ? onEdit : undefined}
            />
            <DetailRow
              c={c}
              iconName="medkit-outline"
              iconColor={c.brand}
              iconBg={c.brandSurface}
              label={t('patients.detail.medical.medications')}
              value={patient.current_medications?.trim() || '—'}
              onPress={canManagePatient && !patient.is_archived ? onEdit : undefined}
            />
            <DetailRow
              c={c}
              iconName="document-text-outline"
              iconColor={c.brand}
              iconBg={c.brandSurface}
              label={t('patients.detail.medical.history')}
              value={patient.medical_history?.trim() || '—'}
              onPress={canManagePatient && !patient.is_archived ? onEdit : undefined}
            />
          </Section>

          {overviewQuery.isError && !overview ? (
            <View style={styles.overviewError} accessibilityRole="alert">
              <Icon
                name="cloud-offline-outline"
                size={17}
                color={c.warning as string}
              />
              <Text style={styles.overviewErrorText}>
                {t('patients.detail.overviewLoadFailed')}
              </Text>
              <Pressable
                onPress={() => overviewQuery.refetch()}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.overviewRetry,
                  pressed && styles.overviewRetryPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('common.retry')}
              >
                <Text style={styles.overviewRetryText}>{t('common.retry')}</Text>
              </Pressable>
            </View>
          ) : null}

          {/* Balance */}
          {overview && canViewPayments ? (
            <View style={styles.balanceSectionWrap}>
              <Text style={styles.sectionTitle}>{t('patients.detail.sections.balance')}</Text>
              <View style={styles.balanceRows}>
                <View style={styles.balanceRow}>
                  <CompactFinanceMetric
                    c={c}
                    iconName="receipt-outline"
                    label={t('patients.detail.balance.totalDebt')}
                    amounts={financeCurrencyValues.map(({ currency, debt }) => ({
                      currency,
                      ...debt,
                    }))}
                    tone="work"
                  />
                  <CompactFinanceMetric
                    c={c}
                    iconName="card-outline"
                    label={t('patients.detail.balance.totalPaid')}
                    amounts={financeCurrencyValues.map(({ currency, paid }) => ({
                      currency,
                      ...paid,
                    }))}
                    tone="paid"
                  />
                  <CompactFinanceMetric
                    c={c}
                    iconName="wallet-outline"
                    label={t('patients.detail.balance.balance')}
                    amounts={financeCurrencyValues.map(({ currency, balance }) => ({
                      currency,
                      ...balance,
                    }))}
                    tone="remaining"
                  />
                </View>
              </View>
            </View>
          ) : null}

          {/* Upcoming appointments — the next 3 scheduled visits (from
              backend overview). Mirrors the web detail page's Upcoming card
              so a dentist sees schedule context without leaving the page. */}
          {canViewAppointments &&
          overview?.upcoming_appointments &&
          overview.upcoming_appointments.length > 0 ? (
            <View>
              <Text style={styles.sectionTitle}>{t('patients.detail.sections.upcoming')}</Text>
              <View style={styles.upcomingList}>
                {overview.upcoming_appointments.map((appt, i, arr) => (
                  <React.Fragment key={appt.id}>
                    <View style={styles.upcomingRow}>
                      <View style={styles.upcomingIconBubble}>
                        <Icon name="calendar-outline" size={18} color={c.brand as string} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.upcomingDate} numberOfLines={1}>
                          {formatDayMonth(fromLocalDateKey(appt.appointment_date), locale)}
                        </Text>
                        <Text style={styles.upcomingMeta} numberOfLines={1}>
                          {appt.start_time}–{appt.end_time}
                          {appt.notes ? ` · ${appt.notes}` : ''}
                        </Text>
                      </View>
                    </View>
                    {i < arr.length - 1 ? <View style={styles.rowSep} /> : null}
                  </React.Fragment>
                ))}
              </View>
            </View>
          ) : null}

          {/* Treatment history */}
          <View>
            <View style={styles.historyHeader}>
              <Text style={[styles.sectionTitle, styles.historyTitle]} numberOfLines={1}>
                {t('patients.detail.sections.history')}
              </Text>
              {canManageTreatments && !patient.is_archived ? (
                <CompactIconButton
                  icon="add"
                  label={t('treatment.addEntry')}
                  onPress={() => {
                    setEditState({ mode: 'create' })
                  }}
                />
              ) : null}
            </View>
            {treatmentsQuery.isLoading && !treatmentsQuery.data ? (
              <View
                style={styles.historyList}
                accessibilityRole="progressbar"
                accessibilityLabel={t('common.loading')}
              >
                {Array.from({ length: 3 }).map((_, index) => (
                  <React.Fragment key={index}>
                    <View style={styles.historySkeletonRow}>
                      <View style={styles.historySkeletonBody}>
                        <Skeleton width="58%" height={14} borderRadius={6} />
                        <Skeleton width="38%" height={10} borderRadius={5} />
                        <Skeleton width="100%" height={42} borderRadius={10} />
                      </View>
                      <Skeleton width={44} height={44} borderRadius={10} />
                    </View>
                    {index < 2 ? <View style={styles.historySeparator} /> : null}
                  </React.Fragment>
                ))}
              </View>
            ) : treatmentsQuery.isError && !treatmentsQuery.data ? (
              <EmptyState
                iconName="cloud-offline-outline"
                title={t('patients.loadFailed')}
                tone="danger"
                style={{ paddingVertical: spacing.xl }}
                action={
                  <Button
                    title={t('common.retry')}
                    variant="secondary"
                    size="md"
                    onPress={() => treatmentsQuery.refetch()}
                  />
                }
              />
            ) : treatments.length === 0 ? (
              <EmptyState
                iconName="time-outline"
                title={t('patients.detail.noHistory')}
                subtitle={t('payments.empty.historySub')}
                style={{ paddingVertical: spacing.xl }}
              />
            ) : (
              <View>
                <View style={styles.historyList}>
                  {treatments.map((tr, idx) => (
                    <React.Fragment key={tr.id}>
                      <TreatmentHistoryRow
                        treatment={tr}
                        showFinancials={canViewPayments}
                        onEdit={
                          canManageTreatments && !patient.is_archived
                            ? () => setEditState({ mode: 'edit', treatment: tr })
                            : undefined
                        }
                        onDeleteActions={
                          canManageTreatments && !patient.is_archived
                            ? () => onDeleteTreatment(tr)
                            : undefined
                        }
                        actionsLoading={
                          treatmentDeleteMutation.isPending &&
                          treatmentDeleteMutation.variables === tr.id
                        }
                        actionsDisabled={treatmentDeleteMutation.isPending}
                      />
                      {idx < treatments.length - 1 ? (
                        <View style={styles.historySeparator} />
                      ) : null}
                    </React.Fragment>
                  ))}
                </View>
                {treatmentsQuery.hasNextPage || treatmentsQuery.isFetchNextPageError ? (
                  <View style={styles.historyLoadMoreWrap}>
                    {treatmentsQuery.isFetchNextPageError ? (
                      <Text style={styles.historyLoadMoreError}>
                        {t('patients.detail.historyLoadMoreFailed')}
                      </Text>
                    ) : null}
                    <Button
                      title={
                        treatmentsQuery.isFetchNextPageError
                          ? t('common.retry')
                          : treatmentTotal === null
                            ? t('patients.detail.historyLoadMoreUnknown')
                            : t('patients.detail.historyLoadMore', {
                                loaded: treatments.length,
                                total: treatmentTotal,
                              })
                      }
                      variant="secondary"
                      size="sm"
                      loading={treatmentsQuery.isFetchingNextPage}
                      disabled={!treatmentsQuery.hasNextPage && !treatmentsQuery.isFetchNextPageError}
                      onPress={() => treatmentsQuery.fetchNextPage()}
                      fullWidth
                    />
                  </View>
                ) : null}
              </View>
            )}
          </View>

          {/* Archived patients get a subtle inline restore affordance at the
              foot of the record; archiving lives in the top-bar overflow menu. */}
          {canManagePatient && patient.is_archived ? (
            <Pressable
              onPress={() => restoreMutation.mutate()}
              disabled={restoreMutation.isPending}
              style={styles.restoreRow}
              accessibilityRole="button"
            >
              {restoreMutation.isPending ? (
                <ActivityIndicator size="small" color={c.brand as string} />
              ) : (
                <Icon name="arrow-undo-outline" size={16} color={c.brand as string} />
              )}
              <Text style={styles.restoreText}>{t('patients.detail.actions.unarchive')}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      <TreatmentEditSheet
        visible={editState !== null}
        patientId={route.params.id}
        treatment={editState?.mode === 'edit' ? editState.treatment : null}
        onClose={() => setEditState(null)}
      />

      <ImagePickerSheet
        visible={generalPhotoPickerVisible}
        onClose={() => {
          setGeneralPhotoPickerVisible(false)
        }}
        onPicked={onPickedGeneralPhotos}
        maxSelection={replaceGeneralPhoto ? 1 : Math.max(1, remainingGeneralPhotoSlots)}
      />

      <LightboxViewer
        visible={generalPhotoPreview !== null}
        uris={generalPhotoPreview ? [generalPhotoPreview.uri] : []}
        onClose={() => setGeneralPhotoPreview(null)}
        caption={t('patients.detail.generalPhotos.title')}
        moreLabel={t('patients.actions.more')}
        onMore={
          canManagePatient && !patient.is_archived && generalPhotoPreview
            ? () => onManageGeneralPhoto(generalPhotoPreview.photo)
            : undefined
        }
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
  const items = React.Children.toArray(children)
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>
        {items.map((child, index) => (
          <React.Fragment key={index}>
            {child}
            {index < items.length - 1 ? <View style={styles.detailSeparator} /> : null}
          </React.Fragment>
        ))}
      </View>
    </View>
  )
}

function CompactContactRow({
  c,
  iconName,
  label,
  value,
  multiline,
  trailingActions = [],
}: {
  c: Colors
  iconName: IconName
  label: string
  value: string
  multiline?: boolean
  trailingActions?: readonly CompactContactAction[]
}) {
  const styles = useMemo(() => makeStyles(c), [c])
  const content = (
    <>
      <View style={styles.compactContactIcon}>
        <Icon name={iconName} size={15} color={c.brand as string} />
      </View>
      <Text
        style={styles.compactContactValue}
        numberOfLines={multiline ? 2 : 1}
        adjustsFontSizeToFit={!multiline}
        minimumFontScale={0.84}
      >
        {value}
      </Text>
    </>
  )

  return (
    <View style={styles.compactContactRow}>
      <View
        style={styles.compactContactMain}
        accessible
        accessibilityLabel={`${label}: ${value}`}
      >
        {content}
      </View>
      {trailingActions.length > 0 ? (
        <View style={styles.compactContactActions}>
          {trailingActions.map((action) => (
            <Pressable
              key={action.label}
              onPress={action.onPress}
              hitSlop={8}
              style={({ pressed }) => [
                styles.compactContactTrailingAction,
                pressed && styles.compactContactTrailingActionPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              <Icon
                name={action.iconName}
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
  const content = (
    <>
      <View style={[styles.detailIcon, { backgroundColor: resolvedIconBg }]}>
        <Icon name={iconName} size={16} color={resolvedIconColor} />
      </View>
      <View style={styles.detailText}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue} numberOfLines={2}>{value}</Text>
      </View>
    </>
  )

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.detailRow, pressed && styles.detailRowPressed]}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
      >
        {content}
        <Icon name="chevron-forward" size={18} color={c.labelTertiary as string} />
      </Pressable>
    )
  }
  return (
    <View style={styles.detailRow} accessible accessibilityLabel={`${label}: ${value}`}>
      {content}
    </View>
  )
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
      hitSlop={{ top: 3, bottom: 3 }}
      style={({ pressed }) => [
        styles.actionBtn,
        primary && styles.actionBtnPrimary,
        disabled && styles.actionBtnDisabled,
        pressed && !disabled && styles.actionBtnPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
    >
      <Icon
        name={iconName}
        size={14}
        color={primary ? '#FFFFFF' : (c.labelSecondary as string)}
      />
      <Text
        style={[styles.actionLabel, primary && styles.actionLabelPrimary]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.82}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function CompactFinanceMetric({
  c,
  iconName,
  label,
  amounts,
  tone,
}: {
  c: Colors
  iconName: IconName
  label: string
  amounts: Array<{
    currency: 'UZS' | 'USD'
    value: string
    unit: string
  }>
  tone: 'work' | 'paid' | 'remaining'
}) {
  const styles = useMemo(() => makeStyles(c), [c])
  const palette = tone === 'work'
    ? {
        surface: '#FFF2F1',
        accent: '#C7464D',
      }
    : tone === 'paid'
      ? {
          surface: '#EFFAF3',
          accent: '#16805A',
        }
      : {
          surface: '#FFF7E8',
          accent: '#A65F00',
        }

  return (
    <View
      style={[
        styles.compactFinanceMetric,
        amounts.length > 1 && styles.compactFinanceMetricMulti,
        { backgroundColor: palette.surface },
      ]}
      accessible
      accessibilityLabel={`${label}: ${amounts
        .map(({ value, unit }) => `${value} ${unit}`)
        .join(', ')}`}
    >
      <View style={styles.compactFinanceHeader}>
        <Text
          style={[styles.compactFinanceLabel, { color: palette.accent }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
        >
          {label}
        </Text>
        <Icon name={iconName} size={15} color={palette.accent} />
      </View>
      <View style={styles.compactFinanceValues}>
        {amounts.map(({ currency, value, unit }) => (
          <Text
            key={currency}
            style={[
              styles.compactFinanceValue,
              amounts.length > 1 && styles.compactFinanceValueMulti,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
          >
            {value}<Text style={styles.compactFinanceUnit}> {unit}</Text>
          </Text>
        ))}
      </View>
    </View>
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
    restoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: spacing.sm,
      marginTop: spacing.xs,
    },
    restoreText: {
      ...typography.subhead,
      color: c.brand as string,
      fontFamily: font('600'),
    },
    scroll: {
      paddingBottom: 60,
      gap: spacing.lg,
      width: '100%',
      maxWidth: PATIENT_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
    },
    hero: {
      alignItems: 'stretch',
      marginHorizontal: spacing.lg,
      padding: spacing.lg,
      borderRadius: radius.xxl,
      backgroundColor: c.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.brandSoft,
      shadowColor: '#000',
      shadowOpacity: 0.055,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 5 },
    },
    profileMain: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
    },
    profilePhotoFrame: {
      width: 80,
      height: 80,
      padding: 2,
      borderRadius: radius.xl,
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.brandSurface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.brandSoft,
    },
    profilePhoto: {
      borderRadius: radius.lg,
      backgroundColor: c.fillQuaternary,
    },
    profilePhotoEdit: {
      position: 'absolute',
      right: -3,
      bottom: -3,
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.brand,
      borderWidth: 2,
      borderColor: c.background,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 2 },
    },
    profilePhotoEditPressed: {
      opacity: 0.75,
      transform: [{ scale: 0.94 }],
    },
    profileContacts: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    compactContactRow: {
      minHeight: 24,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    compactContactMain: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    compactContactIcon: {
      width: 20,
      height: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    compactContactValue: {
      flex: 1,
      minWidth: 0,
      fontFamily: font('500'),
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 17,
      color: c.label,
    },
    headerCategoryBadge: {
      minHeight: 20,
      maxWidth: 150,
      paddingVertical: 2,
    },
    compactContactActions: {
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    compactContactTrailingAction: {
      width: 28,
      height: 28,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.brandSurface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.brandSoft,
    },
    compactContactTrailingActionPressed: {
      opacity: 0.68,
      transform: [{ scale: 0.96 }],
    },
    photoPendingRow: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: radius.pill,
      backgroundColor: 'rgba(255, 149, 0, 0.09)',
    },
    photoPendingHint: {
      ...typography.caption1,
      flexShrink: 1,
      color: c.warning as string,
      fontFamily: font('600'),
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 10,
    },
    actionBtn: {
      width: 104,
      maxWidth: '45%',
      height: 38,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      borderRadius: radius.lg,
      backgroundColor: c.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.separator,
    },
    actionBtnPrimary: {
      backgroundColor: c.brand,
      borderColor: c.brand,
    },
    actionBtnDisabled: {
      opacity: 0.4,
    },
    actionBtnPressed: {
      opacity: 0.78,
      transform: [{ scale: 0.94 }],
    },
    actionLabel: {
      flexShrink: 1,
      fontFamily: font('600'),
      fontSize: 11,
      fontWeight: '600',
      color: c.labelSecondary,
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
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.brandSoft,
      shadowColor: '#000',
      shadowOpacity: 0.045,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      overflow: 'hidden',
    },
    detailRow: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    detailRowPressed: {
      backgroundColor: c.brandSurface,
    },
    detailIcon: {
      width: 32,
      height: 32,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailText: { flex: 1, minWidth: 0 },
    detailLabel: {
      fontFamily: font('600'),
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 17,
      color: c.label,
    },
    detailValue: {
      fontFamily: font('400'),
      fontSize: 12,
      lineHeight: 16,
      color: c.labelSecondary,
    },
    detailSeparator: {
      height: StyleSheet.hairlineWidth,
      marginLeft: 12 + 32 + 10,
      backgroundColor: c.separator,
    },
    overviewError: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: spacing.lg,
      paddingHorizontal: 12,
      borderRadius: radius.lg,
      backgroundColor: 'rgba(255, 149, 0, 0.08)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.warning,
    },
    overviewErrorText: {
      ...typography.footnote,
      flex: 1,
      color: c.labelSecondary,
      fontFamily: font('500'),
    },
    overviewRetry: {
      minHeight: 32,
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    overviewRetryPressed: {
      opacity: 0.65,
    },
    overviewRetryText: {
      ...typography.footnote,
      color: c.warning,
      fontFamily: font('700'),
    },
    balanceSectionWrap: {
      gap: 0,
    },
    balanceRows: {
      gap: 7,
    },
    balanceRow: {
      flexDirection: 'row',
      gap: 7,
      paddingHorizontal: 16,
    },
    compactFinanceMetric: {
      flex: 1,
      minWidth: 0,
      height: 50,
      justifyContent: 'space-between',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.lg,
    },
    compactFinanceMetricMulti: {
      height: 64,
      justifyContent: 'center',
      gap: 4,
    },
    compactFinanceHeader: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 3,
    },
    compactFinanceLabel: {
      flex: 1,
      minWidth: 0,
      fontFamily: font('600'),
      fontSize: 9,
      fontWeight: '600',
      lineHeight: 11,
    },
    compactFinanceValue: {
      fontFamily: font('700'),
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 16,
      color: c.label,
      letterSpacing: -0.25,
    },
    compactFinanceValues: {
      gap: 3,
    },
    compactFinanceValueMulti: {
      fontSize: 11.5,
      lineHeight: 13,
    },
    compactFinanceUnit: {
      fontFamily: font('500'),
      fontSize: 8.5,
      fontWeight: '500',
      color: c.labelSecondary,
      letterSpacing: 0,
    },
    historyList: {
      backgroundColor: c.background,
      borderRadius: radius.xl,
      marginHorizontal: 16,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.separator,
      shadowColor: '#000',
      shadowOpacity: 0.045,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 1,
    },
    historyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingRight: 16,
      marginBottom: 8,
    },
    historyTitle: {
      flex: 1,
      minWidth: 0,
      marginBottom: 0,
      paddingRight: 8,
    },
    upcomingList: {
      backgroundColor: c.background,
      borderRadius: radius.xl,
      marginHorizontal: 16,
      paddingVertical: 4,
    },
    upcomingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: 10,
      paddingHorizontal: spacing.lg,
    },
    upcomingIconBubble: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.brandLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    upcomingDate: {
      ...typography.bodyEmphasized,
      color: c.label,
    },
    upcomingMeta: {
      ...typography.footnote,
      color: c.labelSecondary,
      marginTop: 2,
    },
    historySeparator: {
      height: StyleSheet.hairlineWidth,
      marginLeft: 14,
      backgroundColor: c.separator,
    },
    historySkeletonRow: {
      minHeight: 110,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    historySkeletonBody: {
      flex: 1,
      gap: 8,
    },
    historyLoadMoreWrap: {
      gap: 7,
      paddingHorizontal: 16,
      paddingTop: 10,
    },
    historyLoadMoreError: {
      ...typography.caption1,
      color: c.danger,
      textAlign: 'center',
    },
    rowSep: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.separator as string,
      marginLeft: 20 + 38 + 12,
    },
  })
}
