import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import * as Haptics from 'expo-haptics'
import Icon from '../ui/Icon'
import PatientAvatar from '../ui/PatientAvatar'
import { radius, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { useI18n } from '../../i18n'
import { formatCurrencyParts } from '../../lib/format'

export interface PatientDebtData {
  patientId: string
  patientName: string
  patientPhone?: string
  totalDebt: number
  totalPaid: number
  balance: number
  entryCount: number
  lastEntryDate?: string
}

interface Props {
  data: PatientDebtData
  onPress?: () => void
}

export default function PatientDebtRow({ data, onPress }: Props) {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])

  const handlePress = () => {
    if (onPress) {
      Haptics.selectionAsync()
      onPress()
    }
  }

  const balanceParts = formatCurrencyParts(data.balance, locale)
  const paidParts = formatCurrencyParts(data.totalPaid, locale)
  const balanceColor =
    data.balance > 0 ? c.danger : data.balance < 0 ? c.success : c.labelSecondary

  const Inner = (
    <View style={styles.row}>
      <PatientAvatar name={data.patientName} size={42} />

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {data.patientName}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {t('payments.patient.entries', { n: data.entryCount })}
          {data.patientPhone ? ` · ${data.patientPhone}` : ''}
        </Text>
      </View>

      <View style={styles.right}>
        <Text style={[styles.balance, { color: balanceColor as string }]}>
          {balanceParts.value}
          <Text style={styles.balanceUnit}> {balanceParts.unit}</Text>
        </Text>
        <Text style={styles.paid}>
          {t('payments.patient.paid')}: {paidParts.value} {paidParts.unit}
        </Text>
      </View>

      {onPress ? (
        <Icon name="chevron-forward" size={16} color={c.labelTertiary as string} />
      ) : null}
    </View>
  )

  if (onPress) {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => pressed && styles.pressed}
      >
        {Inner}
      </Pressable>
    )
  }
  return Inner
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 12,
  },
  pressed: { backgroundColor: c.fillQuaternary },
  body: { flex: 1, gap: 3 },
  name: {
    ...typography.bodyEmphasized,
    color: c.label,
  },
  meta: {
    ...typography.footnote,
    color: c.labelSecondary,
  },
  right: {
    alignItems: 'flex-end',
    gap: 2,
  },
  balance: {
    fontFamily: font('800'),
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  balanceUnit: {
    fontFamily: font('600'),
    fontSize: 11,
    fontWeight: '600',
  },
  paid: {
    ...typography.caption1,
    color: c.labelTertiary,
  },
  })
}
