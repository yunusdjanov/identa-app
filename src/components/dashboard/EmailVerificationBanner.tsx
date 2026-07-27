import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'

import Icon from '../ui/Icon'
import { useToast } from '../ui/Toast'
import { useI18n } from '../../i18n'
import { useAuthStore } from '../../stores/auth'
import { resendEmailVerification } from '../../api/auth'
import { isOfflineError } from '../../lib/offlineGuard'
import { radius, spacing, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

// Shown on the dashboard when the signed-in user hasn't verified their email.
// Renders nothing once `email_verified_at` is set. Self-contained: reads the
// auth store and owns its own resend mutation so callers just drop it in.
export default function EmailVerificationBanner() {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const toast = useToast()
  const user = useAuthStore((s) => s.user)

  const mutation = useMutation({
    mutationFn: () => resendEmailVerification(),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      toast.success(t('emailVerify.sent'))
    },
    onError: (err) => {
      if (isOfflineError(err)) return
      toast.error(t('emailVerify.failed'))
    },
  })

  if (!user || user.email_verified_at) return null

  return (
    <View style={styles.banner}>
      <View style={styles.iconBubble}>
        <Icon name="mail-unread-outline" size={18} color={c.warning as string} />
      </View>
      <Text style={styles.message} numberOfLines={2}>
        {t('emailVerify.message')}
      </Text>
      <Pressable
        onPress={() => {
          if (mutation.isPending) return
          Haptics.selectionAsync()
          mutation.mutate()
        }}
        hitSlop={8}
        style={styles.action}
        accessibilityRole="button"
        accessibilityLabel={t('emailVerify.resend')}
        accessibilityState={{ disabled: mutation.isPending, busy: mutation.isPending }}
      >
        {mutation.isPending ? (
          <ActivityIndicator size="small" color={c.warning as string} />
        ) : (
          <Text style={styles.actionText}>{t('emailVerify.resend')}</Text>
        )}
      </Pressable>
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: spacing.xl,
      marginBottom: spacing.sm,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: radius.lg,
      backgroundColor: 'rgba(255,159,10,0.12)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.warning as string,
    },
    iconBubble: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,159,10,0.16)',
    },
    message: {
      flex: 1,
      ...typography.footnote,
      color: c.label,
    },
    action: {
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    actionText: {
      fontFamily: font('700'),
      fontSize: 13,
      fontWeight: '700',
      color: c.warning as string,
    },
  })
}
