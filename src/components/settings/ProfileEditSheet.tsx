import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import BottomSheet from '../ui/BottomSheet'
import InputCard from '../ui/InputCard'
import Button from '../ui/Button'
import { useToast } from '../ui/Toast'
import { getProfile, updateProfile } from '../../api/profile'
import { useI18n } from '../../i18n'
import { useAuthStore } from '../../stores/auth'
import { spacing, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { isOfflineError } from '../../lib/offlineGuard'
import { applyPhoneInput, formatStoredPhone } from '../../lib/phoneFormat'

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

  useEffect(() => {
    if (profileQuery.data) {
      setName(profileQuery.data.name ?? '')
      setEmail(profileQuery.data.email ?? '')
      setPhone(formatStoredPhone(profileQuery.data.phone))
      setLicense(profileQuery.data.license_number ?? '')
      setSubmitted(false)
    }
  }, [profileQuery.data])

  const isDentist = user?.role === 'dentist'

  const nameError = submitted && !name.trim() ? t('login.errors.emailRequired') : null
  const emailError = submitted && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ? t('login.errors.emailInvalid')
    : null

  const mutation = useMutation({
    mutationFn: () =>
      updateProfile({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() ? applyPhoneInput(phone).raw : null,
        license_number: license.trim() || null,
      }),
    onSuccess: (data) => {
      toast.success(t('settings.profileSheet.saved'))
      if (user) setUser({ ...user, name: data.name, email: data.email })
      queryClient.invalidateQueries({ queryKey: ['settings', 'profile'] })
      onClose()
    },
    onError: (err) => {
      if (isOfflineError(err)) return
      toast.error(t('settings.profileSheet.failed'))
    },
  })

  const handleSubmit = () => {
    setSubmitted(true)
    if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return
    mutation.mutate()
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('settings.rows.profile')}
    >
      <Field label={t('settings.profileSheet.nameLabel')}>
        <InputCard
          iconName="person-outline"
          value={name}
          onChangeText={setName}
          placeholder={t('settings.profileSheet.namePlaceholder')}
          autoCapitalize="words"
          error={Boolean(nameError)}
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
          error={Boolean(emailError)}
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
        />
      </Field>

      {isDentist ? (
        <Field label={t('settings.profileSheet.licenseLabel')}>
          <InputCard
            iconName="ribbon-outline"
            value={license}
            onChangeText={setLicense}
            placeholder={t('settings.profileSheet.licensePlaceholder')}
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
