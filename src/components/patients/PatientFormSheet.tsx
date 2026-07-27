import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, View, Text, StyleSheet, Pressable, TextInput } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'

import BottomSheet from '../ui/BottomSheet'
import InputCard from '../ui/InputCard'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import DateWheelPicker from '../ui/DateWheelPicker'
import PatientAvatar from '../ui/PatientAvatar'
import { ImagePickerSheet, type PickedAsset } from '../gallery'
import { useToast } from '../ui/Toast'
import {
  getPatient,
  createPatient,
  updatePatient,
  listCategories,
  uploadPatientPhoto,
  deletePatientPhoto,
  type PatientWritePayload,
} from '../../api/patients'
import { useI18n } from '../../i18n'
import { toIntlLocale, toLocalDateKey } from '../../lib/format'
import type { Locale } from '../../constants'
import {
  inputMetrics,
  radius,
  spacing,
  font,
  typography,
} from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { isOfflineError } from '../../lib/offlineGuard'
import { isApiError } from '../../api/client'
import { applyPhoneInput, formatStoredPhone } from '../../lib/phoneFormat'
import { getPatientPhotoUris } from '../../lib/patientPhoto'

interface Props {
  visible: boolean
  onClose: () => void
  patientId?: string | null  // null = create, string = edit
  onSaved?: () => void
}

// Mirrors the backend phone rule (StorePatientRequest): a leading `+` then
// 9–15 digits. `applyPhoneInput(...).raw` produces exactly this shape.
const PHONE_RE = /^\+\d{9,15}$/
const PATIENT_PHOTO_MAX_BYTES = 5 * 1024 * 1024

interface PatientFormValues {
  name: string
  phone: string
  secondaryPhone: string
  dob: string
  address: string
  allergies: string
  medications: string
  history: string
  categoryId: string | null
}

function optionalWriteValue(value: string, isEdit: boolean): string | null | undefined {
  const normalized = value.trim()
  return normalized || (isEdit ? null : undefined)
}

export function buildPatientPayload(
  values: PatientFormValues,
  isEdit: boolean
): PatientWritePayload {
  return {
    full_name: values.name.trim(),
    phone: applyPhoneInput(values.phone).raw,
    secondary_phone: values.secondaryPhone.trim()
      ? applyPhoneInput(values.secondaryPhone).raw
      : isEdit
        ? null
        : undefined,
    date_of_birth: optionalWriteValue(values.dob, isEdit),
    address: optionalWriteValue(values.address, isEdit),
    allergies: optionalWriteValue(values.allergies, isEdit),
    current_medications: optionalWriteValue(values.medications, isEdit),
    medical_history: optionalWriteValue(values.history, isEdit),
    category_id: values.categoryId,
  }
}

// Unified create + edit sheet. When patientId is provided, loads the patient
// and pre-fills the form; otherwise opens blank for a new patient.
export default function PatientFormSheet({ visible, onClose, patientId, onSaved }: Props) {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const toast = useToast()
  const queryClient = useQueryClient()

  const isEdit = Boolean(patientId)

  // Fields
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [secondaryPhone, setSecondaryPhone] = useState('')
  const [dob, setDob] = useState('')
  const [address, setAddress] = useState('')
  const [allergies, setAllergies] = useState('')
  const [medications, setMedications] = useState('')
  const [history, setHistory] = useState('')
  // The backend stores a single category per patient (`category_id`), matching
  // the web. Single-select, not multi.
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({})
  const [dobPickerVisible, setDobPickerVisible] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)
  const phoneInputRef = useRef<TextInput>(null)

  // Photo: a newly-picked local asset (not yet uploaded), or a flag that the
  // user removed the existing photo. Uploaded after the patient row is saved.
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false)
  const [localPhoto, setLocalPhoto] = useState<PickedAsset | null>(null)
  const [photoRemoved, setPhotoRemoved] = useState(false)

  // Available categories
  const categoriesQuery = useQuery({
    queryKey: ['patient-categories', 'list'],
    queryFn: listCategories,
    enabled: visible,
    staleTime: 5 * 60_000,
  })
  const allCategories = categoriesQuery.data ?? []

  const toggleCategory = (id: string) => {
    setSelectedCategoryId((prev) => (prev === id ? null : id))
  }

  // Load patient when editing
  const patientQuery = useQuery({
    queryKey: ['patients', 'detail', patientId],
    queryFn: () => getPatient(patientId!),
    enabled: visible && isEdit,
    staleTime: 30_000,
  })

  // Reset form on open
  useEffect(() => {
    if (!visible) return
    if (isEdit) {
      const p = patientQuery.data
      if (p) {
        setName(p.full_name ?? '')
        // Hydrate with the display-formatted version so the edit form
        // shows the same shape as the user typed it on creation.
        setPhone(formatStoredPhone(p.phone))
        setSecondaryPhone(formatStoredPhone(p.secondary_phone))
        setDob(p.date_of_birth ?? '')
        setAddress(p.address ?? '')
        setAllergies(p.allergies ?? '')
        setMedications(p.current_medications ?? '')
        setHistory(p.medical_history ?? '')
        setSelectedCategoryId((p.categories ?? [])[0]?.id ?? null)
      } else {
        // This sheet is shared across patients. Clear the previous record
        // immediately so its PHI can never flash while the next edit loads.
        setName('')
        setPhone('')
        setSecondaryPhone('')
        setDob('')
        setAddress('')
        setAllergies('')
        setMedications('')
        setHistory('')
        setSelectedCategoryId(null)
      }
    } else {
      setName('')
      setPhone('')
      setSecondaryPhone('')
      setDob('')
      setAddress('')
      setAllergies('')
      setMedications('')
      setHistory('')
      setSelectedCategoryId(null)
    }
    setSubmitted(false)
    setServerErrors({})
    setLocalPhoto(null)
    setPhotoRemoved(false)
    setAdvancedOpen(false)
    setCategoryPickerOpen(false)
  }, [visible, isEdit, patientId, patientQuery.data])

  // Backend StorePatientRequest: full_name min:3, phone/secondary_phone must
  // match /^\+\d{9,15}$/. Validate client-side so the user gets an inline
  // error instead of a raw 422.
  const phoneRaw = applyPhoneInput(phone).raw
  const secondaryPhoneRaw = secondaryPhone.trim() ? applyPhoneInput(secondaryPhone).raw : ''
  const nameError =
    (submitted && name.trim().length < 3 ? t('patients.form.errorNameRequired') : null) ??
    serverErrors.full_name?.[0] ??
    null
  const phoneError =
    (submitted && !PHONE_RE.test(phoneRaw) ? t('patients.form.errorPhoneRequired') : null) ??
    serverErrors.phone?.[0] ??
    null
  const secondaryPhoneError =
    (submitted && secondaryPhoneRaw !== '' && !PHONE_RE.test(secondaryPhoneRaw)
      ? t('patients.form.errorPhoneRequired')
      : null) ??
    serverErrors.secondary_phone?.[0] ??
    null
  const addressError =
    (submitted && address.trim().length > 0 && address.trim().length < 3
      ? t('patients.form.errorAddressTooShort')
      : null) ??
    serverErrors.address?.[0] ??
    null

  const clearServerError = (field: string) => {
    setServerErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const buildPayload = () =>
    buildPatientPayload(
      {
        name,
        phone,
        secondaryPhone,
        dob,
        address,
        allergies,
        medications,
        history,
        categoryId: selectedCategoryId,
      },
      isEdit
    )

  const existingPhotoUris = getPatientPhotoUris(patientQuery.data)
  const existingPhotoUrl = existingPhotoUris[0] ?? null
  const photoPreviewUri = localPhoto?.uri
    ? localPhoto.uri
    : photoRemoved
      ? null
      : existingPhotoUris
  const hasPhotoPreview = Boolean(
    localPhoto?.uri || (!photoRemoved && existingPhotoUris.length > 0)
  )

  const mutation = useMutation({
    mutationFn: async () => {
      const saved = isEdit
        ? await updatePatient(patientId!, buildPayload())
        : await createPatient(buildPayload())
      // Photo side-effects run after the patient row exists. A photo failure
      // doesn't fail the whole save (the patient is still persisted) — we
      // surface a warning toast instead.
      let photoFailed = false
      try {
        if (localPhoto) {
          await uploadPatientPhoto(saved.id, {
            uri: localPhoto.uri,
            mimeType: localPhoto.mimeType ?? null,
            fileName: localPhoto.fileName ?? null,
            fileSize: localPhoto.fileSize ?? null,
          })
        } else if (photoRemoved && existingPhotoUrl) {
          await deletePatientPhoto(saved.id)
        }
      } catch {
        // The patient row is already persisted at this point. Treat every
        // photo-side-effect failure, including a mid-save network drop, as a
        // partial save so the user never receives a false full-success toast.
        photoFailed = true
      }
      return { photoFailed }
    },
    onSuccess: ({ photoFailed }) => {
      if (photoFailed) {
        toast.warning(t('gallery.uploadFailedTryAgain'))
      } else {
        toast.success(isEdit ? t('patients.form.savedEdit') : t('patients.form.savedCreate'))
      }
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      onSaved?.()
      onClose()
    },
    onError: (err) => {
      if (isOfflineError(err)) return
      if (isApiError(err) && err.kind === 'validation') {
        const fieldErrors = err.fieldErrors ?? {}
        setServerErrors(fieldErrors)
        if (
          [
            'secondary_phone',
            'date_of_birth',
            'address',
            'allergies',
            'current_medications',
            'medical_history',
          ].some((field) => Boolean(fieldErrors[field]))
        ) {
          setAdvancedOpen(true)
        }
        const firstMessage = Object.values(fieldErrors).flat()[0] ?? err.message
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        toast.error(firstMessage)
        return
      }
      toast.error(t('patients.form.failed'))
    },
  })

  const onPickedPhoto = (assets: PickedAsset[]) => {
    const first = assets[0]
    if (!first) return
    if (typeof first.fileSize === 'number' && first.fileSize > PATIENT_PHOTO_MAX_BYTES) {
      toast.error(t('patients.form.errorPhotoTooLarge'))
      return
    }
    setLocalPhoto(first)
    setPhotoRemoved(false)
  }

  const onRemovePhoto = () => {
    Haptics.selectionAsync()
    if (localPhoto) {
      setLocalPhoto(null)
    } else {
      setPhotoRemoved(true)
    }
  }

  const handleSubmit = () => {
    setSubmitted(true)
    const validName = name.trim().length >= 3
    const validPhone = PHONE_RE.test(phoneRaw)
    const validSecondary = secondaryPhoneRaw === '' || PHONE_RE.test(secondaryPhoneRaw)
    const validAddress = address.trim().length === 0 || address.trim().length >= 3
    if (!validName || !validPhone || !validSecondary || !validAddress) {
      if (!validSecondary || !validAddress) setAdvancedOpen(true)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      return
    }
    mutation.mutate()
  }

  if (visible && isEdit && !patientQuery.data) {
    return (
      <BottomSheet
        visible
        onClose={onClose}
        title={t('patients.form.editTitle')}
        closeAccessibilityLabel={t('common.close')}
      >
        <View style={styles.editQueryState} accessibilityLiveRegion="polite">
          {patientQuery.isError ? (
            <>
              <Text style={styles.editQueryMessage}>{t('patients.loadFailed')}</Text>
              <Button
                title={t('common.retry')}
                variant="secondary"
                size="md"
                onPress={() => patientQuery.refetch()}
              />
            </>
          ) : (
            <>
              <ActivityIndicator color={c.brand as string} />
              <Text style={styles.editQueryMessage}>{t('common.loading')}</Text>
            </>
          )}
        </View>
      </BottomSheet>
    )
  }

  const openPhotoPicker = () => {
    Haptics.selectionAsync()
    setPhotoPickerOpen(true)
  }
  const requiredFields = (
    <>
      <Field label={t('patients.form.name')}>
        <InputCard
          iconName="person-outline"
          value={name}
          onChangeText={(value) => {
            setName(value)
            clearServerError('full_name')
          }}
          placeholder={t('patients.form.namePlaceholder')}
          autoCapitalize="words"
          autoFocus={visible && !isEdit}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => phoneInputRef.current?.focus()}
          maxLength={255}
          error={Boolean(nameError)}
          errorMessage={nameError}
          accessibilityLabel={t('patients.form.name')}
          containerStyle={styles.quickInputCard}
          style={styles.quickInput}
        />
        <FieldError message={nameError} />
      </Field>

      <Field label={t('patients.form.phone')}>
        <InputCard
          ref={phoneInputRef}
          iconName="call-outline"
          value={phone}
          onChangeText={(value) => {
            setPhone(applyPhoneInput(value).display)
            clearServerError('phone')
          }}
          placeholder={t('patients.form.phonePlaceholder')}
          keyboardType="phone-pad"
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          // +998 XX XXX XX XX is 17 chars including spaces and `+`.
          maxLength={17}
          error={Boolean(phoneError)}
          errorMessage={phoneError}
          accessibilityLabel={t('patients.form.phone')}
          containerStyle={styles.quickInputCard}
          style={styles.quickInput}
        />
        <FieldError message={phoneError} />
      </Field>
    </>
  )
  const selectedCategory =
    allCategories.find((category) => category.id === selectedCategoryId) ?? null
  const optionalIdentityFields = (
    <>
      <Field label={t('patients.form.secondaryPhone')}>
        <InputCard
          iconName="call-outline"
          value={secondaryPhone}
          onChangeText={(value) => {
            setSecondaryPhone(applyPhoneInput(value).display)
            clearServerError('secondary_phone')
          }}
          placeholder={t('patients.form.phonePlaceholder')}
          keyboardType="phone-pad"
          maxLength={17}
          error={Boolean(secondaryPhoneError)}
          errorMessage={secondaryPhoneError}
          accessibilityLabel={t('patients.form.secondaryPhone')}
          containerStyle={styles.compactInputCard}
          style={styles.compactInput}
        />
        <FieldError message={secondaryPhoneError} />
      </Field>

      <Field label={t('patients.form.dob')}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync()
            setDobPickerVisible(true)
          }}
          style={({ pressed }) => [
            styles.dobRow,
            pressed && styles.dobRowPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${t('patients.form.dob')}: ${
            dob
              ? formatDob(dob, locale as Locale)
              : t('patients.form.dobPlaceholder')
          }`}
        >
          <View style={styles.dobIconWrap}>
            <Icon
              name="gift-outline"
              size={20}
              color={
                dob ? (c.brand as string) : (c.labelSecondary as string)
              }
            />
          </View>
          <Text
            style={[styles.dobText, !dob && styles.dobPlaceholder]}
            numberOfLines={1}
          >
            {dob
              ? formatDob(dob, locale as Locale)
              : t('patients.form.dobPlaceholder')}
          </Text>
          {dob ? (
            <Pressable
              onPress={(event) => {
                event.stopPropagation?.()
                Haptics.selectionAsync()
                setDob('')
              }}
              hitSlop={10}
              style={styles.dobClearBtn}
              accessibilityRole="button"
              accessibilityLabel={t('common.clear')}
            >
              <Icon
                name="close-circle"
                size={20}
                color={c.labelTertiary as string}
              />
            </Pressable>
          ) : (
            <Icon
              name="chevron-forward"
              size={18}
              color={c.labelTertiary as string}
            />
          )}
        </Pressable>
      </Field>
    </>
  )
  const categoryLoadError = (
    <View style={styles.categoryLoadError} accessibilityRole="alert">
      <Icon
        name="cloud-offline-outline"
        size={16}
        color={c.warning as string}
      />
      <Text style={styles.categoryLoadErrorText}>
        {t('patients.categoriesLoadFailed')}
      </Text>
      <Pressable
        onPress={() => categoriesQuery.refetch()}
        disabled={categoriesQuery.isFetching}
        hitSlop={6}
        style={({ pressed }) => [
          styles.categoryLoadRetry,
          pressed && styles.quickControlPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('common.retry')}
        accessibilityState={{ disabled: categoriesQuery.isFetching }}
      >
        {categoriesQuery.isFetching ? (
          <ActivityIndicator size="small" color={c.warning as string} />
        ) : (
          <Text style={styles.categoryLoadRetryText}>{t('common.retry')}</Text>
        )}
      </Pressable>
    </View>
  )
  const addressSection = (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {t('patients.form.sections.address')}
      </Text>
      <View
        style={[
          styles.textareaWrap,
          addressError && styles.fieldErrorBorder,
        ]}
      >
        <TextInput
          value={address}
          onChangeText={(value) => {
            setAddress(value)
            clearServerError('address')
          }}
          placeholder={t('patients.form.addressPlaceholder')}
          placeholderTextColor={c.labelTertiary as string}
          style={styles.textarea}
          multiline
          numberOfLines={3}
          maxLength={255}
          accessibilityLabel={t('patients.form.address')}
          accessibilityHint={addressError ?? undefined}
          aria-invalid={Boolean(addressError)}
        />
      </View>
      <FieldError message={addressError} />
    </View>
  )
  const medicalSection = (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {t('patients.form.sections.medical')}
      </Text>

      <Field label={t('patients.form.allergies')}>
        <InputCard
          iconName="warning-outline"
          value={allergies}
          onChangeText={setAllergies}
          placeholder={t('patients.form.allergiesPlaceholder')}
          maxLength={40}
          accessibilityLabel={t('patients.form.allergies')}
          containerStyle={styles.compactInputCard}
          style={styles.compactInput}
        />
      </Field>

      <Field label={t('patients.form.medications')}>
        <InputCard
          iconName="medkit-outline"
          value={medications}
          onChangeText={setMedications}
          placeholder={t('patients.form.medicationsPlaceholder')}
          maxLength={120}
          accessibilityLabel={t('patients.form.medications')}
          containerStyle={styles.compactInputCard}
          style={styles.compactInput}
        />
      </Field>

      <Field label={t('patients.form.history')}>
        <View style={styles.textareaWrap}>
          <TextInput
            value={history}
            onChangeText={setHistory}
            placeholder={t('patients.form.historyPlaceholder')}
            placeholderTextColor={c.labelTertiary as string}
            style={styles.textarea}
            multiline
            numberOfLines={3}
            maxLength={300}
            accessibilityLabel={t('patients.form.history')}
          />
          <Text
            style={[
              styles.charCounter,
              history.length >= 280 && styles.charCounterWarn,
            ]}
          >
            {history.length}/300
          </Text>
        </View>
      </Field>
    </View>
  )

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={isEdit ? t('patients.form.editTitle') : t('patients.form.createTitle')}
      closeAccessibilityLabel={t('common.close')}
    >
      <View style={styles.quickCreate} testID="patient-form-compact-layout">
          <View style={styles.quickPhotoSection}>
            <Pressable
              onPress={openPhotoPicker}
              style={({ pressed }) => [
                styles.quickPhotoControl,
                pressed && styles.quickControlPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('gallery.pickerTitle')}
            >
              <View style={styles.quickPhotoAvatar}>
                <PatientAvatar
                  name={name || '?'}
                  size={56}
                  initialsFontSize={17}
                  uri={photoPreviewUri}
                />
                <View style={styles.quickPhotoBadge}>
                  <Icon name="camera" size={11} color="#FFFFFF" />
                </View>
              </View>
              <View style={styles.quickControlCopy}>
                <Text style={styles.quickControlTitle} numberOfLines={1}>
                  {t('patients.form.photoOptional')}
                </Text>
                <Text style={styles.quickControlHint} numberOfLines={1}>
                  {hasPhotoPreview
                    ? t('patients.detail.generalPhotos.replace')
                    : t('gallery.add')}
                </Text>
              </View>
              <Icon
                name="chevron-forward"
                size={17}
                color={c.labelTertiary as string}
              />
            </Pressable>
            {hasPhotoPreview ? (
              <Pressable
                onPress={onRemovePhoto}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('patients.form.removePhoto')}
              >
                <Text style={styles.quickPhotoRemove}>
                  {t('patients.form.removePhoto')}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.quickRequired}>{requiredFields}</View>

          {categoriesQuery.isError ? (
            categoryLoadError
          ) : allCategories.length > 0 ? (
            <View style={styles.quickSelectorGroup}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync()
                  setCategoryPickerOpen((current) => !current)
                }}
                style={({ pressed }) => [
                  styles.quickSelector,
                  pressed && styles.quickControlPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ expanded: categoryPickerOpen }}
                accessibilityLabel={t('patients.form.categoryPlaceholder')}
              >
                <View style={styles.quickSelectorIcon}>
                  {selectedCategory ? (
                    <View
                      style={[
                        styles.quickCategoryDot,
                        { backgroundColor: selectedCategory.color },
                      ]}
                    />
                  ) : (
                    <Icon
                      name="pricetag-outline"
                      size={17}
                      color={c.brand as string}
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.quickSelectorText,
                    !selectedCategory && styles.quickSelectorPlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {selectedCategory?.name ??
                    t('patients.form.categoryPlaceholder')}
                </Text>
                <Icon
                  name={
                    categoryPickerOpen ? 'chevron-up' : 'chevron-down'
                  }
                  size={17}
                  color={c.labelTertiary as string}
                />
              </Pressable>
              {categoryPickerOpen ? (
                <View style={styles.quickCategoryOptions}>
                  {allCategories.map((category) => {
                    const active = selectedCategoryId === category.id
                    return (
                      <Pressable
                        key={category.id}
                        onPress={() => {
                          Haptics.selectionAsync()
                          toggleCategory(category.id)
                          setCategoryPickerOpen(false)
                        }}
                        style={[
                          styles.quickCategoryOption,
                          active && styles.quickCategoryOptionActive,
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={category.name}
                      >
                        <View
                          style={[
                            styles.categoryDot,
                            { backgroundColor: category.color },
                          ]}
                        />
                        <Text
                          style={styles.quickCategoryOptionText}
                          numberOfLines={1}
                        >
                          {category.name}
                        </Text>
                        {active ? (
                          <Icon
                            name="checkmark"
                            size={16}
                            color={c.brand as string}
                          />
                        ) : null}
                      </Pressable>
                    )
                  })}
                </View>
              ) : null}
            </View>
          ) : null}

          <Pressable
            onPress={() => {
              Haptics.selectionAsync()
              setAdvancedOpen((current) => !current)
              setCategoryPickerOpen(false)
            }}
            style={({ pressed }) => [
              styles.quickAdvancedToggle,
              pressed && styles.quickControlPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ expanded: advancedOpen }}
            accessibilityLabel={t('patients.form.additionalInfo')}
          >
            <View style={styles.quickAdvancedIcon}>
              <Icon
                name="options-outline"
                size={17}
                color={c.brand as string}
              />
            </View>
            <View style={styles.quickControlCopy}>
              <Text style={styles.quickControlTitle} numberOfLines={1}>
                {t('patients.form.additionalInfo')}
              </Text>
              <Text style={styles.quickControlHint} numberOfLines={1}>
                {t('patients.form.additionalInfoHint')}
              </Text>
            </View>
            <Icon
              name={advancedOpen ? 'chevron-up' : 'chevron-down'}
              size={17}
              color={c.labelTertiary as string}
            />
          </Pressable>

          {advancedOpen ? (
            <View style={styles.quickAdvancedContent}>
              <View style={styles.section}>{optionalIdentityFields}</View>
              {addressSection}
              {medicalSection}
            </View>
          ) : null}
      </View>

      <Button
        title={
          mutation.isPending
            ? isEdit
              ? t('patients.form.saving')
              : t('patients.form.creating')
            : isEdit
              ? t('patients.form.save')
              : t('patients.form.create')
        }
        onPress={handleSubmit}
        loading={mutation.isPending}
        fullWidth
        size="md"
        style={{ marginTop: spacing.xs }}
      />

      <DateWheelPicker
        visible={dobPickerVisible}
        value={dob || null}
        maxDate={toLocalDateKey(new Date())}
        onClose={() => setDobPickerVisible(false)}
        onConfirm={(d) => setDob(d)}
      />

      <ImagePickerSheet
        visible={photoPickerOpen}
        onClose={() => setPhotoPickerOpen(false)}
        onPicked={onPickedPhoto}
        maxSelection={1}
      />
    </BottomSheet>
  )
}

function formatDob(dateStr: string, locale: Locale): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (!m) return dateStr
  const y = parseInt(m[1]!, 10)
  const mo = parseInt(m[2]!, 10)
  const d = parseInt(m[3]!, 10)
  if ([y, mo, d].some(Number.isNaN)) return dateStr
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(y, mo - 1, d))
}

function FieldError({ message }: { message: string | null }) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  if (!message) return null
  return (
    <Text
      style={styles.fieldErrorText}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      {message}
    </Text>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    editQueryState: {
      minHeight: 180,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
    },
    editQueryMessage: {
      ...typography.body,
      color: c.labelSecondary,
      textAlign: 'center',
    },
    quickCreate: {
      gap: 12,
    },
    quickPhotoSection: {
      gap: 4,
    },
    quickPhotoControl: {
      minHeight: 60,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      paddingHorizontal: 10,
      paddingVertical: 2,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.separator,
      backgroundColor: c.background,
    },
    quickPhotoAvatar: {
      width: 58,
      height: 58,
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickPhotoBadge: {
      position: 'absolute',
      right: -1,
      bottom: -1,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: c.background,
      backgroundColor: c.brand,
    },
    quickControlCopy: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    quickControlTitle: {
      fontFamily: font('600'),
      fontSize: 13,
      lineHeight: 17,
      fontWeight: '600',
      color: c.label,
    },
    quickControlHint: {
      fontFamily: font('500'),
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '500',
      color: c.labelSecondary,
    },
    quickPhotoRemove: {
      alignSelf: 'flex-end',
      paddingHorizontal: 4,
      ...typography.caption1,
      color: c.danger,
      fontFamily: font('600'),
    },
    quickRequired: {
      gap: 10,
    },
    quickInputCard: {
      minHeight: inputMetrics.height,
      paddingHorizontal: inputMetrics.paddingHorizontal,
      borderRadius: radius.lg,
    },
    quickInput: {
      fontSize: inputMetrics.fontSize,
      lineHeight: inputMetrics.lineHeight,
      paddingVertical: 10,
    },
    quickSelectorGroup: {
      gap: 6,
    },
    quickSelector: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingHorizontal: 12,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.separator,
      backgroundColor: c.background,
    },
    quickSelectorIcon: {
      width: 22,
      height: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickCategoryDot: {
      width: 9,
      height: 9,
      borderRadius: 4.5,
    },
    quickSelectorText: {
      flex: 1,
      minWidth: 0,
      fontFamily: font('600'),
      fontSize: 13,
      lineHeight: 17,
      fontWeight: '600',
      color: c.label,
    },
    quickSelectorPlaceholder: {
      color: c.labelSecondary,
    },
    quickCategoryOptions: {
      gap: 2,
      padding: 4,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.separator,
      backgroundColor: c.background,
    },
    quickCategoryOption: {
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingHorizontal: 10,
      borderRadius: radius.md,
    },
    quickCategoryOptionActive: {
      backgroundColor: c.brandSurface,
    },
    quickCategoryOptionText: {
      flex: 1,
      minWidth: 0,
      fontFamily: font('600'),
      fontSize: 13,
      lineHeight: 17,
      fontWeight: '600',
      color: c.label,
    },
    quickAdvancedToggle: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingHorizontal: 10,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.brandSoft,
      backgroundColor: c.brandSurface,
    },
    quickAdvancedIcon: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.sm,
      backgroundColor: c.background,
    },
    quickAdvancedContent: {
      gap: spacing.lg,
      paddingTop: 4,
    },
    quickControlPressed: {
      opacity: 0.7,
      transform: [{ scale: 0.99 }],
    },
    section: {
      gap: spacing.md,
    },
    sectionTitle: {
      fontFamily: font('700'),
      fontSize: 12,
      fontWeight: '700',
      color: c.labelSecondary,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginLeft: 4,
      marginBottom: -4,
    },
    field: { gap: 6 },
    fieldLabel: {
      fontFamily: font('600'),
      fontSize: 11,
      fontWeight: '600',
      color: c.labelSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginLeft: 4,
    },
    compactInputCard: {
      minHeight: inputMetrics.height,
      paddingHorizontal: inputMetrics.paddingHorizontal,
      borderRadius: radius.lg,
    },
    compactInput: {
      fontSize: inputMetrics.fontSize,
      lineHeight: inputMetrics.lineHeight,
      paddingVertical: 10,
    },
    textareaWrap: {
      backgroundColor: c.fillQuaternary,
      borderRadius: radius.lg,
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: 68,
    },
    fieldErrorBorder: {
      borderWidth: 1.2,
      borderColor: c.danger as string,
    },
    fieldErrorText: {
      ...typography.caption1,
      color: c.danger,
      marginHorizontal: 4,
    },
    textarea: {
      fontFamily: font('400'),
      fontSize: 15,
      lineHeight: 20,
      color: c.label,
      textAlignVertical: 'top',
      minHeight: 44,
    },
    categoryLoadError: {
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 10,
      borderRadius: radius.lg,
      backgroundColor: 'rgba(255, 149, 0, 0.08)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.warning,
    },
    categoryLoadErrorText: {
      ...typography.footnote,
      flex: 1,
      color: c.labelSecondary,
      fontFamily: font('500'),
    },
    categoryLoadRetry: {
      minHeight: 32,
      minWidth: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    categoryLoadRetryText: {
      ...typography.footnote,
      color: c.warning,
      fontFamily: font('700'),
    },
    categoryDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
    },
    dobRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: inputMetrics.paddingHorizontal,
      minHeight: inputMetrics.height,
      backgroundColor: c.background,
      borderRadius: radius.lg,
      borderWidth: 1.2,
      borderColor: c.separator as string,
    },
    dobRowPressed: {
      backgroundColor: c.fillQuaternary,
    },
    dobIconWrap: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dobText: {
      flex: 1,
      fontFamily: font('400'),
      fontSize: 15,
      lineHeight: 20,
      color: c.label,
    },
    dobPlaceholder: {
      color: c.labelTertiary,
    },
    dobClearBtn: {
      padding: 2,
    },
    charCounter: {
      alignSelf: 'flex-end',
      fontFamily: font('500'),
      fontSize: 11,
      fontWeight: '500',
      color: c.labelTertiary,
      marginTop: 4,
    },
    charCounterWarn: {
      color: c.danger,
    },
  })
}

