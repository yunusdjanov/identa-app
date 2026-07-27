import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import BottomSheet from '../ui/BottomSheet'
import InputCard from '../ui/InputCard'
import Button from '../ui/Button'
import ProfileFormGuard from './ProfileFormGuard'
import { useToast } from '../ui/Toast'
import { getProfile, updateProfile } from '../../api/profile'
import { getCurrentUser } from '../../api/auth'
import { useI18n } from '../../i18n'
import { useAuthStore } from '../../stores/auth'
import { spacing, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { isOfflineError } from '../../lib/offlineGuard'
import { applyPhoneInput, formatStoredPhone, isValidUzbekPhone } from '../../lib/phoneFormat'
import { INPUT_LIMITS } from '../../lib/validation'
import { useSettingsFormDismiss } from './useSettingsFormDismiss'

interface Props {
  visible: boolean
  onClose: () => void
}

export default function ProfileEditSheet({ visible, onClose }: Props) {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const toast = useToast()
  const queryClient = useQueryClient()
  const setUser = useAuthStore((s) => s.setUser)
  const user = useAuthStore((s) => s.user)

  const profileQuery = useQuery({
    queryKey: ['settings', 'profile'],
    queryFn: getProfile,
    enabled: visible,
    staleTime: 60_000,
  })

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [license, setLicense] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const initialValues = useRef('')

  useEffect(() => {
    if (visible && profileQuery.data) {
      const nextName = profileQuery.data.name ?? ''
      const nextEmail = profileQuery.data.email ?? ''
      const nextPhone = formatStoredPhone(profileQuery.data.phone)
      const nextLicense = profileQuery.data.license_number ?? ''
      setName(nextName)
      setEmail(nextEmail)
      setPhone(nextPhone)
      setLicense(nextLicense)
      setSubmitted(false)
      initialValues.current = JSON.stringify({
        name: nextName,
        email: nextEmail,
        phone: nextPhone,
        license: nextLicense,
      })
    }
  }, [profileQuery.data, visible])

  const isDentist = user?.role === 'dentist'

  const normalizedName = name.trim()
  const normalizedEmail = email.trim()
  const nameInvalid =
    normalizedName.length < 3 || normalizedName.length > INPUT_LIMITS.personName
  const emailInvalid = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    || normalizedEmail.length > INPUT_LIMITS.email
  const phoneInvalid = Boolean(phone.trim()) && !isValidUzbekPhone(phone)
  const licenseInvalid = license.trim().length > 50

  const mutation = useMutation({
    mutationFn: () =>
      updateProfile({
        name: normalizedName,
        email: normalizedEmail,
        phone: phone.trim() ? applyPhoneInput(phone).raw : null,
        license_number: license.trim() || null,
      }),
    onSuccess: async (data) => {
      toast.success(t('settings.profileSheet.saved'))
      if (user) {
        const emailChanged = user.email !== data.email
        setUser({
          ...user,
          name: data.name,
          email: data.email,
          ...(emailChanged ? { email_verified_at: undefined } : {}),
        })
      }
      queryClient.invalidateQueries({ queryKey: ['settings', 'profile'] })
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      onClose()

      // The profile response intentionally contains only editable fields.
      // Refresh /auth/me so security-derived flags (especially email
      // verification after an address change) stay server-authoritative.
      try {
        const refreshedUser = await queryClient.fetchQuery({
          queryKey: ['auth', 'me'],
          queryFn: getCurrentUser,
          staleTime: 0,
        })
        const currentSession = useAuthStore.getState()
        if (
          currentSession.isAuthenticated &&
          currentSession.user?.id === refreshedUser.id
        ) {
          setUser(refreshedUser)
        }
      } catch {
        // The immediate local merge above already fails safe by clearing the
        // verification flag when the email changed.
      }
    },
    onError: (err) => {
      if (isOfflineError(err)) return
      toast.error(t('settings.profileSheet.failed'))
    },
  })

  const handleSubmit = () => {
    if (!profileQuery.data) return
    setSubmitted(true)
    if (nameInvalid || emailInvalid || phoneInvalid || licenseInvalid) {
      toast.error(t('settings.profileSheet.fixErrors'))
      return
    }
    mutation.mutate()
  }

  const isDirty =
    visible &&
    Boolean(profileQuery.data) &&
    initialValues.current !== JSON.stringify({ name, email, phone, license })
  const canDismiss = useSettingsFormDismiss({
    isDirty,
    isPending: mutation.isPending,
  })

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onBeforeClose={canDismiss}
      title={t('settings.rows.profile')}
      closeAccessibilityLabel={t('common.close')}
    >
      <ProfileFormGuard
        isLoading={profileQuery.isLoading}
        isError={profileQuery.isError && !profileQuery.data}
        onRetry={() => profileQuery.refetch()}
      >
      <Field label={t('settings.profileSheet.nameLabel')}>
        <InputCard
          iconName="person-outline"
          value={name}
          onChangeText={setName}
          placeholder={t('settings.profileSheet.namePlaceholder')}
          autoCapitalize="words"
          maxLength={INPUT_LIMITS.personName}
          error={submitted && nameInvalid}
        />
      </Field>

      <Field label={t('settings.profileSheet.emailLabel')}>
        <InputCard
          iconName="mail-outline"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={INPUT_LIMITS.email}
          error={submitted && emailInvalid}
        />
      </Field>

      <Field label={t('settings.profileSheet.phoneLabel')}>
        <InputCard
          iconName="call-outline"
          value={phone}
          onChangeText={(v) => setPhone(applyPhoneInput(v).display)}
          placeholder={t('settings.profileSheet.phonePlaceholder')}
          keyboardType="phone-pad"
          maxLength={17}
          error={submitted && phoneInvalid}
        />
      </Field>

      {isDentist ? (
        <Field label={t('settings.profileSheet.licenseLabel')}>
          <InputCard
            iconName="ribbon-outline"
            value={license}
            onChangeText={setLicense}
            placeholder={t('settings.profileSheet.licensePlaceholder')}
            maxLength={50}
            error={submitted && licenseInvalid}
          />
        </Field>
      ) : null}

      <Button
        title={
          mutation.isPending
            ? t('settings.profileSheet.saving')
            : t('settings.profileSheet.save')
        }
        onPress={handleSubmit}
        loading={mutation.isPending}
        fullWidth
        size="lg"
        style={{ marginTop: spacing.xs }}
      />
      </ProfileFormGuard>
    </BottomSheet>
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
    field: { gap: 6 },
    fieldLabel: {
      fontFamily: font('700'),
      fontSize: 12,
      fontWeight: '700',
      color: c.labelSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginLeft: 4,
    },
  })
}
