import React, { useMemo, useState, useEffect } from 'react'
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'

import BottomSheet from '../ui/BottomSheet'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import PatientAvatar from '../ui/PatientAvatar'
import { useToast } from '../ui/Toast'

import { useI18n } from '../../i18n'
import type { TFunction } from '../../i18n/helpers'
import { useAuthStore } from '../../stores/auth'
import { canManage } from '../../lib/permissions'
import { recordPayment } from '../../api/treatments'
import { formatCurrencyParts, formatDayMonth, fromLocalDateKey, toIntlLocale } from '../../lib/format'
import type { Locale } from '../../constants'
import { radius, spacing, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { isOfflineError } from '../../lib/offlineGuard'
import { isApiError } from '../../api/client'
import type { ApiTreatment, ApiTreatmentPayment, PaymentMethod } from '../../types'

interface Props {
  visible: boolean
  treatment: ApiTreatment | null
  onClose: () => void
  onUpdated?: (updated: ApiTreatment) => void
}

export default function TreatmentDetailSheet({ visible, treatment, onClose, onUpdated }: Props) {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const toast = useToast()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const canManagePayments = canManage(user, 'payments')

  const [recordMode, setRecordMode] = useState(false)
  const [amountText, setAmountText] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) {
      setRecordMode(false)
      setAmountText('')
      setMethod('cash')
      setNote('')
      setError(null)
    }
  }, [visible])

  const mutation = useMutation({
    mutationFn: (input: { amount: number; method: PaymentMethod; note: string }) =>
      recordPayment({
        patient_id: treatment!.patient_id,
        treatment_id: treatment!.id,
        amount: input.amount,
        payment_method: input.method,
        payment_date: todayDateKey(),
        // Use the treatment type as the invoice line description so
        // reports surface meaningful labels instead of "Manual payment".
        description: treatment!.treatment_type,
        notes: input.note.trim() || undefined,
      }),
    onSuccess: (updated) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      toast.success(t('payments.treatment.recorded'))
      queryClient.invalidateQueries({ queryKey: ['treatments'] })
      queryClient.invalidateQueries({ queryKey: ['patients', 'overview'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      onUpdated?.(updated)
      setRecordMode(false)
      setAmountText('')
      setMethod('cash')
      setNote('')
    },
    onError: (err) => {
      if (isOfflineError(err)) return
      // Surface a more useful message when the backend rejects with
      // validation errors (amount > balance, invalid method, missing
      // fields). For 404 we hint at the deployment status — this endpoint
      // is the "quick-payments" route added in #40 and is only available
      // on backend deploys newer than 2026-05-23.
      if (isApiError(err)) {
        if (err.kind === 'not_found') {
          toast.error(t('payments.treatment.endpointMissing'))
          return
        }
        if (err.kind === 'validation' && err.fieldErrors) {
          const firstField = Object.keys(err.fieldErrors)[0]
          const firstMessage = firstField ? err.fieldErrors[firstField]?.[0] : null
          if (firstMessage) {
            toast.error(firstMessage)
            return
          }
        }
      }
      toast.error(t('payments.treatment.recordFailed'))
    },
  })

  if (!treatment) return null

  const balance = treatment.balance ?? treatment.debt_amount - treatment.paid_amount
  const debtParts = formatCurrencyParts(treatment.debt_amount, locale)
  const paidParts = formatCurrencyParts(treatment.paid_amount, locale)
  const balanceParts = formatCurrencyParts(balance, locale)
  const date = fromLocalDateKey(treatment.treatment_date)

  const handleSubmitPayment = () => {
    const amount = parseAmount(amountText)
    if (amount === null || amount <= 0) {
      setError(t('payments.treatment.invalidAmount'))
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      return
    }
    if (amount > balance) {
      setError(t('payments.treatment.exceedsBalance'))
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      return
    }
    setError(null)
    mutation.mutate({ amount, method, note })
  }

  const teethLabel =
    treatment.teeth && treatment.teeth.length > 0
      ? treatment.teeth.map((n) => `#${n}`).join(', ')
      : '—'

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('payments.treatment.title')}>
      {/* Patient hero */}
      <View style={styles.hero}>
        <PatientAvatar name={treatment.patient_name ?? '—'} size={48} />
        <View style={{ flex: 1 }}>
          <Text style={styles.patientName} numberOfLines={1}>
            {treatment.patient_name ?? '—'}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {treatment.treatment_type}
          </Text>
        </View>
      </View>

      {/* Info rows */}
      <View style={styles.infoCard}>
        <InfoRow label={t('payments.treatment.date')} value={formatDayMonth(date, locale)} />
        <Separator />
        <InfoRow label={t('payments.treatment.teeth')} value={teethLabel} />
        <Separator />
        <InfoRow label={t('payments.treatment.work')} value={treatment.treatment_type} />
      </View>

      {/* Money summary */}
      <View style={styles.moneyCard}>
        <MoneyRow
          label={t('payments.treatment.debt')}
          value={`${debtParts.value} ${debtParts.unit}`}
          color={c.label}
        />
        <Separator />
        <MoneyRow
          label={t('payments.treatment.paid')}
          value={`${paidParts.value} ${paidParts.unit}`}
          color={c.success}
        />
        <Separator />
        <MoneyRow
          label={t('payments.treatment.balance')}
          value={`${balanceParts.value} ${balanceParts.unit}`}
          color={balance > 0 ? (c.danger as string) : (c.success as string)}
          emphasize
        />
      </View>

      {/* Payment history */}
      <PaymentHistorySection
        payments={treatment.payments ?? []}
        balance={balance}
        locale={locale as Locale}
        t={t}
      />

      {/* Record payment */}
      {canManagePayments && balance > 0 ? (
        recordMode ? (
          <View style={styles.recordCard}>
            <Text style={styles.fieldLabel}>
              {t('payments.treatment.recordPaymentLabel')}
            </Text>
            <View style={styles.amountWrap}>
              <Icon name="cash-outline" size={20} color={c.brand as string} />
              <TextInput
                value={amountText}
                onChangeText={(v) => {
                  setAmountText(v.replace(/[^\d]/g, ''))
                  setError(null)
                }}
                placeholder="0"
                placeholderTextColor={c.labelTertiary as string}
                keyboardType="numeric"
                style={styles.amountInput}
                // 10 digits covers up to 9_999_999_999 — far beyond any
                // realistic dental treatment fee in the local market.
                // Prevents accidental long-press / paste creating
                // garbage totals that would surface as 422s downstream.
                maxLength={10}
                autoFocus
              />
              <Text style={styles.amountUnit}>{balanceParts.unit}</Text>
            </View>

            <Text style={[styles.fieldLabel, { marginTop: spacing.xs }]}>
              {t('payments.treatment.methodLabel')}
            </Text>
            <View style={styles.methodRow}>
              <MethodChip
                label={t('payments.treatment.methodCash')}
                icon="cash-outline"
                active={method === 'cash'}
                onPress={() => {
                  Haptics.selectionAsync()
                  setMethod('cash')
                }}
              />
              <MethodChip
                label={t('payments.treatment.methodCard')}
                icon="card-outline"
                active={method === 'card'}
                onPress={() => {
                  Haptics.selectionAsync()
                  setMethod('card')
                }}
              />
              <MethodChip
                label={t('payments.treatment.methodBankTransfer')}
                icon="swap-horizontal-outline"
                active={method === 'bank_transfer'}
                onPress={() => {
                  Haptics.selectionAsync()
                  setMethod('bank_transfer')
                }}
              />
            </View>

            <Text style={[styles.fieldLabel, { marginTop: spacing.xs }]}>
              {t('payments.treatment.noteLabel')}
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={t('payments.treatment.notePlaceholder')}
              placeholderTextColor={c.labelTertiary as string}
              style={styles.noteInput}
              multiline
              maxLength={500}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.recordActions}>
              <Button
                title={t('payments.treatment.cancel')}
                variant="secondary"
                size="md"
                fullWidth
                onPress={() => {
                  setRecordMode(false)
                  setAmountText('')
                  setMethod('cash')
                  setNote('')
                  setError(null)
                }}
                style={{ flex: 1 }}
              />
              <Button
                title={
                  mutation.isPending
                    ? t('payments.treatment.recordSubmitting')
                    : t('payments.treatment.recordSubmit')
                }
                size="md"
                fullWidth
                loading={mutation.isPending}
                disabled={!amountText.trim()}
                onPress={handleSubmitPayment}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        ) : (
          <Button
            title={t('payments.treatment.recordPayment')}
            size="lg"
            fullWidth
            leftIcon={<Icon name="add-circle-outline" size={18} color="#FFFFFF" />}
            onPress={() => {
              Haptics.selectionAsync()
              setRecordMode(true)
            }}
          />
        )
      ) : null}
    </BottomSheet>
  )
}

function PaymentHistorySection({
  payments,
  balance,
  locale,
  t,
}: {
  payments: ApiTreatmentPayment[]
  balance: number
  locale: Locale
  t: TFunction
}) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  // Newest first
  const sorted = [...payments].sort((a, b) =>
    b.recorded_at.localeCompare(a.recorded_at)
  )

  return (
    <View style={styles.historyWrap}>
      <View style={styles.historyHeader}>
        <Text style={styles.historyTitle}>{t('payments.treatment.history')}</Text>
        {sorted.length > 0 && balance === 0 ? (
          <View style={styles.paidPill}>
            <Icon name="checkmark" size={11} color="#FFFFFF" />
            <Text style={styles.paidPillText}>{t('payments.treatment.paidInFull')}</Text>
          </View>
        ) : null}
      </View>

      {sorted.length === 0 ? (
        <View style={styles.historyEmpty}>
          <Icon name="receipt-outline" size={22} color={c.labelTertiary as string} />
          <Text style={styles.historyEmptyText}>
            {t('payments.treatment.historyEmpty')}
          </Text>
        </View>
      ) : (
        <View style={styles.historyList}>
          {sorted.map((p, i) => {
            const amountParts = formatCurrencyParts(p.amount, locale)
            return (
              <React.Fragment key={p.id}>
                <View style={styles.historyRow}>
                  <View style={styles.historyIconBubble}>
                    <Icon name="checkmark" size={14} color={c.success as string} />
                  </View>
                  <View style={styles.historyTextWrap}>
                    <Text style={styles.historyDate}>
                      {formatPaymentDate(p.recorded_at, locale)}
                    </Text>
                    <Text style={styles.historyTime}>
                      {formatPaymentTime(p.recorded_at, locale)}
                    </Text>
                  </View>
                  <Text style={styles.historyAmount} numberOfLines={1}>
                    +{amountParts.value}
                    <Text style={styles.historyUnit}> {amountParts.unit}</Text>
                  </Text>
                </View>
                {i < sorted.length - 1 ? <View style={styles.historySep} /> : null}
              </React.Fragment>
            )
          })}
        </View>
      )}
    </View>
  )
}

function formatPaymentDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

function formatPaymentTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

function MoneyRow({
  label,
  value,
  color,
  emphasize,
}: {
  label: string
  value: string
  color: string
  emphasize?: boolean
}) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  return (
    <View style={styles.moneyRow}>
      <Text style={styles.moneyLabel}>{label}</Text>
      <Text
        style={[styles.moneyValue, { color }, emphasize && styles.moneyValueEmphasized]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  )
}

function Separator() {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  return <View style={styles.separator} />
}

function parseAmount(value: string): number | null {
  const cleaned = value.replace(/[^\d]/g, '')
  if (!cleaned) return null
  const num = parseInt(cleaned, 10)
  return Number.isFinite(num) ? num : null
}

// Local date in YYYY-MM-DD format. Backend's payment_date column is a
// pure date (no time), so we send the user's local day, not UTC. A
// dentist in Tashkent recording cash at 23:50 should see today's date,
// not tomorrow's.
function todayDateKey(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function MethodChip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string
  icon: 'cash-outline' | 'card-outline' | 'swap-horizontal-outline'
  active: boolean
  onPress: () => void
}) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  return (
    <Pressable
      onPress={onPress}
      style={[styles.methodChip, active && styles.methodChipActive]}
      hitSlop={4}
    >
      <Icon
        name={icon}
        size={16}
        color={(active ? '#FFFFFF' : c.label) as string}
      />
      <Text
        style={[
          styles.methodChipLabel,
          active && styles.methodChipLabelActive,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 4,
    },
    patientName: {
      ...typography.title3,
      color: c.brandDeep,
    },
    subtitle: {
      ...typography.subhead,
      color: c.labelSecondary,
    },
    infoCard: {
      backgroundColor: c.background,
      borderRadius: radius.xl,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 12,
    },
    infoLabel: {
      ...typography.subhead,
      color: c.labelSecondary,
      flex: 1,
    },
    infoValue: {
      ...typography.bodyEmphasized,
      color: c.label,
      textAlign: 'right',
      flex: 1,
      flexWrap: 'wrap',
    },
    moneyCard: {
      backgroundColor: c.fillQuaternary,
      borderRadius: radius.xl,
      overflow: 'hidden',
    },
    moneyRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 12,
    },
    moneyLabel: {
      ...typography.subhead,
      color: c.labelSecondary,
    },
    moneyValue: {
      fontFamily: font('700'),
      fontSize: 15,
      fontWeight: '700',
    },
    moneyValueEmphasized: {
      fontFamily: font('800'),
      fontSize: 17,
      fontWeight: '800',
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.separator as string,
      marginLeft: 14,
    },
    historyWrap: {
      gap: 8,
    },
    historyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    historyTitle: {
      fontFamily: font('700'),
      fontSize: 11,
      fontWeight: '700',
      color: c.labelSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    paidPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
      backgroundColor: c.success,
    },
    paidPillText: {
      fontFamily: font('700'),
      fontSize: 10,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    },
    historyEmpty: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 14,
      backgroundColor: c.fillQuaternary,
      borderRadius: radius.xl,
    },
    historyEmptyText: {
      ...typography.subhead,
      color: c.labelTertiary,
    },
    historyList: {
      backgroundColor: c.background,
      borderRadius: radius.xl,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    historyIconBubble: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: '#DCFCE7',
      alignItems: 'center',
      justifyContent: 'center',
    },
    historyTextWrap: { flex: 1, gap: 2 },
    historyDate: {
      fontFamily: font('600'),
      fontSize: 14,
      fontWeight: '600',
      color: c.label,
      textTransform: 'capitalize',
    },
    historyTime: {
      ...typography.caption1,
      color: c.labelTertiary,
    },
    historyAmount: {
      fontFamily: font('700'),
      fontSize: 15,
      fontWeight: '700',
      color: c.success,
    },
    historyUnit: {
      fontFamily: font('600'),
      fontSize: 12,
      fontWeight: '600',
      color: c.labelSecondary,
    },
    historySep: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.separator as string,
      marginLeft: 14 + 28 + 12,
    },
    recordCard: {
      backgroundColor: c.brandLight,
      borderRadius: radius.xl,
      padding: 14,
      gap: 8,
    },
    fieldLabel: {
      fontFamily: font('700'),
      fontSize: 11,
      fontWeight: '700',
      color: c.labelSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginLeft: 4,
    },
    amountWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: c.background,
      borderRadius: radius.lg,
    },
    amountInput: {
      flex: 1,
      fontFamily: font('700'),
      fontSize: 20,
      fontWeight: '700',
      color: c.label,
      paddingVertical: 0,
    },
    amountUnit: {
      fontFamily: font('600'),
      fontSize: 13,
      fontWeight: '600',
      color: c.labelSecondary,
    },
    errorText: {
      fontFamily: font('600'),
      fontSize: 12,
      fontWeight: '600',
      color: c.danger,
      marginLeft: 4,
    },
    recordActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    methodRow: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    methodChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 8,
      backgroundColor: c.background,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.separator as string,
    },
    methodChipActive: {
      backgroundColor: c.brand as string,
      borderColor: c.brand as string,
    },
    methodChipLabel: {
      fontFamily: font('600'),
      fontSize: 13,
      fontWeight: '600',
      color: c.label,
    },
    methodChipLabelActive: {
      color: '#FFFFFF',
    },
    noteInput: {
      minHeight: 56,
      maxHeight: 120,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: c.background,
      borderRadius: radius.lg,
      fontFamily: font('500'),
      fontSize: 14,
      fontWeight: '500',
      color: c.label,
      textAlignVertical: 'top',
    },
  })
}
