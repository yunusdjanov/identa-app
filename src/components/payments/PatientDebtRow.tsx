import React, { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import * as Haptics from 'expo-haptics'

import Icon from '../ui/Icon'
import PatientAvatar from '../ui/PatientAvatar'
import { radius, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { useI18n } from '../../i18n'
import { formatCurrencyParts } from '../../lib/format'
import { formatStoredPhone } from '../../lib/phoneFormat'
import type { MoneyCurrency, MoneyLedgerAmount } from '../../api/payments'

export interface PatientDebtData {
  patientId: string
  patientName: string
  patientPhone?: string
  patientPhotoUri?: string
  totalDebt: number
  totalPaid: number
  balance: number
  entryCount: number
  balancesByCurrency: Record<MoneyCurrency, MoneyLedgerAmount>
}

interface Props {
  data: PatientDebtData
  onPress?: () => void
}

export default function PatientDebtRow({ data, onPress }: Props) {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const formattedPhone = formatStoredPhone(data.patientPhone)
  const moneyLines = (['UZS', 'USD'] as const)
    .map((currency) => ({ currency, values: data.balancesByCurrency[currency] }))
    .filter(
      ({ currency, values }) =>
        currency === 'UZS' ||
        values.balance !== 0 ||
        values.total_paid !== 0 ||
        values.total_debt !== 0
    )
    .map(({ currency, values }) => {
      const amount = formatCurrencyParts(Math.abs(values.balance), locale, currency)
      const status =
        values.balance > 0
          ? 'debt'
          : values.balance < 0
            ? 'advance'
            : 'settled'
      const color =
        status === 'debt'
          ? '#C7464D'
          : status === 'advance'
            ? '#16805A'
            : c.labelSecondary
      const statusLabel =
        status === 'debt'
          ? t('payments.patient.debt')
          : status === 'advance'
            ? t('payments.patient.advance')
            : t('payments.patient.balance')

      return { currency, amount, status, statusLabel, color }
    })
  const distinctStatuses = new Set(
    moneyLines.map(({ status }) => status).filter((status) => status !== 'settled')
  )
  const overallStatus =
    distinctStatuses.size === 1
      ? moneyLines.find(({ status }) => distinctStatuses.has(status))?.statusLabel
      : t('payments.patient.balance')
  const overallStatusColor =
    distinctStatuses.size === 1
      ? moneyLines.find(({ status }) => distinctStatuses.has(status))?.color
      : c.labelSecondary
  const balanceAccessibilityLabel = `${t('payments.summary.netBalance')}: ${moneyLines
    .map(
      ({ amount, statusLabel }) =>
        `${amount.value} ${amount.unit}, ${statusLabel}`
    )
    .join('; ')}`

  const handlePress = () => {
    if (!onPress) return
    void Haptics.selectionAsync()
    onPress()
  }

  const inner = (
    <View style={styles.row}>
      <PatientAvatar
        name={data.patientName}
        size={46}
        initialsFontSize={14}
        uri={data.patientPhotoUri}
        style={styles.avatar}
      />

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {data.patientName}
        </Text>
        {formattedPhone ? (
          <Text style={styles.phone} numberOfLines={1}>
            {formattedPhone}
          </Text>
        ) : null}
        <View style={styles.entriesRow}>
          <Icon name="list-outline" size={11} color={c.labelTertiary as string} />
          <Text style={styles.meta} numberOfLines={1}>
            {t('payments.patient.entries', { n: data.entryCount })}
          </Text>
        </View>
      </View>

      <View
        style={styles.right}
        accessible
        accessibilityLabel={balanceAccessibilityLabel}
      >
        <View style={styles.paymentDivider} />
        <View style={styles.balanceHeader}>
          <Text
            style={[styles.overallStatus, { color: overallStatusColor as string }]}
            numberOfLines={1}
          >
            {overallStatus}
          </Text>
        </View>
        {moneyLines.map(({ currency, amount, color }) => (
          <Text
            key={currency}
            style={[styles.balance, { color: color as string }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
          >
            {amount.value}
            <Text style={styles.balanceUnit}> {amount.unit}</Text>
          </Text>
        ))}
      </View>

      {onPress ? (
        <Icon name="chevron-forward" size={15} color={c.labelTertiary as string} />
      ) : null}
    </View>
  )

  if (!onPress) return inner

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => pressed && styles.pressed}
      accessibilityRole="button"
      accessibilityLabel={[data.patientName, formattedPhone].filter(Boolean).join(', ')}
    >
      {inner}
    </Pressable>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    row: {
      minHeight: 70,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 20,
      gap: 10,
    },
    pressed: { backgroundColor: c.fillQuaternary },
    avatar: {
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.brandSoft,
      backgroundColor: c.brandSurface,
    },
    body: { flex: 1, minWidth: 0, gap: 2 },
    name: {
      ...typography.subheadBold,
      color: c.label,
    },
    phone: {
      ...typography.caption1,
      color: c.labelSecondary,
    },
    meta: {
      fontFamily: font('500'),
      fontSize: 10.5,
      lineHeight: 13,
      fontWeight: '500',
      color: c.labelTertiary,
    },
    entriesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    right: {
      width: 104,
      minWidth: 0,
      position: 'relative',
      flexShrink: 1,
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: 2,
      paddingLeft: 11,
    },
    paymentDivider: {
      position: 'absolute',
      top: 3,
      bottom: 3,
      left: 8,
      width: StyleSheet.hairlineWidth,
      backgroundColor: c.separator,
    },
    balanceHeader: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginBottom: 1,
    },
    overallStatus: {
      flexShrink: 1,
      fontFamily: font('700'),
      fontSize: 8.5,
      lineHeight: 11,
      fontWeight: '700',
    },
    balance: {
      fontFamily: font('800'),
      fontSize: 13.5,
      lineHeight: 16,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    balanceUnit: {
      fontFamily: font('600'),
      fontSize: 9,
      fontWeight: '600',
      color: c.labelSecondary,
    },
  })
}
