import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'

import BottomSheet from '../ui/BottomSheet'
import InputCard from '../ui/InputCard'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import DateWheelPicker from '../ui/DateWheelPicker'
import { useToast } from '../ui/Toast'
import { getPatient, createPatient, updatePatient, listCategories } from '../../api/patients'
import { useI18n } from '../../i18n'
import { toIntlLocale } from '../../lib/format'
import type { Locale } from '../../constants'
import { radius, spacing, font, typography } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { isOfflineError } from '../../lib/offlineGuard'
import { applyPhoneInput, formatStoredPhone } from '../../lib/phoneFormat'
import type { ApiPatient, ApiPatientCategory } from '../../types'

interface Props {
  visible: boolean
  onClose: () => void
  patientId?: string | null  // null = create, string = edit
  onSaved?: () => void
}

type Gender = 'male' | 'female' | null

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
  const [gender, setGender] = useState<Gender>(null)
  const [dob, setDob] = useState('')
  const [address, setAddress] = useState('')
  const [allergies, setAllergies] = useState('')
  const [medications, setMedications] = useState('')
  const [history, setHistory] = useState('')
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [dobPickerVisible, setDobPickerVisible] = useState(false)

  // Available categories
  const categoriesQuery = useQuery({
    queryKey: ['patient-categories', 'list'],
    queryFn: listCategories,
    enabled: visible,
    staleTime: 5 * 60_000,
  })
  const allCategories = categoriesQuery.data ?? []

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
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
        setGender((p.gender as Gender) ?? null)
        setDob(p.date_of_birth ?? '')
        setAddress(p.address ?? '')
        setAllergies(p.allergies ?? '')
        setMedications(p.current_medications ?? '')
        setHistory(p.medical_history ?? '')
        setSelectedCategoryIds((p.categories ?? []).map((c) => c.id))
      }
    } else {
      setName('')
      setPhone('')
      setSecondaryPhone('')
      setGender(null)
      setDob('')
      setAddress('')
      setAllergies('')
      setMedications('')
      setHistory('')
      setSelectedCategoryIds([])
    }
    setSubmitted(false)
  }, [visible, isEdit, patientQuery.data])

  const nameError = submitted && !name.trim() ? t('patients.form.errorNameRequired') : null
  const phoneError = submitted && !phone.trim() ? t('patients.form.errorPhoneRequired') : null

  const buildPayload = (): Partial<ApiPatient> => ({
    full_name: name.trim(),
    // Persist the raw E.164-ish form (`+998901234567`) so the backend
    // doesn't store spaces — matching and search behave better against
    // the canonical shape, and we always know how to display it via
    // `formatStoredPhone` on read.
    phone: applyPhoneInput(phone).raw,
    secondary_phone: secondaryPhone.trim() ? applyPhoneInput(secondaryPhone).raw : undefined,
    gender: gender ?? undefined,
    date_of_birth: dob.trim() || undefined,
    address: address.trim() || undefined,
    allergies: allergies.trim() || undefined,
    current_medications: medications.trim() || undefined,
    medical_history: history.trim() || undefined,
    categories: selectedCategoryIds
      .map((id) => allCategories.find((c) => c.id === id))
      .filter(Boolean) as ApiPatientCategory[],
  })

  const mutation = useMutation({
    mutationFn: () =>
      isEdit ? updatePatient(patientId!, buildPayload()) : createPatient(buildPayload()),
    onSuccess: () => {
      toast.success(isEdit ? t('patients.form.savedEdit') : t('patients.form.savedCreate'))
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      onSaved?.()
      onClose()
    },
    onError: (err) => {
      if (isOfflineError(err)) return
      toast.error(t('patients.form.failed'))
    },
  })

  const handleSubmit = () => {
    setSubmitted(true)
    if (!name.trim() || !phone.trim()) {
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
            maxLength={120}
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
          />
        </Field>

        <Field label={t('patients.form.gender')}>
          <View style={styles.genderRow}>
            <GenderChip
              active={gender === 'male'}
              onPress={() => setGender(gender === 'male' ? null : 'male')}
              label={t('patients.form.male')}
              iconChar="♂"
            />
            <GenderChip
              active={gender === 'female'}
              onPress={() => setGender(gender === 'female' ? null : 'female')}
              label={t('patients.form.female')}
              iconChar="♀"
            />
          </View>
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
              const active = selectedCategoryIds.includes(cat.id)
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
            maxLength={500}
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
          />
        </Field>

        <Field label={t('patients.form.medications')}>
          <InputCard
            iconName="medkit-outline"
            value={medications}
            onChangeText={setMedications}
            placeholder={t('patients.form.medicationsPlaceholder')}
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
              maxLength={1000}
            />
            <Text
              style={[
                styles.charCounter,
                history.length >= 950 && styles.charCounterWarn,
              ]}
            >
              {history.length}/1000
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
        onClose={() => setDobPickerVisible(false)}
        onConfirm={(d) => setDob(d)}
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

function GenderChip({
  active,
  onPress,
  label,
  iconChar,
}: {
  active: boolean
  onPress: () => void
  label: string
  iconChar: string
}) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync()
        onPress()
      }}
      style={[styles.genderChip, active && styles.genderChipActive]}
    >
      <Text style={[styles.genderIcon, active && styles.genderIconActive]}>{iconChar}</Text>
      <Text style={[styles.genderText, active && styles.genderTextActive]}>{label}</Text>
    </Pressable>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
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
    genderRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    genderChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: radius.lg,
      backgroundColor: c.fillQuaternary,
    },
    genderChipActive: {
      backgroundColor: c.brand,
    },
    genderIcon: {
      fontSize: 18,
      color: c.labelSecondary,
    },
    genderIconActive: { color: '#FFFFFF' },
    genderText: {
      fontFamily: font('600'),
      fontSize: 14,
      fontWeight: '600',
      color: c.label,
    },
    genderTextActive: { color: '#FFFFFF' },
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

