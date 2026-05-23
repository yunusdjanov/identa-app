import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'

import BottomSheet from '../ui/BottomSheet'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import { useToast } from '../ui/Toast'
import { useI18n } from '../../i18n'
import type { TFunction } from '../../i18n/helpers'
import { useAuthStore } from '../../stores/auth'
import { radius, spacing, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import type { ApiSubscriptionSummary } from '../../types'

interface Props {
  visible: boolean
  onClose: () => void
}

export default function BillingSheet({ visible, onClose }: Props) {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const toast = useToast()
  const user = useAuthStore((s) => s.user)
  const sub = user?.subscription

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('settings.billingSheet.title')}>
      <PlanCard sub={sub} t={t} locale={locale} />

      <View style={styles.detailsCard}>
        <DetailRow
          label={t('settings.billingSheet.plan')}
          value={getPlanLabel(sub?.plan, t)}
        />
        <Separator />
        <DetailRow
          label={t('settings.billingSheet.status')}
          value={getStatusLabel(sub?.status, t)}
        />
        {sub?.trial_ends_at && sub.status === 'trialing' ? (
          <>
            <Separator />
            <DetailRow
              label={t('settings.billingSheet.trialEnds')}
              value={formatDate(sub.trial_ends_at, locale)}
            />
          </>
        ) : null}
        {sub?.ends_at && (sub.status === 'active' || sub.status === 'grace') ? (
          <>
            <Separator />
            <DetailRow
              label={t('settings.billingSheet.renewsOn')}
              value={formatDate(sub.ends_at, locale)}
            />
          </>
        ) : null}
        {sub ? (
          <>
            <Separator />
            <DetailRow
              label={t('settings.billingSheet.staff')}
              value={
                sub.staff_limit === null
                  ? t('settings.billingSheet.unlimited')
                  : t('settings.billingSheet.staffUsage', {
                      used: sub.active_staff_count,
                      limit: sub.staff_limit,
                    })
              }
            />
          </>
        ) : null}
      </View>

      <Button
        title={t('settings.billingSheet.upgradeCta')}
        variant="primary"
        size="lg"
        fullWidth
        leftIcon={<Icon name="rocket-outline" size={18} color="#FFFFFF" />}
        onPress={() => toast.info(t('settings.comingSoon'))}
      />
      <Text style={styles.upgradeHint}>{t('settings.billingSheet.upgradeHint')}</Text>
    </BottomSheet>
  )
}

function PlanCard({
  sub,
  t,
  locale,
}: {
  sub: ApiSubscriptionSummary | null | undefined
  t: TFunction
  locale: string
}) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  let tone: { bg: string; fg: string; iconName: 'star' | 'time' | 'lock-closed' | 'warning' } = {
    bg: c.brandLight,
    fg: c.brandDeep as string,
    iconName: 'star',
  }
  let title = t('settings.billingSheet.plans.none')
  let subtitle = t('settings.billingSheet.statuses.none')

  if (sub) {
    title = getPlanLabel(sub.plan, t)
    if (sub.status === 'trialing' && sub.days_remaining != null) {
      // `common.days` may not exist in every locale dictionary; t() returns
      // the path back when missing, so we manually fall back to "days".
      const daysKey = t('common.days')
      const daysWord = daysKey === 'common.days' ? 'days' : daysKey
      subtitle = `${sub.days_remaining} ${daysWord} · ${t('settings.billingSheet.statuses.trialing')}`
      tone = { bg: c.brandLight, fg: c.brandDeep as string, iconName: 'time' }
    } else if (sub.status === 'active') {
      subtitle = t('settings.billingSheet.statuses.active')
      tone = { bg: '#DCFCE7', fg: '#15803D', iconName: 'star' }
    } else if (sub.status === 'read_only') {
      subtitle = t('settings.billingSheet.statuses.read_only')
      tone = { bg: '#FEF3C7', fg: '#92400E', iconName: 'lock-closed' }
    } else if (sub.status === 'canceled' || sub.status === 'grace') {
      subtitle = t(`settings.billingSheet.statuses.${sub.status}`)
      tone = { bg: '#FEE2E2', fg: c.danger as string, iconName: 'warning' }
    }
  }

  return (
    <View style={[styles.planCard, { backgroundColor: tone.bg }]}>
      <View style={[styles.planIcon, { backgroundColor: tone.fg }]}>
        <Icon name={tone.iconName} size={20} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.planTitle, { color: tone.fg }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.planSubtitle, { color: tone.fg }]} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </View>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>{value}</Text>
    </View>
  )
}

function Separator() {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  return <View style={styles.separator} />
}

function getPlanLabel(plan: string | null | undefined, t: (k: string) => string): string {
  switch (plan) {
    case 'trial':
      return t('settings.billingSheet.plans.trial')
    case 'basic':
      return t('settings.billingSheet.plans.basic')
    case 'pro':
      return t('settings.billingSheet.plans.pro')
    case 'monthly':
      return t('settings.billingSheet.plans.monthly')
    case 'yearly':
      return t('settings.billingSheet.plans.yearly')
    default:
      return t('settings.billingSheet.plans.none')
  }
}

function getStatusLabel(
  status: string | null | undefined,
  t: (k: string) => string
): string {
  switch (status) {
    case 'trialing':
      return t('settings.billingSheet.statuses.trialing')
    case 'active':
      return t('settings.billingSheet.statuses.active')
    case 'grace':
      return t('settings.billingSheet.statuses.grace')
    case 'read_only':
      return t('settings.billingSheet.statuses.read_only')
    case 'canceled':
      return t('settings.billingSheet.statuses.canceled')
    default:
      return t('settings.billingSheet.statuses.none')
  }
}

function formatDate(iso: string, locale: string): string {
  const intl = locale === 'uz' ? 'uz-UZ' : locale === 'ru' ? 'ru-RU' : 'en-US'
  return new Intl.DateTimeFormat(intl, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso))
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    planCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 16,
      borderRadius: radius.xl,
    },
    planIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    planTitle: {
      fontFamily: font('800'),
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    planSubtitle: {
      ...typography.subhead,
      fontFamily: font('600'),
      fontWeight: '600',
      marginTop: 2,
      opacity: 0.85,
    },
    detailsCard: {
      backgroundColor: c.background,
      borderRadius: radius.xl,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 14,
      gap: 12,
    },
    detailLabel: {
      ...typography.body,
      color: c.labelSecondary,
    },
    detailValue: {
      ...typography.bodyEmphasized,
      color: c.label,
      textAlign: 'right',
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.separator as string,
      marginLeft: 14,
    },
    upgradeHint: {
      ...typography.footnote,
      color: c.labelTertiary,
      textAlign: 'center',
      marginTop: -spacing.sm,
    },
  })
}
