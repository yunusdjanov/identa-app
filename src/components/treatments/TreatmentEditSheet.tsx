import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'

import BottomSheet from '../ui/BottomSheet'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import InputCard from '../ui/InputCard'
import MonthCalendarPicker from '../ui/MonthCalendarPicker'
import SegmentedControl from '../ui/SegmentedControl'
import { useToast } from '../ui/Toast'
import { useDialog } from '../ui/Dialog'
import { useAuthStore } from '../../stores/auth'

import {
  PhotoGallery,
  ImagePickerSheet,
  LightboxViewer,
  type GalleryPhoto,
  type PickedAsset,
} from '../gallery'

import { useI18n } from '../../i18n'
import { isOfflineError } from '../../lib/offlineGuard'
import { canView } from '../../lib/permissions'
import { normalizeDecimalInput, parseDecimalInput } from '../../lib/paymentInput'
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
import {
  inputMetrics,
  radius,
  spacing,
  typography,
  font,
} from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import type { ApiTreatment } from '../../types'

// Fallback maximum images per treatment when the subscription doesn't
// advertise an `entry_image_limit`. The real cap comes from the user's
// subscription (web reads the same field) so free-tier users see the right
// quota instead of queueing uploads the backend would later reject.
const FALLBACK_PHOTOS = 10
const MAX_TREATMENT_PHOTO_BYTES = 5 * 1024 * 1024
const MAX_TREATMENT_PHOTO_MB = 5
const TREATMENT_CURRENCIES = ['UZS', 'USD'] as const
const TREATMENT_SUGGESTION_KEYS = [
  'treatment.suggestions.restoration',
  'treatment.suggestions.endodontics',
  'treatment.suggestions.extraction',
  'treatment.suggestions.implantation',
  'treatment.suggestions.whitening',
  'treatment.suggestions.prosthodontics',
  'treatment.suggestions.cleaning',
] as const

type TreatmentCurrency = (typeof TREATMENT_CURRENCIES)[number]

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
  const { confirm } = useDialog()
  const queryClient = useQueryClient()
  // Subscription-driven photo cap so free-tier dentists see (e.g.) 3 instead
  // of the absolute fallback of 10 — prevents queueing uploads the backend
  // would later 422. Mirrors the web treatment-history-card.
  const user = useAuthStore((s) => s.user)
  const maxPhotos = user?.subscription?.entry_image_limit ?? FALLBACK_PHOTOS
  const canViewFinancials = canView(user, 'payments')

  const isEdit = Boolean(treatment)

  // Core fields
  const [treatmentType, setTreatmentType] = useState('')
  const [treatmentDate, setTreatmentDate] = useState<string>(() => toLocalDateKey(new Date()))
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [teeth, setTeeth] = useState<number[]>([])
  const [comment, setComment] = useState('')
  const [debtAmount, setDebtAmount] = useState('')
  const [paidAmount, setPaidAmount] = useState('')
  const [currency, setCurrency] = useState<TreatmentCurrency>('UZS')

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
    setCurrency('UZS')
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
    const nextCurrency = treatment.currency === 'USD' ? 'USD' : 'UZS'
    setCurrency(nextCurrency)
    setDebtAmount(formatMoneyInput(treatment.debt_amount, nextCurrency))
    setPaidAmount(formatMoneyInput(treatment.paid_amount, nextCurrency))
    setExistingPhotos(treatment.images ?? [])
    setLocalPhotos([])
    setRemovedImageIds([])
    setErrors({})
  }, [visible, treatment])

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
        // The odontogram/tooth picker is intentionally absent from mobile.
        // Preserve existing links during edit so hiding that UI never erases
        // clinical data; new web-parity entries start with an empty array.
        teeth,
        // Backend accepts both `description` and `comment` (the web app
        // sends both for the same UI input). If a future backend version
        // tightens its allow-list, drop `description` and keep `comment`.
        comment: trimmedComment,
        description: trimmedComment,
        ...(canViewFinancials
          ? {
              debt_amount: parseMoney(debtAmount, currency),
              paid_amount: parseMoney(paidAmount, currency),
              currency,
            }
          : {}),
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
      // maxPhotos minus what's still attached.
      let failedUploads = 0
      if (localPhotos.length > 0) {
        const room = Math.max(0, maxPhotos - existingPhotos.length)
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
          // The tooth picker doesn't have an error-row slot.
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

  const handleDelete = async () => {
    if (!treatment) return
    const ok = await confirm({
      title: t('treatment.deleteConfirmTitle'),
      message: t('treatment.deleteConfirmBody'),
      confirmLabel: t('common.delete'),
      destructive: true,
    })
    if (ok) deleteMutation.mutate()
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
    if (canViewFinancials) {
      const debt = parseMoney(debtAmount, currency)
      const paid = parseMoney(paidAmount, currency)
      if (debt < 0) {
        next.debtAmount = t('treatment.errors.amountNegative')
      }
      if (paid < 0) {
        next.paidAmount = t('treatment.errors.amountNegative')
      }
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
    const validAssets = assets.filter((asset) => {
      return asset.fileSize == null || asset.fileSize <= MAX_TREATMENT_PHOTO_BYTES
    })
    if (validAssets.length < assets.length) {
      toast.warning(
        t('treatment.errors.imageTooLarge', { sizeMb: MAX_TREATMENT_PHOTO_MB })
      )
    }
    const used = existingPhotos.length + localPhotos.length
    const room = Math.max(0, maxPhotos - used)
    if (validAssets.length > room) {
      toast.warning(t('gallery.maxReached', { count: maxPhotos }))
    }
    const incoming: LocalPhoto[] = validAssets.slice(0, room).map((a, i) => ({
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
        closeAccessibilityLabel={t('common.close')}
      >
        <View style={styles.dateSection}>
          <Pressable
            style={({ pressed }) => [
              styles.dateRow,
              errors.treatmentDate && styles.dateRowError,
              pressed && styles.controlPressed,
            ]}
            onPress={() => setCalendarOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`${t('treatment.dateLabel')}: ${dateDisplay}`}
            testID="treatment-date-control"
          >
            <View style={styles.dateIconWrap}>
              <Icon name="calendar-outline" size={16} color={c.brand as string} />
            </View>
            <Text style={styles.dateInlineLabel}>{t('treatment.dateLabel')}</Text>
            <Text style={styles.dateText}>{dateDisplay}</Text>
            <Icon name="chevron-forward" size={15} color={c.labelTertiary as string} />
          </Pressable>
          {errors.treatmentDate ? (
            <Text style={styles.errText}>{errors.treatmentDate}</Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>{t('treatment.typeLabel')}</Text>
          <InputCard
            value={treatmentType}
            onChangeText={(v) => {
              setTreatmentType(v)
              if (errors.treatmentType) setErrors((e) => ({ ...e, treatmentType: undefined }))
            }}
            placeholder={t('treatment.typePlaceholder')}
            error={!!errors.treatmentType}
            autoCapitalize="sentences"
            containerStyle={styles.primaryInputCard}
            style={styles.primaryInput}
          />
          <View style={styles.suggestionRow} accessibilityLabel={t('treatment.suggestionsLabel')}>
            {TREATMENT_SUGGESTION_KEYS.map((key) => {
              const suggestion = t(key)
              const selected = treatmentType.trim() === suggestion
              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    Haptics.selectionAsync()
                    setTreatmentType(suggestion)
                    if (errors.treatmentType) {
                      setErrors((current) => ({ ...current, treatmentType: undefined }))
                    }
                  }}
                  style={({ pressed }) => [
                    styles.suggestionChip,
                    selected && styles.suggestionChipSelected,
                    pressed && styles.controlPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text
                    style={[
                      styles.suggestionText,
                      selected && styles.suggestionTextSelected,
                    ]}
                  >
                    {suggestion}
                  </Text>
                </Pressable>
              )
            })}
          </View>
          {errors.treatmentType ? (
            <Text style={styles.errText}>{errors.treatmentType}</Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.label}>{t('treatment.imagesLabel')}</Text>
            <Text style={styles.sectionCounter}>{galleryPhotos.length}/{maxPhotos}</Text>
          </View>
          <PhotoGallery
            photos={galleryPhotos}
            onPressAdd={() => setPickerOpen(true)}
            onRemovePhoto={handleRemovePhoto}
            onPressPhoto={(idx) => setLightboxIndex(idx)}
            maxPhotos={maxPhotos}
            size="form"
            bare
          />
          <Text style={styles.supportingText}>
            {t('treatment.imagesHint', {
              max: maxPhotos,
              sizeMb: MAX_TREATMENT_PHOTO_MB,
            })}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>{t('treatment.commentLabel')}</Text>
          <InputCard
            value={comment}
            onChangeText={(v) => {
              setComment(v)
              if (errors.comment) setErrors((e) => ({ ...e, comment: undefined }))
            }}
            placeholder={t('treatment.commentPlaceholder')}
            multiline
            numberOfLines={2}
            // Backend StoreTreatmentRequest allows up to 5000 chars on
            // comment/description — mirror the full limit so a long note
            // isn't truncated locally.
            maxLength={5000}
            error={!!errors.comment}
            containerStyle={styles.commentCard}
            style={styles.commentInput}
          />
          {errors.comment ? (
            <Text style={styles.errText}>{errors.comment}</Text>
          ) : null}
        </View>

        {canViewFinancials ? (
          <View style={styles.financeSection}>
            <View style={styles.financeHeader}>
              <Text style={styles.label}>{t('treatment.financeLabel')}</Text>
              <View style={styles.currencyControl}>
                <SegmentedControl<TreatmentCurrency>
                  options={TREATMENT_CURRENCIES.map((value) => ({ value, label: value }))}
                  value={currency}
                  onChange={(nextCurrency) => {
                    setDebtAmount((current) =>
                      reformatMoneyForCurrency(current, currency, nextCurrency)
                    )
                    setPaidAmount((current) =>
                      reformatMoneyForCurrency(current, currency, nextCurrency)
                    )
                    setCurrency(nextCurrency)
                  }}
                />
              </View>
            </View>
            <View style={styles.amountRow}>
              <CompactMoneyInput
                c={c}
                label={t('treatment.debtLabel')}
                value={debtAmount}
                currency={currency}
                tone="work"
                error={Boolean(errors.debtAmount)}
                onChangeText={(value) => {
                  setDebtAmount(formatMoneyInput(value, currency))
                  if (errors.debtAmount) {
                    setErrors((current) => ({ ...current, debtAmount: undefined }))
                  }
                }}
              />
              <CompactMoneyInput
                c={c}
                label={t('treatment.paidLabel')}
                value={paidAmount}
                currency={currency}
                tone="paid"
                error={Boolean(errors.paidAmount)}
                onChangeText={(value) => {
                  setPaidAmount(formatMoneyInput(value, currency))
                  if (errors.paidAmount) {
                    setErrors((current) => ({ ...current, paidAmount: undefined }))
                  }
                }}
              />
            </View>
            {errors.debtAmount || errors.paidAmount ? (
              <Text style={styles.errText}>
                {errors.debtAmount ?? errors.paidAmount}
              </Text>
            ) : null}
          </View>
        ) : null}

        <Button
          title={isEdit ? t('common.save') : t('treatment.create')}
          onPress={handleSave}
          loading={saveMutation.isPending}
          disabled={saveMutation.isPending || deleteMutation.isPending}
          fullWidth
          size="md"
          leftIcon={
            <Icon
              name={isEdit ? 'checkmark' : 'add'}
              size={18}
              color="#FFFFFF"
            />
          }
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
        maxSelection={Math.max(1, maxPhotos - galleryPhotos.length)}
      />

      <MonthCalendarPicker
        visible={calendarOpen}
        value={treatmentDate}
        // Treatment can be back-dated (dentist enters yesterday's procedure
        // notes), so we drop the default minDate. Cap forward at today —
        // backend StoreTreatmentRequest enforces `before_or_equal:today`;
        // future dates would 422. Scheduling far-future visits is what
        // appointments are for.
        minDate={null}
        maxDate={new Date()}
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
function parseMoney(text: string, currency: TreatmentCurrency): number {
  const amount = parseDecimalInput(text)
  return currency === 'UZS' ? Math.round(amount) : amount
}

function formatMoneyInput(
  value: string | number | null | undefined,
  currency: TreatmentCurrency
): string {
  if (value == null || value === '') return ''
  if (typeof value === 'string') {
    return normalizeDecimalInput(value, currency === 'USD' ? 2 : 0)
  }
  if (!Number.isFinite(value) || value === 0) return ''
  return normalizeDecimalInput(
    currency === 'UZS' ? String(Math.round(value)) : String(value),
    currency === 'USD' ? 2 : 0
  )
}

function reformatMoneyForCurrency(
  value: string,
  fromCurrency: TreatmentCurrency,
  toCurrency: TreatmentCurrency
): string {
  const amount = parseMoney(value, fromCurrency)
  return amount > 0 ? formatMoneyInput(amount, toCurrency) : ''
}

function CompactMoneyInput({
  c,
  label,
  value,
  currency,
  tone,
  error,
  onChangeText,
}: {
  c: Colors
  label: string
  value: string
  currency: TreatmentCurrency
  tone: 'work' | 'paid'
  error: boolean
  onChangeText: (value: string) => void
}) {
  const styles = useMemo(() => makeStyles(c), [c])
  return (
    <View
      testID={`treatment-money-${tone}`}
      style={[styles.moneyCard, error && styles.moneyCardError]}
    >
      <Text style={styles.moneyLabel} numberOfLines={1}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="0"
        placeholderTextColor={c.labelTertiary as string}
        keyboardType={currency === 'USD' ? 'decimal-pad' : 'number-pad'}
        maxLength={16}
        selectTextOnFocus
        style={[
          styles.moneyInput,
          tone === 'work' ? styles.moneyInputWork : styles.moneyInputPaid,
        ]}
        accessibilityLabel={`${label} · ${currency}`}
      />
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    section: {
      gap: spacing.sm,
    },
    dateSection: {
      gap: spacing.xs,
    },
    label: {
      fontFamily: font('700'),
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 14,
      letterSpacing: 0.55,
      textTransform: 'uppercase',
      color: c.labelSecondary,
      paddingHorizontal: 2,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    sectionCounter: {
      ...typography.caption1,
      fontFamily: font('600'),
      color: c.labelSecondary,
      fontVariant: ['tabular-nums'],
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      width: '100%',
      height: 44,
      backgroundColor: c.background,
      borderRadius: radius.lg,
      borderWidth: 1.2,
      borderColor: c.separator,
      paddingHorizontal: 10,
    },
    dateRowError: {
      borderColor: c.danger as string,
    },
    dateIconWrap: {
      width: 28,
      height: 28,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.brandSurface,
    },
    dateInlineLabel: {
      fontFamily: font('600'),
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
      color: c.labelSecondary,
    },
    dateText: {
      flex: 1,
      ...typography.footnoteBold,
      fontFamily: font('600'),
      color: c.label,
      fontVariant: ['tabular-nums'],
      textAlign: 'right',
    },
    controlPressed: {
      opacity: 0.72,
      transform: [{ scale: 0.98 }],
    },
    primaryInputCard: {
      minHeight: inputMetrics.height,
      borderRadius: radius.lg,
      paddingHorizontal: inputMetrics.paddingHorizontal,
    },
    primaryInput: {
      paddingVertical: 10,
      fontFamily: font('600'),
      fontSize: inputMetrics.fontSize,
      lineHeight: inputMetrics.lineHeight,
    },
    suggestionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    suggestionChip: {
      minHeight: 30,
      justifyContent: 'center',
      paddingHorizontal: 11,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.separator,
      backgroundColor: c.background,
    },
    suggestionChipSelected: {
      borderColor: c.brand,
      backgroundColor: c.brandSurface,
    },
    suggestionText: {
      ...typography.caption1,
      fontFamily: font('600'),
      color: c.labelSecondary,
    },
    suggestionTextSelected: {
      color: c.brandDeep,
    },
    supportingText: {
      ...typography.caption2,
      color: c.labelSecondary,
    },
    amountRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    financeSection: {
      gap: spacing.sm,
      paddingTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.separator,
    },
    financeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    currencyControl: {
      width: 126,
    },
    moneyCard: {
      flex: 1,
      minWidth: 0,
      height: inputMetrics.height,
      justifyContent: 'center',
      gap: 1,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.separator,
      backgroundColor: c.fillQuaternary,
    },
    moneyCardError: {
      borderWidth: 1,
      borderColor: c.danger,
    },
    moneyLabel: {
      fontFamily: font('600'),
      fontSize: 9,
      fontWeight: '600',
      lineHeight: 11,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: c.labelSecondary,
    },
    moneyInput: {
      minHeight: 22,
      paddingVertical: 0,
      fontFamily: font('700'),
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 16,
      fontVariant: ['tabular-nums'],
    },
    moneyInputWork: {
      color: '#C7464D',
    },
    moneyInputPaid: {
      color: '#16805A',
    },
    commentCard: {
      minHeight: 72,
      alignItems: 'flex-start',
      borderRadius: radius.lg,
      paddingHorizontal: 14,
    },
    commentInput: {
      minHeight: 68,
      textAlignVertical: 'top',
      paddingTop: 12,
      paddingBottom: 10,
      fontSize: 14,
      lineHeight: 19,
    },
    errText: {
      ...typography.caption1,
      color: c.danger as string,
      paddingHorizontal: 4,
    },
  })
}
