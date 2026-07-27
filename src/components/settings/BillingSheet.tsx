import React, { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import BottomSheet from '../ui/BottomSheet'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import { useDialog } from '../ui/Dialog'
import { useToast } from '../ui/Toast'
import { useI18n } from '../../i18n'
import type { TFunction } from '../../i18n/helpers'
import { useAuthStore } from '../../stores/auth'
import {
  cancelBillingSubscription,
  createBillingCheckout,
  getCurrentSubscription,
  listBillingPayments,
  listBillingPlans,
  scheduleBillingDowngrade,
  type BillingPayment,
  type BillingPlan,
} from '../../api/billing'
import { radius, spacing, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import type { ApiSubscriptionSummary } from '../../types'

interface Props {
  visible: boolean
  onClose: () => void
}

type BillingPeriod = 'monthly' | 'yearly'

export function isSecureCheckoutUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password
  } catch {
    return false
  }
}

export default function BillingSheet({ visible, onClose }: Props) {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const toast = useToast()
  const { confirm } = useDialog()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const [period, setPeriod] = useState<BillingPeriod>('monthly')

  const subscriptionQuery = useQuery({
    queryKey: ['billing', 'current-subscription'],
    queryFn: getCurrentSubscription,
    enabled: visible && user?.role === 'dentist',
    staleTime: 60_000,
  })
  const plansQuery = useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: listBillingPlans,
    enabled: visible && user?.role === 'dentist',
    staleTime: 5 * 60_000,
  })
  const paymentsQuery = useQuery({
    queryKey: ['billing', 'payments'],
    queryFn: ({ signal }) => listBillingPayments(signal),
    enabled: visible && user?.role === 'dentist',
    staleTime: 30_000,
  })

  const sub = subscriptionQuery.data !== undefined
    ? subscriptionQuery.data
    : user?.subscription
  const plans = plansQuery.data ?? []
  const payments = paymentsQuery.data ?? []

  const syncSubscription = (next: ApiSubscriptionSummary | null) => {
    queryClient.setQueryData(['billing', 'current-subscription'], next)
    const currentUser = useAuthStore.getState().user
    if (currentUser) setUser({ ...currentUser, subscription: next })
  }

  const checkoutMutation = useMutation({
    mutationFn: createBillingCheckout,
    onSuccess: async (checkout) => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'payments'] })
      if (!isSecureCheckoutUrl(checkout.checkout_url)) {
        toast.error(t('settings.billingSheet.checkoutOpenFailed'))
        return
      }
      try {
        await Linking.openURL(checkout.checkout_url)
      } catch {
        toast.error(t('settings.billingSheet.checkoutOpenFailed'))
      }
    },
    onError: () => toast.error(t('settings.billingSheet.actionFailed')),
  })

  const downgradeMutation = useMutation({
    mutationFn: scheduleBillingDowngrade,
    onSuccess: (next) => {
      syncSubscription(next)
      toast.success(t('settings.billingSheet.downgradeScheduled'))
    },
    onError: () => toast.error(t('settings.billingSheet.actionFailed')),
  })

  const cancelMutation = useMutation({
    mutationFn: cancelBillingSubscription,
    onSuccess: (next) => {
      syncSubscription(next)
      toast.success(t('settings.billingSheet.cancelScheduled'))
    },
    onError: () => toast.error(t('settings.billingSheet.actionFailed')),
  })

  const pendingAction =
    checkoutMutation.isPending ||
    downgradeMutation.isPending ||
    cancelMutation.isPending
  const pendingPlanCode = checkoutMutation.variables?.plan_code ?? downgradeMutation.variables?.plan_code

  const choosePlan = async (plan: BillingPlan) => {
    if (pendingAction) return
    if (sub && sub.active_staff_count > plan.staff_limit) {
      toast.warning(t('settings.billingSheet.staffLimitBlocked', { limit: plan.staff_limit }))
      return
    }

    const isDowngrade = sub?.plan === 'pro'
      && sub.status === 'active'
      && plan.code === 'basic'
    const planName = getPlanLabel(plan.code, t)
    const periodName = getPeriodLabel(period, t)
    const confirmed = await confirm({
      title: isDowngrade
        ? t('settings.billingSheet.confirmDowngradeTitle')
        : t('settings.billingSheet.confirmCheckoutTitle'),
      message: isDowngrade
        ? t('settings.billingSheet.confirmDowngradeBody', { plan: planName, period: periodName })
        : t('settings.billingSheet.confirmCheckoutBody', {
            plan: planName,
            period: periodName,
            price: formatMoney(getPlanPrice(plan, period), plan.currency, locale),
          }),
      confirmLabel: isDowngrade
        ? t('settings.billingSheet.scheduleDowngrade')
        : t('settings.billingSheet.continueToPayment'),
    })
    if (!confirmed) return

    if (isDowngrade) {
      downgradeMutation.mutate({ plan_code: 'basic', billing_period: period })
      return
    }
    if (plan.code === 'basic' || plan.code === 'pro') {
      checkoutMutation.mutate({ plan_code: plan.code, billing_period: period })
    }
  }

  const requestCancellation = async () => {
    if (pendingAction) return
    const confirmed = await confirm({
      title: t('settings.billingSheet.confirmCancelTitle'),
      message: t('settings.billingSheet.confirmCancelBody', {
        date: sub?.ends_at ? formatDate(sub.ends_at, locale) : '-',
      }),
      confirmLabel: t('settings.billingSheet.cancelAtPeriodEnd'),
      destructive: true,
    })
    if (confirmed) cancelMutation.mutate()
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onBeforeClose={() => !pendingAction}
      title={t('settings.billingSheet.title')}
      closeAccessibilityLabel={t('common.close')}
    >
      <PlanCard sub={sub} t={t} locale={locale} />

      <View style={styles.detailsCard}>
        <DetailRow label={t('settings.billingSheet.plan')} value={getPlanLabel(sub?.plan, t)} />
        <Separator />
        <DetailRow label={t('settings.billingSheet.status')} value={getStatusLabel(sub?.status, t)} />
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
              label={sub.cancel_at_period_end
                ? t('settings.billingSheet.accessUntil')
                : t('settings.billingSheet.periodEnds')}
              value={formatDate(sub.ends_at, locale)}
            />
          </>
        ) : null}
        {sub ? (
          <>
            <Separator />
            <DetailRow
              label={t('settings.billingSheet.staff')}
              value={sub.staff_limit === null
                ? t('settings.billingSheet.unlimited')
                : t('settings.billingSheet.staffUsage', {
                    used: sub.active_staff_count,
                    limit: sub.staff_limit,
                  })}
            />
          </>
        ) : null}
        {sub?.pending_plan_code ? (
          <>
            <Separator />
            <DetailRow
              label={t('settings.billingSheet.pendingChange')}
              value={`${getPlanLabel(sub.pending_plan_code, t)} / ${getPeriodLabel(sub.pending_billing_period ?? period, t)}`}
            />
          </>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.billingSheet.choosePlan')}</Text>
        <View style={styles.segmented} accessibilityRole="tablist">
          {(['monthly', 'yearly'] as BillingPeriod[]).map((value) => {
            const selected = period === value
            return (
              <Pressable
                key={value}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setPeriod(value)}
                style={[styles.segment, selected && styles.segmentSelected]}
              >
                <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                  {getPeriodLabel(value, t)}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {plansQuery.isLoading ? (
          <ActivityIndicator color={c.brand as string} />
        ) : plansQuery.isError ? (
          <View style={styles.inlineState}>
            <Text style={styles.inlineStateText}>{t('settings.billingSheet.loadFailed')}</Text>
            <Button
              title={t('common.retry')}
              variant="tinted"
              size="sm"
              onPress={() => plansQuery.refetch()}
            />
          </View>
        ) : plans.length === 0 ? (
          <Text style={styles.emptyText}>{t('settings.billingSheet.noPlans')}</Text>
        ) : (
          <View style={styles.planList}>
            {plans.map((plan) => {
              const disabledForStaff = Boolean(sub && sub.active_staff_count > plan.staff_limit)
              return (
                <PlanOption
                  key={plan.id}
                  plan={plan}
                  period={period}
                  sub={sub}
                  disabledForStaff={disabledForStaff}
                  pending={pendingAction && pendingPlanCode === plan.code}
                  actionsDisabled={pendingAction}
                  onPress={() => choosePlan(plan)}
                  t={t}
                  locale={locale}
                />
              )
            })}
          </View>
        )}
      </View>

      {sub?.status === 'active' && sub.plan !== 'trial' ? (
        sub.cancel_at_period_end ? (
          <View style={styles.noticeRow}>
            <Icon name="information-circle-outline" size={18} color={c.warning as string} />
            <Text style={styles.noticeText}>{t('settings.billingSheet.cancelAlreadyScheduled')}</Text>
          </View>
        ) : (
          <Button
            title={t('settings.billingSheet.cancelAtPeriodEnd')}
            variant="plain"
            size="md"
            fullWidth
            loading={cancelMutation.isPending}
            onPress={requestCancellation}
          />
        )
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.billingSheet.paymentHistory')}</Text>
        {paymentsQuery.isLoading ? (
          <ActivityIndicator color={c.brand as string} />
        ) : paymentsQuery.isError ? (
          <View style={styles.inlineState}>
            <Text style={styles.inlineStateText}>{t('settings.billingSheet.loadFailed')}</Text>
            <Button
              title={t('common.retry')}
              variant="tinted"
              size="sm"
              onPress={() => paymentsQuery.refetch()}
            />
          </View>
        ) : payments.length === 0 ? (
          <Text style={styles.emptyText}>{t('settings.billingSheet.noPayments')}</Text>
        ) : (
          <View style={styles.paymentList}>
            {payments.map((payment) => (
              <PaymentRow key={payment.id} payment={payment} locale={locale} t={t} />
            ))}
          </View>
        )}
      </View>
    </BottomSheet>
  )
}

function PlanOption({
  plan,
  period,
  sub,
  disabledForStaff,
  pending,
  actionsDisabled,
  onPress,
  t,
  locale,
}: {
  plan: BillingPlan
  period: BillingPeriod
  sub: ApiSubscriptionSummary | null | undefined
  disabledForStaff: boolean
  pending: boolean
  actionsDisabled: boolean
  onPress: () => void
  t: TFunction
  locale: string
}) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const isCurrent = sub?.plan === plan.code && sub.billing_period === period && sub.status === 'active'
  const isDowngrade = sub?.plan === 'pro' && sub.status === 'active' && plan.code === 'basic'
  const isPendingChange = sub?.pending_plan_code === plan.code && sub.pending_billing_period === period
  const actionLabel = isPendingChange
    ? t('settings.billingSheet.changeScheduled')
    : isDowngrade
      ? t('settings.billingSheet.scheduleDowngrade')
      : isCurrent
        ? t('settings.billingSheet.renewPlan')
        : t('settings.billingSheet.selectPlan')

  return (
    <View style={[styles.planOption, isCurrent && styles.planOptionCurrent]}>
      <View style={styles.planOptionHeader}>
        <View style={{ flex: 1 }}>
          <View style={styles.planNameRow}>
            <Text style={styles.planOptionName}>{getPlanLabel(plan.code, t)}</Text>
            {isCurrent ? (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>{t('settings.billingSheet.current')}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.planDescription} numberOfLines={2}>{plan.description ?? ''}</Text>
        </View>
        <Text style={styles.planPrice}>
          {formatMoney(getPlanPrice(plan, period), plan.currency, locale)}
        </Text>
      </View>
      <View style={styles.planMetaRow}>
        <Text style={styles.planMeta}>{t('settings.billingSheet.staffLimit', { limit: plan.staff_limit })}</Text>
        <Text style={styles.planMeta}>{t('settings.billingSheet.imageLimit', { limit: plan.entry_image_limit })}</Text>
      </View>
      {disabledForStaff ? (
        <Text style={styles.limitWarning}>
          {t('settings.billingSheet.staffLimitBlocked', { limit: plan.staff_limit })}
        </Text>
      ) : null}
      <Button
        title={actionLabel}
        variant={isCurrent ? 'secondary' : 'primary'}
        size="md"
        fullWidth
        disabled={disabledForStaff || isPendingChange || actionsDisabled}
        loading={pending && !isPendingChange}
        onPress={onPress}
      />
    </View>
  )
}

function PaymentRow({ payment, locale, t }: { payment: BillingPayment; locale: string; t: TFunction }) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const statusColor = getPaymentStatusColor(payment.status, c)
  const date = payment.paid_at ?? payment.created_at

  return (
    <View style={styles.paymentRow}>
      <View style={[styles.paymentIcon, { backgroundColor: `${statusColor}18` }]}>
        <Icon name="receipt-outline" size={18} color={statusColor} />
      </View>
      <View style={styles.paymentMain}>
        <Text style={styles.paymentTitle} numberOfLines={1}>
          {getPlanLabel(payment.plan_code, t)} / {getPeriodLabel(payment.billing_period, t)}
        </Text>
        <Text style={styles.paymentDate}>{date ? formatDate(date, locale) : '-'}</Text>
      </View>
      <View style={styles.paymentAmountWrap}>
        <Text style={styles.paymentAmount}>{formatMoney(payment.amount, payment.currency, locale)}</Text>
        <Text style={[styles.paymentStatus, { color: statusColor }]}>
          {t(`settings.billingSheet.paymentStatuses.${payment.status}`)}
        </Text>
      </View>
    </View>
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
    bg: c.brandLight as string,
    fg: c.brandDeep as string,
    iconName: 'star',
  }
  let title = t('settings.billingSheet.plans.none')
  let subtitle = t('settings.billingSheet.statuses.none')

  if (sub) {
    title = getPlanLabel(sub.plan, t)
    if (sub.status === 'trialing' && sub.days_remaining != null) {
      subtitle = t('settings.billingSheet.daysRemaining', { days: sub.days_remaining })
      tone = { bg: c.brandLight as string, fg: c.brandDeep as string, iconName: 'time' }
    } else if (sub.status === 'active') {
      subtitle = sub.cancel_at_period_end
        ? t('settings.billingSheet.cancelAlreadyScheduled')
        : t('settings.billingSheet.statuses.active')
      tone = { bg: '#DCFCE7', fg: '#15803D', iconName: 'star' }
    } else if (sub.status === 'read_only') {
      subtitle = t('settings.billingSheet.statuses.read_only')
      tone = { bg: '#FEF3C7', fg: '#92400E', iconName: 'lock-closed' }
    } else if (sub.status === 'canceled' || sub.status === 'grace') {
      subtitle = t(`settings.billingSheet.statuses.${sub.status}`)
      tone = { bg: '#FEE2E2', fg: c.danger as string, iconName: 'warning' }
    }
    if (sub.ends_at && sub.status === 'grace') {
      subtitle = `${subtitle} / ${formatDate(sub.ends_at, locale)}`
    }
  }

  return (
    <View style={[styles.planCard, { backgroundColor: tone.bg }]}>
      <View style={[styles.planIcon, { backgroundColor: tone.fg }]}>
        <Icon name={tone.iconName} size={20} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.planTitle, { color: tone.fg }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.planSubtitle, { color: tone.fg }]} numberOfLines={2}>{subtitle}</Text>
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
      <Text style={styles.detailValue} numberOfLines={2}>{value}</Text>
    </View>
  )
}

function Separator() {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  return <View style={styles.separator} />
}

function getPlanPrice(plan: BillingPlan, period: BillingPeriod): number {
  return Number(period === 'yearly' ? plan.yearly_price : plan.monthly_price) || 0
}

function getPlanLabel(plan: string | null | undefined, t: TFunction): string {
  switch (plan) {
    case 'trial': return t('settings.billingSheet.plans.trial')
    case 'basic': return t('settings.billingSheet.plans.basic')
    case 'pro': return t('settings.billingSheet.plans.pro')
    case 'monthly': return t('settings.billingSheet.plans.monthly')
    case 'yearly': return t('settings.billingSheet.plans.yearly')
    default: return t('settings.billingSheet.plans.none')
  }
}

function getStatusLabel(status: string | null | undefined, t: TFunction): string {
  switch (status) {
    case 'trialing': return t('settings.billingSheet.statuses.trialing')
    case 'active': return t('settings.billingSheet.statuses.active')
    case 'grace': return t('settings.billingSheet.statuses.grace')
    case 'read_only': return t('settings.billingSheet.statuses.read_only')
    case 'canceled': return t('settings.billingSheet.statuses.canceled')
    default: return t('settings.billingSheet.statuses.none')
  }
}

function getPeriodLabel(period: BillingPeriod, t: TFunction): string {
  return period === 'yearly'
    ? t('settings.billingSheet.plans.yearly')
    : t('settings.billingSheet.plans.monthly')
}

function getPaymentStatusColor(status: BillingPayment['status'], c: Colors): string {
  switch (status) {
    case 'paid': return c.success as string
    case 'pending': return c.systemBlue as string
    case 'refunded': return c.warning as string
    case 'failed': return c.danger as string
    default: return c.systemGray as string
  }
}

function formatMoney(amount: number, currency: string, locale: string): string {
  const intl = locale === 'uz' ? 'uz-UZ' : locale === 'ru' ? 'ru-RU' : 'en-US'
  try {
    return new Intl.NumberFormat(intl, {
      style: 'currency',
      currency: currency || 'UZS',
      maximumFractionDigits: currency === 'USD' ? 2 : 0,
    }).format(Number.isFinite(amount) ? amount : 0)
  } catch {
    return `${Number.isFinite(amount) ? amount.toLocaleString(intl) : '0'} ${currency}`
  }
}

function formatDate(iso: string, locale: string): string {
  const intl = locale === 'uz' ? 'uz-UZ' : locale === 'ru' ? 'ru-RU' : 'en-US'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat(intl, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    planCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 16,
      borderRadius: radius.sm,
    },
    planIcon: {
      width: 44,
      height: 44,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    planTitle: {
      fontFamily: font('800'),
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: 0,
    },
    planSubtitle: {
      ...typography.subhead,
      fontFamily: font('600'),
      fontWeight: '600',
      marginTop: 2,
      opacity: 0.85,
    },
    detailsCard: {
      backgroundColor: c.backgroundSecondary,
      borderRadius: radius.sm,
      overflow: 'hidden',
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 13,
      paddingHorizontal: 14,
      gap: 12,
    },
    detailLabel: {
      ...typography.body,
      color: c.labelSecondary,
      flexShrink: 0,
    },
    detailValue: {
      ...typography.bodyEmphasized,
      color: c.label,
      textAlign: 'right',
      flex: 1,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.separator as string,
      marginLeft: 14,
    },
    section: { gap: spacing.md },
    sectionTitle: {
      ...typography.headline,
      color: c.label,
    },
    segmented: {
      flexDirection: 'row',
      padding: 3,
      borderRadius: radius.sm,
      backgroundColor: c.fillTertiary,
    },
    segment: {
      flex: 1,
      minHeight: 38,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.xs,
      paddingHorizontal: 8,
    },
    segmentSelected: { backgroundColor: c.background },
    segmentText: { ...typography.subheadBold, color: c.labelSecondary },
    segmentTextSelected: { color: c.label },
    planList: { gap: spacing.md },
    planOption: {
      gap: 12,
      borderWidth: 1,
      borderColor: c.separator,
      borderRadius: radius.sm,
      padding: 14,
      backgroundColor: c.background,
    },
    planOptionCurrent: { borderColor: c.brand },
    planOptionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    planNameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
    planOptionName: { ...typography.headline, color: c.label },
    planDescription: { ...typography.footnote, color: c.labelSecondary, marginTop: 3 },
    planPrice: { ...typography.headline, color: c.label, textAlign: 'right' },
    currentBadge: {
      borderRadius: radius.pill,
      backgroundColor: c.brandLight,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    currentBadgeText: { ...typography.caption2, color: c.brandDeep, fontFamily: font('700') },
    planMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    planMeta: { ...typography.caption1, color: c.labelSecondary },
    limitWarning: { ...typography.footnote, color: c.warning },
    inlineState: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
    inlineStateText: { ...typography.body, color: c.labelSecondary, textAlign: 'center' },
    noticeRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 9,
      padding: 12,
      borderRadius: radius.sm,
      backgroundColor: c.backgroundSecondary,
    },
    noticeText: { ...typography.footnote, color: c.labelSecondary, flex: 1 },
    paymentList: {
      borderWidth: 1,
      borderColor: c.separator,
      borderRadius: radius.sm,
      overflow: 'hidden',
    },
    paymentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 66,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
      backgroundColor: c.background,
    },
    paymentIcon: {
      width: 34,
      height: 34,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    paymentMain: { flex: 1, minWidth: 0 },
    paymentTitle: { ...typography.subheadBold, color: c.label },
    paymentDate: { ...typography.caption1, color: c.labelSecondary, marginTop: 2 },
    paymentAmountWrap: { alignItems: 'flex-end', maxWidth: '42%' },
    paymentAmount: { ...typography.subheadBold, color: c.label, textAlign: 'right' },
    paymentStatus: { ...typography.caption2, marginTop: 2, textAlign: 'right' },
    emptyText: { ...typography.body, color: c.labelSecondary, textAlign: 'center', paddingVertical: spacing.md },
  })
}
