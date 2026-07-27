import React, { useMemo } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import { useI18n } from '../../i18n'
import { spacing, typography } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

interface Props {
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  children: React.ReactNode
}

/** Prevents profile-backed forms from displaying and saving empty defaults. */
export default function ProfileFormGuard({ isLoading, isError, onRetry, children }: Props) {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])

  if (isLoading) {
    return (
      <View style={styles.loading} accessibilityLiveRegion="polite">
        <ActivityIndicator color={c.brand as string} />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (isError) {
    return (
      <EmptyState
        iconName="cloud-offline-outline"
        title={t('settings.profileSheet.loadFailed')}
        tone="danger"
        action={
          <Button
            title={t('common.retry')}
            variant="secondary"
            size="md"
            onPress={onRetry}
          />
        }
      />
    )
  }

  return <>{children}</>
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    loading: {
      minHeight: 160,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    loadingText: {
      ...typography.subhead,
      color: c.labelSecondary,
    },
  })
}
