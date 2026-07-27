import React, { useMemo } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import * as Haptics from 'expo-haptics'

import type { DashboardCurrency } from '../../types'
import { useI18n } from '../../i18n'
import { font, radius, shadows, spacing } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

const CURRENCIES: readonly DashboardCurrency[] = ['UZS', 'USD']
const MIN_TOUCH_TARGET = Platform.OS === 'ios' ? 44 : 48

interface Props {
  value: DashboardCurrency
  onChange: (currency: DashboardCurrency) => void
}

export default function AnalyticsCurrencySelector({ value, onChange }: Props) {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])

  return (
    <View
      style={styles.shell}
    >
      <Text style={styles.label}>{t('analytics.currencyLabel')}</Text>
      <View style={styles.options}>
        {CURRENCIES.map((currency) => {
          const selected = value === currency
          return (
            <Pressable
              key={currency}
              onPress={() => {
                if (selected) return
                void Haptics.selectionAsync()
                onChange(currency)
              }}
              style={({ pressed }) => [
                styles.option,
                selected && styles.optionSelected,
                pressed && !selected && styles.optionPressed,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, selected }}
              accessibilityLabel={currency}
            >
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                {currency}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    shell: {
      width: '100%',
      maxWidth: 960,
      minHeight: MIN_TOUCH_TARGET,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
      paddingLeft: spacing.md,
      paddingRight: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.brandSoft,
      borderRadius: radius.xl,
      backgroundColor: c.background,
      ...shadows.sm,
    },
    label: {
      fontFamily: font('700'),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: '700',
      letterSpacing: 0.45,
      textTransform: 'uppercase',
      color: c.labelSecondary,
    },
    options: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    option: {
      minWidth: 58,
      minHeight: MIN_TOUCH_TARGET - 6,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
    },
    optionSelected: {
      backgroundColor: c.brand,
    },
    optionPressed: {
      backgroundColor: c.fillQuaternary,
    },
    optionText: {
      fontFamily: font('700'),
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '700',
      color: c.labelSecondary,
    },
    optionTextSelected: {
      color: '#FFFFFF',
    },
  })
}
