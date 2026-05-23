import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, TextInput } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import BottomSheet from '../ui/BottomSheet'
import InputCard from '../ui/InputCard'
import Button from '../ui/Button'
import { useToast } from '../ui/Toast'
import { getProfile, updateProfile } from '../../api/profile'
import { useI18n } from '../../i18n'
import { radius, spacing, font, typography } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { isOfflineError } from '../../lib/offlineGuard'

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

  useEffect(() => {
    if (profileQuery.data) {
      setName(profileQuery.data.practice_name ?? '')
      setAddress(profileQuery.data.address ?? '')
    }
  }, [profileQuery.data])

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

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('settings.rows.practiceInfo')}>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{t('settings.practiceSheet.nameLabel')}</Text>
        <InputCard
          iconName="business-outline"
          value={name}
          onChangeText={setName}
          placeholder={t('settings.practiceSheet.namePlaceholder')}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{t('settings.practiceSheet.addressLabel')}</Text>
        <View style={styles.textareaWrap}>
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder={t('settings.practiceSheet.addressPlaceholder')}
            placeholderTextColor={c.labelTertiary as string}
            style={styles.textarea}
            multiline
            numberOfLines={4}
            maxLength={1000}
          />
        </View>
      </View>

      <Button
        title={t('settings.practiceSheet.save')}
        onPress={() => mutation.mutate()}
        loading={mutation.isPending}
        fullWidth
        size="lg"
        style={{ marginTop: spacing.xs }}
      />
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
  })
}
