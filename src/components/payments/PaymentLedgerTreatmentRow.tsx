import React, { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import Icon from '../ui/Icon'
import { useI18n } from '../../i18n'
import {
  formatCurrencyParts,
  fromLocalDateKey,
  toIntlLocale,
} from '../../lib/format'
import type { Locale } from '../../constants'
import { font, radius, spacing } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import type { PaymentLedgerEntry } from '../../api/payments'

interface Props {
  treatment: PaymentLedgerEntry
}

export default function PaymentLedgerTreatmentRow({ treatment }: Props) {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const currency = treatment.currency
  const isAdvance = treatment.balance_delta < 0

  const metrics = [
    {
      key: 'work',
      label: t('payments.patientLedger.workPrice'),
      amount: formatCurrencyParts(treatment.debt, locale, currency),
      color: '#C7464D',
    },
    {
      key: 'paid',
      label: t('payments.patientLedger.paid'),
      amount: formatCurrencyParts(treatment.paid, locale, currency),
      color: '#16805A',
    },
    {
      key: isAdvance ? 'advance' : 'debt',
      label: t(
        isAdvance
          ? 'payments.patient.advance'
          : 'payments.patientLedger.debt'
      ),
      amount: formatCurrencyParts(
        Math.abs(treatment.balance_delta),
        locale,
        currency
      ),
      color: isAdvance
        ? '#16805A'
        : treatment.balance_delta > 0
        ? '#A65F00'
        : c.labelSecondary,
    },
  ]

  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={[
        formatLedgerDate(treatment.date, locale),
        treatment.work_done,
        ...metrics.map(
          ({ label, amount }) => `${label}: ${amount.value} ${amount.unit}`
        ),
      ].join(', ')}
    >
      <View style={styles.heading}>
        <Text style={styles.title} numberOfLines={2}>
          {treatment.work_done}
        </Text>
        <View style={styles.date}>
          <Icon
            name="calendar-clear-outline"
            size={12}
            color={c.labelSecondary as string}
          />
          <Text style={styles.dateText} numberOfLines={1}>
            {formatLedgerDate(treatment.date, locale)}
          </Text>
        </View>
      </View>

      <View style={styles.metrics}>
        {metrics.map(({ key, label, amount, color }, index) => (
          <React.Fragment key={key}>
            <View style={styles.metric} testID={`ledger-metric-${key}`}>
              <Text style={styles.metricLabel} numberOfLines={1}>
                {label}
              </Text>
              <Text
                style={[styles.metricValue, { color: color as string }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.66}
              >
                {amount.value}
                <Text style={styles.metricUnit}> {amount.unit}</Text>
              </Text>
            </View>
            {index < metrics.length - 1 ? (
              <View style={styles.metricDivider} />
            ) : null}
          </React.Fragment>
        ))}
      </View>
    </View>
  )
}

function formatLedgerDate(value: string, locale: Locale): string {
  const parsed = fromLocalDateKey(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed)
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    card: {
      gap: 10,
      padding: spacing.md,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.separator,
      backgroundColor: c.background,
    },
    heading: {
      minHeight: 22,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    title: {
      flex: 1,
      minWidth: 0,
      fontFamily: font('700'),
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '700',
      color: c.label,
    },
    date: {
      flexShrink: 0,
      minHeight: 24,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 7,
      borderRadius: radius.sm,
      backgroundColor: c.fillQuaternary,
    },
    dateText: {
      fontFamily: font('600'),
      fontSize: 10.5,
      lineHeight: 13,
      fontWeight: '600',
      color: c.labelSecondary,
    },
    metrics: {
      height: 44,
      flexDirection: 'row',
      alignItems: 'stretch',
      overflow: 'hidden',
      borderRadius: radius.md,
      backgroundColor: c.fillQuaternary,
    },
    metric: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
      gap: 2,
      paddingHorizontal: 7,
      paddingVertical: 5,
    },
    metricLabel: {
      fontFamily: font('600'),
      fontSize: 9,
      lineHeight: 11,
      fontWeight: '600',
      color: c.labelTertiary,
    },
    metricValue: {
      fontFamily: font('700'),
      fontSize: 11.5,
      lineHeight: 14,
      fontWeight: '700',
      letterSpacing: -0.15,
    },
    metricUnit: {
      fontFamily: font('500'),
      fontSize: 8,
      fontWeight: '500',
      color: c.labelSecondary,
      letterSpacing: 0,
    },
    metricDivider: {
      width: StyleSheet.hairlineWidth,
      marginVertical: 7,
      backgroundColor: c.separator,
    },
  })
}
