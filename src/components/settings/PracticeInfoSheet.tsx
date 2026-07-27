import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, StyleSheet, TextInput } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import BottomSheet from '../ui/BottomSheet'
import InputCard from '../ui/InputCard'
import Button from '../ui/Button'
import ProfileFormGuard from './ProfileFormGuard'
import { useToast } from '../ui/Toast'
import { getProfile, updateProfile } from '../../api/profile'
import { useI18n } from '../../i18n'
import { radius, spacing, font, typography } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { isOfflineError } from '../../lib/offlineGuard'
import { useSettingsFormDismiss } from './useSettingsFormDismiss'

interface Props {
  visible: boolean
  onClose: () => void
}

export default function PracticeInfoSheet({ visible, onClose }: Props) {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const toast = useToast()
  const queryClient = useQueryClient()

  const profileQuery = useQuery({
    queryKey: ['settings', 'profile'],
    queryFn: getProfile,
    enabled: visible,
    staleTime: 60_000,
  })

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const initialValues = useRef('')

  useEffect(() => {
    if (visible && profileQuery.data) {
      const nextName = profileQuery.data.practice_name ?? ''
      const nextAddress = profileQuery.data.address ?? ''
      setName(nextName)
      setAddress(nextAddress)
      setSubmitted(false)
      initialValues.current = JSON.stringify({
        name: nextName,
        address: nextAddress,
      })
    }
  }, [profileQuery.data, visible])

  const mutation = useMutation({
    mutationFn: () =>
      updateProfile({
        practice_name: name.trim() || null,
        address: address.trim() || null,
      }),
    onSuccess: () => {
      toast.success(t('settings.practiceSheet.saved'))
      queryClient.invalidateQueries({ queryKey: ['settings', 'profile'] })
      onClose()
    },
    onError: (err) => {
      if (isOfflineError(err)) return
      toast.error(t('settings.profileSheet.failed'))
    },
  })

  const normalizedName = name.trim()
  const normalizedAddress = address.trim()
  const nameInvalid =
    normalizedName.length > 0 && (normalizedName.length < 3 || normalizedName.length > 255)
  const addressInvalid =
    normalizedAddress.length > 0 &&
    (normalizedAddress.length < 3 || normalizedAddress.length > 255)

  const handleSubmit = () => {
    if (!profileQuery.data) return
    setSubmitted(true)
    if (nameInvalid || addressInvalid) {
      toast.error(t('settings.practiceSheet.fixErrors'))
      return
    }
    mutation.mutate()
  }

  const isDirty =
    visible &&
    Boolean(profileQuery.data) &&
    initialValues.current !== JSON.stringify({ name, address })
  const canDismiss = useSettingsFormDismiss({
    isDirty,
    isPending: mutation.isPending,
  })

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onBeforeClose={canDismiss}
      title={t('settings.rows.practiceInfo')}
      closeAccessibilityLabel={t('common.close')}
    >
      <ProfileFormGuard
        isLoading={profileQuery.isLoading}
        isError={profileQuery.isError && !profileQuery.data}
        onRetry={() => profileQuery.refetch()}
      >
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{t('settings.practiceSheet.nameLabel')}</Text>
        <InputCard
          iconName="business-outline"
          value={name}
          onChangeText={setName}
          placeholder={t('settings.practiceSheet.namePlaceholder')}
          maxLength={255}
          error={submitted && nameInvalid}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{t('settings.practiceSheet.addressLabel')}</Text>
        <View style={[styles.textareaWrap, submitted && addressInvalid && styles.inputError]}>
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder={t('settings.practiceSheet.addressPlaceholder')}
            accessibilityLabel={t('settings.practiceSheet.addressLabel')}
            placeholderTextColor={c.labelTertiary as string}
            style={styles.textarea}
            multiline
            numberOfLines={4}
            maxLength={255}
          />
        </View>
      </View>

      <Button
        title={t('settings.practiceSheet.save')}
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
    textareaWrap: {
      backgroundColor: c.fillQuaternary,
      borderRadius: radius.lg,
      paddingHorizontal: 14,
      paddingVertical: 12,
      minHeight: 96,
    },
    textarea: {
      ...typography.body,
      fontFamily: font('400'),
      color: c.label,
      textAlignVertical: 'top',
      minHeight: 72,
    },
    inputError: {
      borderWidth: 1.2,
      borderColor: c.danger,
    },
  })
}
