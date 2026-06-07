import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native'
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
} from '../../api/patients'
import { useI18n } from '../../i18n'
import { toIntlLocale, toLocalDateKey } from '../../lib/format'
import type { Locale } from '../../constants'
import { radius, spacing, font, typography } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { isOfflineError } from '../../lib/offlineGuard'
import { applyPhoneInput, formatStoredPhone } from '../../lib/phoneFormat'
import type { ApiPatient } from '../../types'

interface Props {
  visible: boolean
  onClose: () => void
  patientId?: string | null  // null = create, string = edit
  onSaved?: () => void
}

// Mirrors the backend phone rule (StorePatientRequest): a leading `+` then
// 9–15 digits. `applyPhoneInput(...).raw` produces exactly this shape.
const PHONE_RE = /^\+\d{9,15}$/

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
  const [dobPickerVisible, setDobPickerVisible] = useState(false)

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
    setLocalPhoto(null)
    setPhotoRemoved(false)
  }, [visible, isEdit, patientQuery.data])

  // Backend StorePatientRequest: full_name min:3, phone/secondary_phone must
  // match /^\+\d{9,15}$/. Validate client-side so the user gets an inline
  // error instead of a raw 422.
  const phoneRaw = applyPhoneInput(phone).raw
  const secondaryPhoneRaw = secondaryPhone.trim() ? applyPhoneInput(secondaryPhone).raw : ''
  const nameError = submitted && name.trim().length < 3 ? t('patients.form.errorNameRequired') : null
  const phoneError =
    submitted && !PHONE_RE.test(phoneRaw) ? t('patients.form.errorPhoneRequired') : null
  const secondaryPhoneError =
    submitted && secondaryPhoneRaw !== '' && !PHONE_RE.test(secondaryPhoneRaw)
      ? t('patients.form.errorPhoneRequired')
      : null

  const buildPayload = (): Partial<ApiPatient> & { category_id: string | null } => ({
    full_name: name.trim(),
    // Persist the raw E.164-ish form (`+998901234567`) so the backend
    // doesn't store spaces — matching and search behave better against
    // the canonical shape, and we always know how to display it via
    // `formatStoredPhone` on read.
    phone: applyPhoneInput(phone).raw,
    secondary_phone: secondaryPhone.trim() ? applyPhoneInput(secondaryPhone).raw : undefined,
    date_of_birth: dob.trim() || undefined,
    address: address.trim() || undefined,
    allergies: allergies.trim() || undefined,
    current_medications: medications.trim() || undefined,
    medical_history: history.trim() || undefined,
    // Backend reads a single `category_id` (PatientService::syncCategory);
    // sending the `categories` array would be silently ignored. null clears it.
    category_id: selectedCategoryId,
  })

  const existingPhotoUrl =
    patientQuery.data?.photo_thumbnail_url ?? patientQuery.data?.photo_url ?? null
  const photoPreviewUri = localPhoto?.uri ?? (photoRemoved ? null : existingPhotoUrl)

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
      } catch (e) {
        if (!isOfflineError(e)) photoFailed = true
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
      toast.error(t('patients.form.failed'))
    },
  })

  const onPickedPhoto = (assets: PickedAsset[]) => {
    const first = assets[0]
    if (!first) return
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
    if (!validName || !validPhone || !validSecondary) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      return
    }
    mutation.mutate()
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={isEdit ? t('patients.form.editTitle') : t('patients.form.createTitle')}
    >
      {/* Photo */}
      <View style={styles.photoSection}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync()
            setPhotoPickerOpen(true)
          }}
          style={styles.photoTap}
          accessibilityRole="button"
          accessibilityLabel={t('patients.form.removePhoto')}
        >
          <PatientAvatar name={name || '?'} size={88} uri={photoPreviewUri} />
          <View style={styles.photoBadge}>
            <Icon name="camera" size={14} color="#FFFFFF" />
          </View>
        </Pressable>
        {photoPreviewUri ? (
          <Pressable onPress={onRemovePhoto} hitSlop={8}>
            <Text style={styles.photoRemove}>{t('patients.form.removePhoto')}</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Basic info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('patients.form.sections.basic')}</Text>

        <Field label={t('patients.form.name')}>
          <InputCard
            iconName="person-outline"
            value={name}
            onChangeText={setName}
            placeholder={t('patients.form.namePlaceholder')}
            autoCapitalize="words"
            maxLength={255}
            error={Boolean(nameError)}
          />
        </Field>

        <Field label={t('patients.form.phone')}>
          <InputCard
            iconName="call-outline"
            value={phone}
            onChangeText={(v) => setPhone(applyPhoneInput(v).display)}
            placeholder={t('patients.form.phonePlaceholder')}
            keyboardType="phone-pad"
            // +998 XX XXX XX XX is 17 chars including spaces and `+`.
            // Cap the input itself so the keyboard can't bypass the
            // normalizer with a paste.
            maxLength={17}
            error={Boolean(phoneError)}
          />
        </Field>

        <Field label={t('patients.form.secondaryPhone')}>
          <InputCard
            iconName="call-outline"
            value={secondaryPhone}
            onChangeText={(v) => setSecondaryPhone(applyPhoneInput(v).display)}
            placeholder={t('patients.form.phonePlaceholder')}
            keyboardType="phone-pad"
            maxLength={17}
            error={Boolean(secondaryPhoneError)}
          />
        </Field>

        <Field label={t('patients.form.dob')}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync()
              setDobPickerVisible(true)
            }}
            style={({ pressed }) => [styles.dobRow, pressed && styles.dobRowPressed]}
          >
            <View style={styles.dobIconWrap}>
              <Icon
                name="gift-outline"
                size={20}
                color={dob ? (c.brand as string) : (c.labelSecondary as string)}
              />
            </View>
            <Text
              style={[styles.dobText, !dob && styles.dobPlaceholder]}
              numberOfLines={1}
            >
              {dob ? formatDob(dob, locale as Locale) : t('patients.form.dobPlaceholder')}
            </Text>
            {dob ? (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.()
                  Haptics.selectionAsync()
                  setDob('')
                }}
                hitSlop={10}
                style={styles.dobClearBtn}
              >
                <Icon name="close-circle" size={20} color={c.labelTertiary as string} />
              </Pressable>
            ) : (
              <Icon name="chevron-forward" size={18} color={c.labelTertiary as string} />
            )}
          </Pressable>
        </Field>
      </View>

      {/* Categories */}
      {allCategories.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('patients.form.sections.categories')}</Text>
          <View style={styles.categoryRow}>
            {allCategories.map((cat) => {
              const active = selectedCategoryId === cat.id
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => {
                    Haptics.selectionAsync()
                    toggleCategory(cat.id)
                  }}
                  style={[
                    styles.categoryChip,
                    active && { backgroundColor: cat.color, borderColor: cat.color },
                  ]}
                >
                  {!active ? (
                    <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                  ) : null}
                  <Text
                    style={[
                      styles.categoryChipText,
                      active && styles.categoryChipTextActive,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      ) : null}

      {/* Address */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('patients.form.sections.address')}</Text>
        <View style={styles.textareaWrap}>
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder={t('patients.form.addressPlaceholder')}
            placeholderTextColor={c.labelTertiary as string}
            style={styles.textarea}
            multiline
            numberOfLines={3}
            maxLength={255}
          />
        </View>
      </View>

      {/* Medical */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('patients.form.sections.medical')}</Text>

        <Field label={t('patients.form.allergies')}>
          <InputCard
            iconName="warning-outline"
            value={allergies}
            onChangeText={setAllergies}
            placeholder={t('patients.form.allergiesPlaceholder')}
            maxLength={40}
          />
        </Field>

        <Field label={t('patients.form.medications')}>
          <InputCard
            iconName="medkit-outline"
            value={medications}
            onChangeText={setMedications}
            placeholder={t('patients.form.medicationsPlaceholder')}
            maxLength={120}
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
        size="lg"
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
    photoSection: {
      alignItems: 'center',
      gap: 8,
      marginBottom: spacing.md,
    },
    photoTap: {
      position: 'relative',
    },
    photoBadge: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: c.brand as string,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: c.background as string,
    },
    photoRemove: {
      ...typography.footnote,
      color: c.danger as string,
      fontFamily: font('600'),
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
    textareaWrap: {
      backgroundColor: c.fillQuaternary,
      borderRadius: radius.lg,
      paddingHorizontal: 14,
      paddingVertical: 12,
      minHeight: 80,
    },
    textarea: {
      ...typography.body,
      fontFamily: font('400'),
      color: c.label,
      textAlignVertical: 'top',
      minHeight: 56,
    },
    categoryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.separator as string,
      backgroundColor: c.background,
    },
    categoryDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
    },
    categoryChipText: {
      fontFamily: font('600'),
      fontSize: 13,
      fontWeight: '600',
      color: c.label,
    },
    categoryChipTextActive: {
      color: '#FFFFFF',
    },
    dobRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      minHeight: 56,
      backgroundColor: c.background,
      borderRadius: radius.xl,
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
      ...typography.body,
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

