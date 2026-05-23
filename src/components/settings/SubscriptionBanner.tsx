import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Icon from '../ui/Icon'
import { radius, font } from '../../constants/theme'
import { useColors } from '../../lib/useColors'
import { useI18n } from '../../i18n'
import type { ApiSubscriptionSummary } from '../../types'

interface Props {
  subscription?: ApiSubscriptionSummary | null
}

// Compact banner under the profile card. Shows trial countdown when on
// the trial plan, or status note for active / read-only / expired.
export default function SubscriptionBanner({ subscription }: Props) {
  const { t } = useI18n()
  const c = useColors()
  if (!subscription) return null

  const { status, days_remaining } = subscription

  let label: string
  let iconName: 'time-outline' | 'checkmark-circle' | 'alert-circle' | 'eye-outline' = 'time-outline'
  let bg: string = c.brandLight
  let fg: string = c.brandDeep

  if (status === 'trialing' && days_remaining != null) {
    label = t('settings.subscription.trial', { days: days_remaining })
    iconName = 'time-outline'
  } else if (status === 'active') {
    label = t('settings.subscription.active')
    iconName = 'checkmark-circle'
    bg = '#E8F8EE'
    fg = '#15803D'
  } else if (status === 'read_only') {
    label = t('settings.subscription.readOnly')
    iconName = 'eye-outline'
    bg = '#FEF3C7'
    fg = '#92400E'
  } else if (status === 'canceled' || status === 'grace') {
    label = t('settings.subscription.expired')
    iconName = 'alert-circle'
    bg = '#FEE2E2'
    fg = c.danger as string
  } else {
    return null
  }

  return (
    <View style={[styles.wrap, { backgroundColor: bg }]}>
      <Icon name={iconName} size={18} color={fg} />
      <Text style={[styles.text, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.lg,
    marginHorizontal: 16,
  },
  text: {
    flex: 1,
    fontFamily: font('600'),
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
})
