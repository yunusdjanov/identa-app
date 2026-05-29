import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'

import BottomSheet from '../ui/BottomSheet'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import InputCard from '../ui/InputCard'
import MonthCalendarPicker from '../ui/MonthCalendarPicker'
import { useToast } from '../ui/Toast'

import { Odontogram } from '../odontogram'
import {
  PhotoGallery,
  ImagePickerSheet,
  LightboxViewer,
  type GalleryPhoto,
  type PickedAsset,
} from '../gallery'

import { useI18n } from '../../i18n'
import { isOfflineError } from '../../lib/offlineGuard'
import { isApiError } from '../../api/client'
import {
  createPatientTreatment,
  updatePatientTreatment,
  deletePatientTreatment,
  uploadTreatmentImage,
  deleteTreatmentImage,
  getPatientTreatment,
  resolveTreatmentImageUrl,
  type TreatmentPayload,
} from '../../api/treatments'
import { formatDayMonth, fromLocalDateKey, toLocalDateKey } from '../../lib/format'
import { radius, spacing, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import type { ApiTreatment } from '../../types'

// Maximum images per treatment — matches the web app's per-entry cap. The
// backend's per-subscription image limit is enforced server-side; this is
// just a UX guard so we don't queue uploads the server would reject.
const MAX_PHOTOS = 10

interface LocalPhoto {
  localId: string
  uri: string
  asset: PickedAsset
  error?: boolean
}

interface Props {
  visible: boolean
  onClose: () => void
  patientId: string
  // Pass an existing treatment to enter edit mode; omit/null = create mode.
  treatment?: ApiTreatment | null
  onSaved?: (saved: ApiTreatment) => void
  // Fires after a successful delete in edit mode (sheet auto-closes either
  // way). The caller can use this to invalidate any per-treatment caches
  // beyond the standard `['treatments']` / `['patients', ...]` keys.
  onDeleted?: (treatmentId: string) => void
}

export default function TreatmentEditSheet({
  visible,
  onClose,
  patientId,
  treatment,
  onSaved,
  onDeleted,
}: Props) {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const toast = useToast()
  const queryClient = useQueryClient()

  const isEdit = Boolean(treatment)

  // Core fields
  const [treatmentType, setTreatmentType] = useState('')
  const [treatmentDate, setTreatmentDate] = useState<string>(() => toLocalDateKey(new Date()))
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [teeth, setTeeth] = useState<number[]>([])
  const [comment, setComment] = useState('')
  const [debtAmount, setDebtAmount] = useState('')
  const [paidAmount, setPaidAmount] = useState('')

  // Photo state. We keep three separate buckets:
  //   - existingPhotos: already on the backend (only populated in edit mode)
  //   - localPhotos:    newly picked, queued for upload after save
  //   - removedImageIds: existing photos the user tapped X on; we send a
  //                     DELETE for each after the treatment save succeeds
  const [existingPhotos, setExistingPhotos] = useState<ApiTreatment['images']>([])
  const [localPhotos, setLocalPhotos] = useState<LocalPhoto[]>([])
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([])

  const [pickerOpen, setPickerOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  // Per-field validation errors. Reset on every field change so the user
  // doesn't see a stale red border after typing a fix.
  const [errors, setErrors] = useState<{
    treatmentType?: string
    treatmentDate?: string
    debtAmount?: string
    paidAmount?: string
    comment?: string
  }>({})

  // Reset all state when the sheet closes. Without this, a stale form
  // briefly flashes when the user reopens the sheet for a different
  // treatment (state survives across mounts since the Modal stays around).
  useEffect(() => {
    if (visible) return
    setTreatmentType('')
    setTreatmentDate(toLocalDateKey(new Date()))
    setTeeth([])
    setComment('')
    setDebtAmount('')
    setPaidAmount('')
    setExistingPhotos([])
    setLocalPhotos([])
    setRemovedImageIds([])
    setErrors({})
    setLightboxIndex(null)
  }, [visible])

  // Hydrate from existing treatment when entering edit mode. Runs whenever
  // a different treatment is passed in (e.g. user closed sheet for one
  // entry then opened it for another) without needing a full unmount cycle.
  useEffect(() => {
    if (!visible || !treatment) return
    setTreatmentType(treatment.treatment_type ?? '')
    setTreatmentDate(treatment.treatment_date ?? toLocalDateKey(new Date()))
    setTeeth(treatment.teeth ?? [])
    setComment(treatment.description ?? '')
    setDebtAmount(formatMoneyInput(treatment.debt_amount))
    setPaidAmount(formatMoneyInput(treatment.paid_amount))
    setExistingPhotos(treatment.images ?? [])
    setLocalPhotos([])
    setRemovedImageIds([])
    setErrors({})
  }, [visible, treatment])

  const toggleTooth = (n: number) => {
    setTeeth((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].sort((a, b) => a - b)))
  }

  // Save flow: persist the treatment first, then apply image diffs (delete
  // removed, upload new). Image failures don't fail the whole save — the
  // entry is still useful without photos — but we toast about partial
  // failures so the user knows to retry.
  const saveMutation = useMutation({
    mutationFn: async (): Promise<{ treatment: ApiTreatment; failedUploads: number }> => {
      const trimmedComment = comment.trim() || null
      const payload: TreatmentPayload = {
        treatment_type: treatmentType.trim(),
        treatment_date: treatmentDate,
        teeth,
        // Backend accepts both `description` and `comment` (the web app
        // sends both for the same UI input). If a future backend version
        // tightens its allow-list, drop `description` and keep `comment`.
        comment: trimmedComment,
        description: trimmedComment,
        debt_amount: parseMoney(debtAmount) ?? 0,
        paid_amount: parseMoney(paidAmount) ?? 0,
      }

      const saved = treatment
        ? await updatePatientTreatment(patientId, treatment.id, payload)
        : await createPatientTreatment(patientId, payload)

      // Diff: drop removed images first (parallel; ignore individual failures
      // so a stale image id doesn't block the whole save). Settled-style so
      // we can count failures for the toast.
      if (removedImageIds.length > 0) {
        await Promise.allSettled(
          removedImageIds.map((id) =>
            deleteTreatmentImage(patientId, saved.id, id)
          )
        )
      }

      // Then upload any newly picked photos in parallel. `existingPhotos`
      // already excludes anything the user removed (handleRemovePhoto
      // filters it on the spot), so the remaining room is simply
      // MAX_PHOTOS minus what's still attached.
      let failedUploads = 0
      if (localPhotos.length > 0) {
        const room = Math.max(0, MAX_PHOTOS - existingPhotos.length)
        const results = await Promise.allSettled(
          localPhotos
            .slice(0, room)
            .map((p) =>
              uploadTreatmentImage(patientId, saved.id, {
                uri: p.asset.uri,
                mimeType: p.asset.mimeType ?? null,
                fileName: p.asset.fileName ?? null,
                fileSize: p.asset.fileSize ?? null,
              })
            )
        )
        failedUploads = results.filter((r) => r.status === 'rejected').length
      }

      // Re-fetch so we get the canonical image list (with thumbnail/preview
      // URLs once the backend has generated variants). If the re-fetch
      // fails we still return the original saved object so the caller's
      // success path runs — the consumer's invalidate triggers a refetch
      // on the next render anyway.
      const final = await getPatientTreatment(patientId, saved.id).catch(() => saved)
      return { treatment: final, failedUploads }
    },
    onSuccess: ({ treatment: saved, failedUploads }) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      if (failedUploads > 0) {
        toast.warning(t('gallery.uploadFailedTryAgain'))
      } else {
        toast.success(isEdit ? t('treatment.savedEdit') : t('treatment.savedCreate'))
      }
      queryClient.invalidateQueries({ queryKey: ['treatments'] })
      queryClient.invalidateQueries({ queryKey: ['patients', patientId] })
      queryClient.invalidateQueries({ queryKey: ['patients', 'overview', patientId] })
      queryClient.invalidateQueries({ queryKey: ['odontogram', 'summary', patientId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      onSaved?.(saved)
      onClose()
    },
    onError: (err) => {
      if (isOfflineError(err)) return
      // 422 field errors → pin them under the matching input. Anything else
      // falls back to a generic toast so the user knows something went wrong.
      if (isApiError(err) && err.kind === 'validation' && err.fieldErrors) {
        const fe = err.fieldErrors
        setErrors({
          treatmentType: fe.treatment_type?.[0],
          treatmentDate: fe.treatment_date?.[0],
          debtAmount: fe.debt_amount?.[0],
          paidAmount: fe.paid_amount?.[0],
          // `comment` and `description` map to the same input — surface
          // either field's first error to the (single) Comment row.
          comment: fe.comment?.[0] ?? fe.description?.[0],
          // Teeth errors are rare but possible (e.g. backend rejects a
          // tooth number out of 1-32). Surface as a toast since the
          // odontogram doesn't have an error-row slot.
        })
        if (fe.teeth?.[0]) toast.error(fe.teeth[0])
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        return
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      toast.error(t('treatment.saveFailed'))
    },
  })

  // Treatment deletion (edit mode only). The backend cascades: it removes
  // the treatment row, every image attached to it, and reverses any
  // invoice/payment side-effects. We invalidate the same query keys the
  // save flow does so list views / dashboards refresh together.
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!treatment) throw new Error('No treatment to delete')
      await deletePatientTreatment(patientId, treatment.id)
      return treatment.id
    },
    onSuccess: (deletedId) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      toast.success(t('treatment.deleted'))
      queryClient.invalidateQueries({ queryKey: ['treatments'] })
      queryClient.invalidateQueries({ queryKey: ['patients', patientId] })
      queryClient.invalidateQueries({ queryKey: ['patients', 'overview', patientId] })
      queryClient.invalidateQueries({ queryKey: ['odontogram', 'summary', patientId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      onDeleted?.(deletedId)
      onClose()
    },
    onError: (err) => {
      if (isOfflineError(err)) return
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      toast.error(t('treatment.deleteFailed'))
    },
  })

  const handleDelete = () => {
    if (!treatment) return
    // Native confirmation prompt — destructive action style highlights the
    // delete button in red on iOS and stacks naturally on Android.
    Alert.alert(
      t('treatment.deleteConfirmTitle'),
      t('treatment.deleteConfirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => deleteMutation.mutate(),
        },
      ]
    )
  }

  const handleSave = () => {
    const trimmed = treatmentType.trim()
    const next: typeof errors = {}
    if (trimmed.length < 2) {
      next.treatmentType = t('treatment.errors.typeTooShort')
    }
    if (!treatmentDate) {
      next.treatmentDate = t('treatment.errors.dateRequired')
    }
    const debt = parseMoney(debtAmount)
    const paid = parseMoney(paidAmount)
    if (debt !== null && debt < 0) {
      next.debtAmount = t('treatment.errors.amountNegative')
    }
    if (paid !== null && paid < 0) {
      next.paidAmount = t('treatment.errors.amountNegative')
    }
    // Paid is intentionally allowed to exceed debt: a paid-only entry
    // (debt 0, paid > 0) or an overpayment records patient credit / an
    // advance, leaving a negative balance. Matches the web treatment form,
    // which has no paid>debt guard.
    if (Object.keys(next).length > 0) {
      setErrors(next)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      return
    }
    setErrors({})
    saveMutation.mutate()
  }

  const onPickedAssets = (assets: PickedAsset[]) => {
    const used = existingPhotos.length + localPhotos.length
    const room = Math.max(0, MAX_PHOTOS - used)
    if (assets.length > room) {
      toast.warning(t('gallery.maxReached', { count: MAX_PHOTOS }))
    }
    const incoming: LocalPhoto[] = assets.slice(0, room).map((a, i) => ({
      localId: `local-${Date.now()}-${i}`,
      uri: a.uri,
      asset: a,
    }))
    if (incoming.length > 0) {
      setLocalPhotos((prev) => [...prev, ...incoming])
    }
  }

  const handleRemovePhoto = (photo: GalleryPhoto) => {
    if (photo.kind === 'remote') {
      setRemovedImageIds((prev) => [...prev, photo.id])
      setExistingPhotos((prev) => prev.filter((p) => p.id !== photo.id))
    } else {
      setLocalPhotos((prev) => prev.filter((p) => p.localId !== photo.localId))
    }
  }

  // Merged gallery view — existing photos first, then newly picked. Order
  // matches the lightbox URI list below so an index lookup works directly.
  const galleryPhotos: GalleryPhoto[] = useMemo(() => {
    const remote: GalleryPhoto[] = []
    for (const img of existingPhotos) {
      const full =
        resolveTreatmentImageUrl(img, 'preview') ??
        resolveTreatmentImageUrl(img, 'full')
      if (!full) continue
      remote.push({
        kind: 'remote',
        id: img.id,
        url: full,
        thumbnailUrl: resolveTreatmentImageUrl(img, 'thumbnail'),
      })
    }
    const local: GalleryPhoto[] = localPhotos.map((p) => ({
      kind: 'local',
      localId: p.localId,
      uri: p.uri,
      uploading: saveMutation.isPending,
      error: p.error,
    }))
    return [...remote, ...local]
  }, [existingPhotos, localPhotos, saveMutation.isPending])

  const lightboxUris = useMemo(
    () =>
      galleryPhotos.map((p) =>
        p.kind === 'remote' ? p.url : p.uri
      ),
    [galleryPhotos]
  )

  const dateDisplay = useMemo(() => {
    try {
      return formatDayMonth(fromLocalDateKey(treatmentDate), locale)
    } catch {
      return treatmentDate
    }
  }, [treatmentDate, locale])

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={onClose}
        title={isEdit ? t('treatment.editTitle') : t('treatment.createTitle')}
      >
        <View style={styles.section}>
          <Text style={styles.label}>{t('treatment.typeLabel')}</Text>
          <InputCard
            iconName="medkit-outline"
            value={treatmentType}
            onChangeText={(v) => {
              setTreatmentType(v)
              if (errors.treatmentType) setErrors((e) => ({ ...e, treatmentType: undefined }))
            }}
            placeholder={t('treatment.typePlaceholder')}
            error={!!errors.treatmentType}
            autoCapitalize="sentences"
          />
          {errors.treatmentType ? (
            <Text style={styles.errText}>{errors.treatmentType}</Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>{t('treatment.dateLabel')}</Text>
          <Pressable
            style={[styles.dateRow, errors.treatmentDate && styles.dateRowError]}
            onPress={() => setCalendarOpen(true)}
          >
            <Icon name="calendar-outline" size={20} color={c.brand as string} />
            <Text style={styles.dateText}>{dateDisplay}</Text>
            <Icon name="chevron-forward" size={18} color={c.labelTertiary as string} />
          </Pressable>
          {errors.treatmentDate ? (
            <Text style={styles.errText}>{errors.treatmentDate}</Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Odontogram
            mode="picker"
            selectedTeeth={teeth}
            onToggleTooth={toggleTooth}
          />
        </View>

        <View style={styles.amountRow}>
          <View style={styles.amountCol}>
            <Text style={styles.label}>{t('treatment.debtLabel')}</Text>
            <InputCard
              iconName="cash-outline"
              value={debtAmount}
              onChangeText={(v) => {
                setDebtAmount(cleanMoneyInput(v))
                if (errors.debtAmount) setErrors((e) => ({ ...e, debtAmount: undefined }))
              }}
              placeholder="0"
              keyboardType="numeric"
              error={!!errors.debtAmount}
              maxLength={12}
            />
            {errors.debtAmount ? (
              <Text style={styles.errText}>{errors.debtAmount}</Text>
            ) : null}
          </View>
          <View style={styles.amountCol}>
            <Text style={styles.label}>{t('treatment.paidLabel')}</Text>
            <InputCard
              iconName="checkmark-circle-outline"
              value={paidAmount}
              onChangeText={(v) => {
                setPaidAmount(cleanMoneyInput(v))
                if (errors.paidAmount) setErrors((e) => ({ ...e, paidAmount: undefined }))
              }}
              placeholder="0"
              keyboardType="numeric"
              error={!!errors.paidAmount}
              maxLength={12}
            />
            {errors.paidAmount ? (
              <Text style={styles.errText}>{errors.paidAmount}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>{t('treatment.commentLabel')}</Text>
          <InputCard
            iconName="document-text-outline"
            value={comment}
            onChangeText={(v) => {
              setComment(v)
              if (errors.comment) setErrors((e) => ({ ...e, comment: undefined }))
            }}
            placeholder={t('treatment.commentPlaceholder')}
            multiline
            numberOfLines={3}
            maxLength={500}
            error={!!errors.comment}
            style={{ minHeight: 60, textAlignVertical: 'top', paddingTop: 14 }}
          />
          {errors.comment ? (
            <Text style={styles.errText}>{errors.comment}</Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <PhotoGallery
            photos={galleryPhotos}
            onPressAdd={() => setPickerOpen(true)}
            onRemovePhoto={handleRemovePhoto}
            onPressPhoto={(idx) => setLightboxIndex(idx)}
            maxPhotos={MAX_PHOTOS}
          />
        </View>

        <Button
          title={isEdit ? t('common.save') : t('treatment.create')}
          onPress={handleSave}
          loading={saveMutation.isPending}
          disabled={saveMutation.isPending || deleteMutation.isPending}
          fullWidth
        />

        {/* Edit-mode only: destructive delete row below the save button.
            Putting it after Save (not in the header) keeps the primary
            action visually dominant and avoids accidental taps when the
            user is reaching for the close (X) button. */}
        {isEdit ? (
          <Button
            title={t('common.delete')}
            variant="destructive"
            onPress={handleDelete}
            loading={deleteMutation.isPending}
            disabled={saveMutation.isPending || deleteMutation.isPending}
            fullWidth
          />
        ) : null}
      </BottomSheet>

      <ImagePickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPicked={onPickedAssets}
        maxSelection={Math.max(1, MAX_PHOTOS - galleryPhotos.length)}
      />

      <MonthCalendarPicker
        visible={calendarOpen}
        value={treatmentDate}
        // Treatment can be back-dated (dentist enters yesterday's procedure
        // notes), so we drop the default minDate. Cap forward at +30 days —
        // scheduling far-future treatments is what appointments are for.
        minDate={null}
        maxDate={(() => {
          const d = new Date()
          d.setDate(d.getDate() + 30)
          return d
        })()}
        title={t('treatment.dateLabel')}
        onClose={() => setCalendarOpen(false)}
        onConfirm={(k) => {
          setTreatmentDate(k)
          if (errors.treatmentDate) setErrors((e) => ({ ...e, treatmentDate: undefined }))
          setCalendarOpen(false)
        }}
      />

      <LightboxViewer
        visible={lightboxIndex !== null}
        uris={lightboxUris}
        startIndex={lightboxIndex ?? 0}
        onClose={() => setLightboxIndex(null)}
      />
    </>
  )
}

// Form helpers — kept module-local because they're tied to this form's
// validation rules. Number parsing accepts spaces and commas so users can
// type "1 000 000" or "1,000,000" without it failing.
function parseMoney(text: string): number | null {
  const cleaned = text.replace(/[\s,]/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function cleanMoneyInput(text: string): string {
  // Only digits + a single decimal separator; backend stores money as
  // integer minor units so decimals here are advisory only (web form
  // strips them too).
  return text.replace(/[^\d]/g, '')
}

function formatMoneyInput(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return ''
  if (n === 0) return ''
  return String(Math.round(n))
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    section: {
      gap: spacing.xs,
    },
    label: {
      ...typography.subheadBold,
      fontFamily: font('600'),
      color: c.labelSecondary as string,
      paddingHorizontal: 4,
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 56,
      backgroundColor: c.background,
      borderRadius: radius.xl,
      borderWidth: 1.2,
      borderColor: c.separator,
      paddingHorizontal: 16,
    },
    dateRowError: {
      borderColor: c.danger as string,
    },
    dateText: {
      flex: 1,
      ...typography.body,
      color: c.label,
    },
    amountRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    amountCol: {
      flex: 1,
      gap: spacing.xs,
    },
    errText: {
      ...typography.caption1,
      color: c.danger as string,
      paddingHorizontal: 4,
    },
  })
}
