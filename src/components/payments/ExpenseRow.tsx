import React, { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import Icon from '../ui/Icon'
import { useI18n } from '../../i18n'
import { formatCurrencyParts, formatDayMonth, fromLocalDateKey } from '../../lib/format'
import { font, spacing, typography } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import type { PaymentExpense } from '../../api/payments'

interface Props {
  expense: PaymentExpense
  canManage: boolean
  onEdit: () => void
  onDelete: () => void
}

export default function ExpenseRow({ expense, canManage, onEdit, onDelete }: Props) {
  const { locale, t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const amount = formatCurrencyParts(expense.amount, locale, expense.currency)

  return (
    <View style={styles.row}>
      <View style={styles.icon}>
        <Icon name="receipt-outline" size={18} color={c.danger as string} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {expense.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {formatDayMonth(fromLocalDateKey(expense.expense_date), locale)}
          {' \u00B7 '}
          {t('payments.expenses.quantityShort', { n: expense.quantity })}
        </Text>
      </View>
      <Text
        style={styles.amount}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {amount.value} <Text style={styles.unit}>{amount.unit}</Text>
      </Text>
      {canManage ? (
        <View style={styles.actions}>
          <Pressable
            onPress={onEdit}
            hitSlop={6}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('common.edit')}
          >
            <Icon name="create-outline" size={16} color={c.brand as string} />
          </Pressable>
          <Pressable
            onPress={onDelete}
            hitSlop={6}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('common.delete')}
          >
            <Icon name="trash-outline" size={16} color={c.danger as string} />
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    row: {
      minHeight: 66,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
      paddingVertical: 7,
    },
    icon: {
      width: 36,
      height: 36,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFF2F1',
    },
    body: { flex: 1, minWidth: 0, gap: 2 },
    title: { ...typography.subheadBold, color: c.label },
    meta: { ...typography.caption1, color: c.labelSecondary },
    amount: {
      maxWidth: 100,
      fontFamily: font('800'),
      fontSize: 14,
      fontWeight: '800',
      color: c.danger,
    },
    unit: { fontFamily: font('600'), fontSize: 9.5, fontWeight: '600' },
    actions: { flexDirection: 'row', gap: 2 },
    action: {
      width: 32,
      height: 32,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.fillQuaternary,
    },
    pressed: { opacity: 0.6 },
  })
}
