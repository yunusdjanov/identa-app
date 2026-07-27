import React, { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import * as Haptics from 'expo-haptics'

import Icon from '../ui/Icon'
import { useI18n } from '../../i18n'
import { font, radius, shadows, spacing, typography } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

export interface FinanceDisplayAmount {
  currency: 'UZS' | 'USD'
  value: string
  unit: string
}

interface Props {
  revenue: FinanceDisplayAmount[]
  debt: FinanceDisplayAmount[]
  hasDebt: boolean
  hidden: boolean
  updatedAt: string
  isCached?: boolean
  onToggleVisibility: () => void
  onPress: () => void
}

export default function FinanceSummaryCard({
  revenue,
  debt,
  hasDebt,
  hidden,
  updatedAt,
  isCached = false,
  onToggleVisibility,
  onPress,
}: Props) {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])

  const toggleVisibility = () => {
    Haptics.selectionAsync()
    onToggleVisibility()
  }

  return (
    <View style={[styles.card, shadows.sm]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.titleIcon}>
            <Icon name="wallet-outline" size={17} color={c.brand as string} />
          </View>
          <Text style={styles.title}>{t('dashboard.financeOverview')}</Text>
        </View>

        <Pressable
          onPress={toggleVisibility}
          hitSlop={10}
          style={({ pressed }) => [styles.eyeButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={
            hidden ? t('dashboard.showAmounts') : t('dashboard.hideAmounts')
          }
        >
          <Icon
            name={hidden ? 'eye-outline' : 'eye-off-outline'}
            size={20}
            color={c.labelSecondary as string}
          />
        </Pressable>
      </View>

      <FinanceRow
        icon="arrow-down-circle-outline"
        iconColor={c.info as string}
        iconBackground="rgba(0,122,255,0.10)"
        label={t('dashboard.receivedThisMonth')}
        amounts={revenue}
        hidden={hidden}
        onPress={onPress}
        styles={styles}
      />

      <View style={styles.separator} />

      <FinanceRow
        icon={hasDebt ? 'alert-circle-outline' : 'checkmark-circle-outline'}
        iconColor={(hasDebt ? c.danger : c.success) as string}
        iconBackground={hasDebt ? 'rgba(255,59,48,0.10)' : 'rgba(52,199,89,0.10)'}
        label={t('dashboard.remainingDebt')}
        amounts={debt}
        hidden={hidden}
        onPress={onPress}
        styles={styles}
      />

      <Text style={styles.updated}>
        {isCached ? `${t('dashboard.cached')} · ` : ''}
        {t('dashboard.updatedAt', { time: updatedAt })}
      </Text>
    </View>
  )
}

interface FinanceRowProps {
  icon: 'arrow-down-circle-outline' | 'alert-circle-outline' | 'checkmark-circle-outline'
  iconColor: string
  iconBackground: string
  label: string
  amounts: FinanceDisplayAmount[]
  hidden: boolean
  onPress: () => void
  styles: ReturnType<typeof makeStyles>
}

function FinanceRow({
  icon,
  iconColor,
  iconBackground,
  label,
  amounts,
  hidden,
  onPress,
  styles,
}: FinanceRowProps) {
  const { t } = useI18n()
  const c = useColors()

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onPress()
      }}
      style={({ pressed }) => [styles.financeRow, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={
        hidden
          ? `${label}: ${t('dashboard.amountHidden')}`
          : `${label}: ${amounts.map((amount) => `${amount.value} ${amount.unit}`).join(', ')}`
      }
    >
      <View style={[styles.rowIcon, { backgroundColor: iconBackground }]}>
        <Icon name={icon} size={19} color={iconColor} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{label}</Text>
        <View style={styles.amounts}>
          {amounts.map((amount) => (
            <View key={amount.currency} style={styles.amountPill}>
              <Text style={styles.amountValue}>{hidden ? '••••••' : amount.value}</Text>
              <Text style={styles.amountUnit}>{amount.unit}</Text>
            </View>
          ))}
        </View>
      </View>
      <Icon name="chevron-forward" size={16} color={c.labelTertiary as string} />
    </Pressable>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    card: {
      borderRadius: radius.xxl,
      backgroundColor: c.backgroundTertiary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.separator,
      overflow: 'hidden',
    },
    header: {
      minHeight: 48,
      paddingHorizontal: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    titleIcon: {
      width: 30,
      height: 30,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.brandLight,
    },
    title: { ...typography.subheadBold, color: c.label },
    eyeButton: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.fillQuaternary,
    },
    pressed: { opacity: 0.65 },
    financeRow: {
      minHeight: 74,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    rowPressed: { backgroundColor: c.fillQuaternary },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowBody: { flex: 1, gap: 7 },
    rowLabel: { ...typography.footnote, color: c.labelSecondary },
    amounts: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    amountPill: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: radius.pill,
      backgroundColor: c.fillQuaternary,
    },
    amountValue: {
      fontFamily: font('800'),
      fontSize: 17,
      fontWeight: '800',
      color: c.label,
      letterSpacing: -0.3,
    },
    amountUnit: {
      fontFamily: font('600'),
      fontSize: 10,
      fontWeight: '600',
      color: c.labelSecondary,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      marginLeft: 64,
      backgroundColor: c.separator,
    },
    updated: {
      ...typography.caption1,
      color: c.labelTertiary,
      textAlign: 'right',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
  })
}
