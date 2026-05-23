import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Switch } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'

import BottomSheet from '../ui/BottomSheet'
import Icon, { IconName } from '../ui/Icon'
import { useI18n } from '../../i18n'
import { useToast } from '../ui/Toast'
import {
  getNotificationPrefs,
  updateNotificationPrefs,
  NotificationPrefs,
} from '../../api/notifications'
import { ensureNotificationPermissions } from '../../lib/notifications'
import { radius, spacing, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

interface Props {
  visible: boolean
  onClose: () => void
}

interface ToggleRow {
  key: keyof NotificationPrefs
  iconName: IconName
  iconColor: string
  iconBg: string
  label: string
  hint: string
}

export default function NotificationsSheet({ visible, onClose }: Props) {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const toast = useToast()
  const queryClient = useQueryClient()

  const prefsQuery = useQuery({
    queryKey: ['settings', 'notifications'],
    queryFn: getNotificationPrefs,
    enabled: visible,
    staleTime: 60_000,
  })

  const prefs = prefsQuery.data

  // Optimistic update: flip the cached prefs immediately so the Switch
  // doesn't snap back during the mock API delay. If the server call
  // fails we roll back to the previous snapshot.
  const mutation = useMutation({
    mutationFn: (patch: Partial<NotificationPrefs>) => updateNotificationPrefs(patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: ['settings', 'notifications'] })
      const prev = queryClient.getQueryData<NotificationPrefs>(['settings', 'notifications'])
      if (prev) {
        queryClient.setQueryData<NotificationPrefs>(['settings', 'notifications'], {
          ...prev,
          ...patch,
        })
      }
      return { prev }
    },
    onError: (_err, _patch, context) => {
      if (context?.prev) {
        queryClient.setQueryData(['settings', 'notifications'], context.prev)
      }
      toast.error(t('common.retry'))
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['settings', 'notifications'], next)
    },
  })

  const toggle = (key: keyof NotificationPrefs) => {
    if (!prefs) return
    Haptics.selectionAsync()
    const next = !prefs[key]
    // When the user enables anything notification-related, prompt for OS
    // permission once. Silent failure keeps the toggle responsive even on
    // simulators / when the user declines — the pref still flips locally.
    if (next) {
      ensureNotificationPermissions().catch(() => {})
    }
    mutation.mutate({ [key]: next })
  }

  const masterOff = prefs ? !prefs.push_enabled : false

  const rows: ToggleRow[] = [
    {
      key: 'appointment_reminder',
      iconName: 'time-outline',
      iconColor: '#1D4ED8',
      iconBg: '#DBEAFE',
      label: t('settings.notificationsSheet.appointmentReminder'),
      hint: t('settings.notificationsSheet.appointmentReminderHint'),
    },
    {
      key: 'new_appointment',
      iconName: 'calendar-outline',
      iconColor: c.brand as string,
      iconBg: c.brandLight,
      label: t('settings.notificationsSheet.newAppointment'),
      hint: t('settings.notificationsSheet.newAppointmentHint'),
    },
    {
      key: 'payment_received',
      iconName: 'cash-outline',
      iconColor: '#16A34A',
      iconBg: '#DCFCE7',
      label: t('settings.notificationsSheet.paymentReceived'),
      hint: t('settings.notificationsSheet.paymentReceivedHint'),
    },
    {
      key: 'daily_summary',
      iconName: 'sunny-outline',
      iconColor: '#D97706',
      iconBg: '#FEF3C7',
      label: t('settings.notificationsSheet.dailySummary'),
      hint: t('settings.notificationsSheet.dailySummaryHint'),
    },
  ]

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('settings.notificationsSheet.title')}>
      {/* Master toggle */}
      <View style={styles.masterCard}>
        <View style={[styles.iconBubble, { backgroundColor: c.brand }]}>
          <Icon name="notifications" size={18} color="#FFFFFF" />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>{t('settings.notificationsSheet.master')}</Text>
          <Text style={styles.rowHint}>{t('settings.notificationsSheet.masterHint')}</Text>
        </View>
        <Switch
          value={prefs?.push_enabled ?? false}
          onValueChange={() => toggle('push_enabled')}
          trackColor={{ true: c.brand as string, false: c.systemGray4 }}
          ios_backgroundColor={c.systemGray4}
          thumbColor="#FFFFFF"
        />
      </View>

      {/* Sub toggles
          NOTE: we deliberately avoid wrapping the whole row in an opacity
          dimmer when masterOff is true. iOS Switch already renders its
          own disabled visual (subtle gray track, opaque white thumb);
          stacking parent opacity on top turns the thumb translucent and
          a gray "halo" appears around it. Instead, we dim the icon bubble
          + text only, and let the Switch component handle its own
          disabled appearance. */}
      <View style={styles.list} pointerEvents={masterOff ? 'none' : 'auto'}>
        {rows.map((row, idx) => (
          <React.Fragment key={row.key}>
            <View style={styles.row}>
              <View
                style={[
                  styles.iconBubble,
                  { backgroundColor: masterOff ? (c.fillTertiary as string) : row.iconBg },
                ]}
              >
                <Icon
                  name={row.iconName}
                  size={17}
                  color={masterOff ? (c.labelTertiary as string) : row.iconColor}
                />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, masterOff && styles.rowLabelDim]}>
                  {row.label}
                </Text>
                <Text style={[styles.rowHint, masterOff && styles.rowHintDim]}>
                  {row.hint}
                </Text>
              </View>
              <Switch
                value={!masterOff && (prefs?.[row.key] ?? false)}
                onValueChange={() => toggle(row.key)}
                trackColor={{ true: c.brand as string, false: c.systemGray5 }}
                ios_backgroundColor={c.systemGray5}
                thumbColor="#FFFFFF"
                disabled={masterOff}
              />
            </View>
            {idx < rows.length - 1 ? <View style={styles.separator} /> : null}
          </React.Fragment>
        ))}
      </View>
    </BottomSheet>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    masterCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      backgroundColor: c.brandLight,
      borderRadius: radius.xl,
    },
    list: {
      backgroundColor: c.background,
      borderRadius: radius.xl,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    iconBubble: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowText: { flex: 1, gap: 2 },
    rowLabel: {
      ...typography.bodyEmphasized,
      color: c.label,
    },
    // Dimmed variants used when master push is off — keeps the row
    // readable while signaling "not active" without dragging the Switch
    // thumb into translucent territory (see comment above the rows).
    rowLabelDim: {
      color: c.labelTertiary,
    },
    rowHint: {
      ...typography.footnote,
      color: c.labelSecondary,
    },
    rowHintDim: {
      color: c.labelTertiary,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.separator as string,
      marginLeft: 14 + 32 + 12,
    },
  })
}
