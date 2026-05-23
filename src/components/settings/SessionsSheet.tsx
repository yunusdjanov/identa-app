import React, { useMemo } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'

import BottomSheet from '../ui/BottomSheet'
import Icon, { IconName } from '../ui/Icon'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import { useToast } from '../ui/Toast'
import { useI18n } from '../../i18n'
import type { TFunction } from '../../i18n/helpers'
import { listSessions, revokeSession } from '../../api/sessions'
import { getRelativeDateBucket, toIntlLocale } from '../../lib/format'
import type { Locale } from '../../constants'
import { font, radius, spacing, typography } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { isOfflineError } from '../../lib/offlineGuard'
import type { ApiSession } from '../../types'

interface Props {
  visible: boolean
  onClose: () => void
}

const PLATFORM_ICON: Record<ApiSession['platform'], IconName> = {
  ios: 'logo-apple',
  android: 'logo-android',
  web: 'globe-outline',
}

export default function SessionsSheet({ visible, onClose }: Props) {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const toast = useToast()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['sessions', 'activity'],
    queryFn: listSessions,
    enabled: visible,
    staleTime: 30_000,
  })

  const sessions = query.data ?? []

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeSession(id),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      toast.success(t('settings.sessionsSheet.revoked'))
      queryClient.invalidateQueries({ queryKey: ['sessions', 'activity'] })
    },
    onError: (err) => {
      if (isOfflineError(err)) return
      toast.error(t('settings.sessionsSheet.revokeFailed'))
    },
  })

  const onRevoke = (session: ApiSession) => {
    Alert.alert(
      t('settings.sessionsSheet.revokeConfirm'),
      t('settings.sessionsSheet.revokeConfirmSub'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.sessionsSheet.revoke'),
          style: 'destructive',
          onPress: () => revokeMutation.mutate(session.id),
        },
      ]
    )
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('settings.sessionsSheet.title')}
    >
      <Text style={styles.subtitle}>{t('settings.sessionsSheet.subtitle')}</Text>

      {query.isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={c.brand as string} />
        </View>
      ) : sessions.length === 0 ? (
        <EmptyState
          iconName="shield-checkmark-outline"
          title={t('settings.sessionsSheet.subtitle')}
          tone="neutral"
        />
      ) : (
        <View style={styles.list}>
          {sessions.map((s, idx) => (
            <React.Fragment key={s.id}>
              <SessionRow
                c={c}
                styles={styles}
                session={s}
                locale={locale as Locale}
                relative={formatRelative(s.last_active_at, locale as Locale, t)}
                ipLabel={t('settings.sessionsSheet.ipLabel')}
                currentBadge={t('settings.sessionsSheet.currentBadge')}
                revokeLabel={t('settings.sessionsSheet.revoke')}
                onRevoke={() => onRevoke(s)}
                disabled={revokeMutation.isPending}
              />
              {idx < sessions.length - 1 ? <View style={styles.separator} /> : null}
            </React.Fragment>
          ))}
        </View>
      )}
    </BottomSheet>
  )
}

function SessionRow({
  c,
  styles,
  session,
  relative,
  ipLabel,
  currentBadge,
  revokeLabel,
  onRevoke,
  disabled,
}: {
  c: Colors
  styles: ReturnType<typeof makeStyles>
  session: ApiSession
  locale: Locale
  relative: string
  ipLabel: string
  currentBadge: string
  revokeLabel: string
  onRevoke: () => void
  disabled: boolean
}) {
  const iconName = PLATFORM_ICON[session.platform]
  return (
    <View style={styles.row}>
      <View style={[styles.iconBubble, session.is_current && styles.iconBubbleCurrent]}>
        <Icon
          name={iconName}
          size={20}
          color={session.is_current ? '#FFFFFF' : (c.labelSecondary as string)}
        />
      </View>

      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.deviceName} numberOfLines={1}>
            {session.device_name}
          </Text>
          {session.is_current ? (
            <View style={styles.currentBadge}>
              <Text style={styles.currentBadgeText}>{currentBadge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {[session.city, session.country].filter(Boolean).join(', ') || '—'}
        </Text>
        <Text style={styles.metaSubtle} numberOfLines={1}>
          {ipLabel}: {session.ip_address} · {relative}
        </Text>

        {!session.is_current ? (
          <Button
            title={revokeLabel}
            variant="plain"
            size="sm"
            onPress={onRevoke}
            disabled={disabled}
            textStyle={styles.revokeBtnText}
            style={styles.revokeBtn}
          />
        ) : null}
      </View>
    </View>
  )
}

function formatRelative(
  iso: string,
  locale: Locale,
  t: TFunction
): string {
  const date = new Date(iso)
  const bucket = getRelativeDateBucket(date)
  switch (bucket.bucket) {
    case 'today':
      return new Intl.DateTimeFormat(toIntlLocale(locale), {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date)
    case 'yesterday':
      return t('patients.time.yesterday')
    case 'daysAgo':
      return t('patients.time.daysAgo', { n: bucket.value })
    case 'weeksAgo':
      return t('patients.time.weeksAgo', { n: bucket.value })
    case 'monthsAgo':
      return t('patients.time.monthsAgo', { n: bucket.value })
    case 'yearsAgo':
      return t('patients.time.yearsAgo', { n: bucket.value })
  }
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    subtitle: {
      ...typography.subhead,
      color: c.labelSecondary,
      marginTop: -spacing.xs,
      marginBottom: spacing.xs,
      paddingHorizontal: 4,
    },
    loader: {
      paddingVertical: spacing.xl,
      alignItems: 'center',
    },
    list: {
      backgroundColor: c.background,
      borderRadius: radius.xl,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 14,
    },
    iconBubble: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: c.fillQuaternary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    iconBubbleCurrent: {
      backgroundColor: c.brand,
    },
    info: {
      flex: 1,
      gap: 2,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    deviceName: {
      flex: 1,
      ...typography.bodyEmphasized,
      color: c.label,
    },
    currentBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: c.brandLight,
    },
    currentBadgeText: {
      fontFamily: font('800'),
      fontSize: 9,
      fontWeight: '800',
      color: c.brand,
      letterSpacing: 0.6,
    },
    meta: {
      ...typography.footnote,
      color: c.labelSecondary,
    },
    metaSubtle: {
      ...typography.caption1,
      color: c.labelTertiary,
      marginTop: 2,
    },
    revokeBtn: {
      alignSelf: 'flex-start',
      marginTop: spacing.xs,
      paddingHorizontal: 0,
    },
    revokeBtnText: {
      color: c.danger,
      fontSize: 13,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.separator as string,
      marginLeft: 14 + 40 + 12,
    },
  })
}
