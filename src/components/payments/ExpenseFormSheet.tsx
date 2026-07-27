import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'

import BottomSheet from '../ui/BottomSheet'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import InputCard from '../ui/InputCard'
import MonthCalendarPicker from '../ui/MonthCalendarPicker'
import SegmentedControl from '../ui/SegmentedControl'
import { useToast } from '../ui/Toast'
import { useDialog } from '../ui/Dialog'
import { useI18n } from '../../i18n'
import {
  createPaymentExpenseIdempotencyKey,
  createPaymentExpense,
  updatePaymentExpense,
  type MoneyCurrency,
  type PaymentExpense,
} from '../../api/payments'
import { isOfflineError } from '../../lib/offlineGuard'
import {
  fromLocalDateKey,
  toIntlLocale,
  toLocalDateKey,
} from '../../lib/format'
import {
  formatExpenseAmountInput,
  formatExpenseQuantityInput,
  parseDecimalInput,
  parseExpenseAmountInput,
} from '../../lib/paymentInput'
import type { Locale } from '../../constants'
import { font, inputMetrics, radius, spacing } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

interface Props {
  visible: boolean
  expense: PaymentExpense | null
  onClose: () => void
  onSaved?: () => void
}

const MAX_EXPENSE_AMOUNT = 99_999_999.99
const MAX_EXPENSE_QUANTITY = 999_999.99
const MAX_EXPENSE_TITLE_LENGTH = 160

export default function ExpenseFormSheet({ visible, expense, onClose, onSaved }: Props) {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const toast = useToast()
  const { confirm } = useDialog()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [currency, setCurrency] = useState<MoneyCurrency>('UZS')
  const [date, setDate] = useState(toLocalDateKey())
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const initialValues = useRef('')
  const createIdempotencyKey = useRef('')

  useEffect(() => {
    if (!visible) {
      setCalendarOpen(false)
      return
    }
    const nextTitle = expense?.title ?? ''
    const nextCurrency = expense?.currency ?? 'UZS'
    const nextAmount = expense
      ? formatExpenseAmountInput(String(expense.amount), nextCurrency)
      : ''
    const nextQuantity = expense
      ? formatExpenseQuantityInput(String(expense.quantity))
      : '1'
    const nextDate = expense?.expense_date ?? toLocalDateKey()
    setTitle(nextTitle)
    setAmount(nextAmount)
    setQuantity(nextQuantity)
    setCurrency(nextCurrency)
    setDate(nextDate)
    setSubmitted(false)
    createIdempotencyKey.current = expense
      ? ''
      : createPaymentExpenseIdempotencyKey()
    initialValues.current = JSON.stringify({
      title: nextTitle,
      amount: nextAmount,
      quantity: nextQuantity,
      currency: nextCurrency,
      date: nextDate,
    })
  }, [visible, expense])

  const parsedAmount = parseExpenseAmountInput(amount, currency)
  const parsedQuantity = parseDecimalInput(quantity)
  const valid =
    title.trim().length >= 2 &&
    title.trim().length <= MAX_EXPENSE_TITLE_LENGTH &&
    Number.isFinite(parsedAmount) &&
    parsedAmount >= 0.01 &&
    parsedAmount <= MAX_EXPENSE_AMOUNT &&
    Number.isFinite(parsedQuantity) &&
    parsedQuantity >= 0.01 &&
    parsedQuantity <= MAX_EXPENSE_QUANTITY &&
    Boolean(date)

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        title: title.trim(),
        amount: parsedAmount,
        quantity: parsedQuantity,
        currency,
        expense_date: date,
      }
      return expense
        ? updatePaymentExpense(expense.id, payload)
        : createPaymentExpense(payload, createIdempotencyKey.current)
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      toast.success(t(expense ? 'payments.expenses.updated' : 'payments.expenses.created'))
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      onSaved?.()
      onClose()
    },
    onError: (error) => {
      if (isOfflineError(error)) return
      toast.error(t('payments.expenses.saveFailed'))
    },
  })

  const isDirty =
    visible &&
    initialValues.current !==
      JSON.stringify({ title, amount, quantity, currency, date })

  const canClose = async (): Promise<boolean> => {
    if (mutation.isPending) return false
    if (
      isDirty &&
      !(await confirm({
        title: t('payments.expenses.unsavedTitle'),
        message: t('payments.expenses.unsavedMessage'),
        confirmLabel: t('payments.expenses.discard'),
        destructive: true,
      }))
    ) {
      return false
    }
    return true
  }

  const submit = () => {
    setSubmitted(true)
    if (!valid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      return
    }
    mutation.mutate()
  }

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={onClose}
        onBeforeClose={canClose}
        title={t(expense ? 'payments.expenses.editTitle' : 'payments.expenses.addTitle')}
        closeAccessibilityLabel={t('common.close')}
      >
        <View style={styles.form} testID="expense-form">
          <View style={styles.field} testID="expense-date-field">
            <FieldLabel>{t('payments.expenses.date')}</FieldLabel>
            <Pressable
              onPress={() => {
                void Haptics.selectionAsync()
                setCalendarOpen(true)
              }}
              style={({ pressed }) => [
                styles.dateCard,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${t('payments.expenses.date')}: ${formatExpenseDate(
                date,
                locale
              )}`}
            >
              <View style={styles.dateIcon}>
                <Icon name="calendar-outline" size={18} color={c.brand as string} />
              </View>
              <Text style={styles.dateText} numberOfLines={1}>
                {formatExpenseDate(date, locale)}
              </Text>
              <Icon name="chevron-forward" size={17} color={c.labelTertiary as string} />
            </Pressable>
          </View>

          <View style={styles.field}>
            <FieldLabel>{t('payments.expenses.title')}</FieldLabel>
            <InputCard
              iconName="receipt-outline"
              value={title}
              onChangeText={setTitle}
              placeholder={t('payments.expenses.titlePlaceholder')}
              maxLength={MAX_EXPENSE_TITLE_LENGTH}
              autoCapitalize="sentences"
              accessibilityLabel={t('payments.expenses.title')}
              containerStyle={styles.compactInputCard}
              style={styles.compactInput}
              error={
                submitted &&
                (title.trim().length < 2 ||
                  title.trim().length > MAX_EXPENSE_TITLE_LENGTH)
              }
            />
          </View>

          <View style={styles.moneyRow}>
            <View style={[styles.field, styles.amountField]}>
              <View style={styles.amountHeader} testID="expense-amount-header">
                <FieldLabel>{t('payments.expenses.amount')}</FieldLabel>
                <View
                  style={styles.currencyControl}
                  testID="expense-currency-control"
                  accessibilityLabel={t('payments.expenses.currencyLabel')}
                >
                  <SegmentedControl<MoneyCurrency>
                    options={[
                      { value: 'UZS', label: 'UZS' },
                      { value: 'USD', label: 'USD' },
                    ]}
                    value={currency}
                    onChange={(nextCurrency) => {
                      setCurrency(nextCurrency)
                      setAmount((current) =>
                        formatExpenseAmountInput(current, nextCurrency)
                      )
                    }}
                  />
                </View>
              </View>
              <InputCard
                iconName="cash-outline"
                value={amount}
                onChangeText={(value) =>
                  setAmount(formatExpenseAmountInput(value, currency))
                }
                placeholder="0"
                keyboardType="decimal-pad"
                accessibilityLabel={t('payments.expenses.amount')}
                containerStyle={styles.compactInputCard}
                style={styles.compactInput}
                error={
                  submitted &&
                  (!Number.isFinite(parsedAmount) ||
                    parsedAmount < 0.01 ||
                    parsedAmount > MAX_EXPENSE_AMOUNT)
                }
              />
            </View>

            <View style={[styles.field, styles.quantityField]}>
              <View style={styles.quantityHeader}>
                <FieldLabel>{t('payments.expenses.quantity')}</FieldLabel>
              </View>
              <InputCard
                value={quantity}
                onChangeText={(value) =>
                  setQuantity(formatExpenseQuantityInput(value))
                }
                placeholder="1"
                keyboardType="decimal-pad"
                accessibilityLabel={t('payments.expenses.quantity')}
                containerStyle={[
                  styles.compactInputCard,
                  styles.quantityInputCard,
                ]}
                style={[styles.compactInput, styles.quantityInput]}
                error={
                  submitted &&
                  (!Number.isFinite(parsedQuantity) ||
                    parsedQuantity < 0.01 ||
                    parsedQuantity > MAX_EXPENSE_QUANTITY)
                }
              />
            </View>
          </View>
        </View>

        <Button
          title={t(expense ? 'payments.expenses.update' : 'payments.expenses.add')}
          onPress={submit}
          loading={mutation.isPending}
          fullWidth
          size="lg"
        />
      </BottomSheet>

      <MonthCalendarPicker
        visible={calendarOpen}
        value={date}
        minDate={null}
        maxDate={null}
        title={t('payments.expenses.date')}
        onClose={() => setCalendarOpen(false)}
        onConfirm={(value) => {
          setDate(value)
          setCalendarOpen(false)
        }}
      />
    </>
  )
}

function formatExpenseDate(value: string, locale: Locale): string {
  const parsed = fromLocalDateKey(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parsed)
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  const c = useColors()
  return <Text style={[stylesBase.label, { color: c.labelSecondary }]}>{children}</Text>
}

const stylesBase = StyleSheet.create({
  label: {
    fontFamily: font('700'),
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 4,
  },
})

function makeStyles(c: Colors) {
  return StyleSheet.create({
    form: {
      gap: spacing.md,
    },
    field: {
      gap: 6,
    },
    compactInputCard: {
      minHeight: inputMetrics.height,
      paddingHorizontal: inputMetrics.paddingHorizontal,
      borderRadius: radius.lg,
    },
    compactInput: {
      fontSize: inputMetrics.fontSize,
      lineHeight: inputMetrics.lineHeight,
      paddingVertical: 10,
    },
    dateCard: {
      minHeight: inputMetrics.height,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: inputMetrics.paddingHorizontal,
      borderRadius: radius.lg,
      borderWidth: 1.2,
      borderColor: c.separator,
      backgroundColor: c.background,
    },
    dateIcon: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dateText: {
      flex: 1,
      fontFamily: font('500'),
      fontSize: inputMetrics.fontSize,
      fontWeight: '500',
      lineHeight: inputMetrics.lineHeight,
      color: c.label,
    },
    moneyRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
    },
    amountField: {
      flex: 1,
      minWidth: 0,
    },
    amountHeader: {
      minHeight: 30,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
    },
    currencyControl: {
      width: 100,
    },
    quantityField: {
      width: 94,
    },
    quantityHeader: {
      minHeight: 30,
      justifyContent: 'center',
    },
    quantityInputCard: {
      paddingHorizontal: 10,
    },
    quantityInput: {
      textAlign: 'center',
    },
    pressed: { opacity: 0.65 },
  })
}
