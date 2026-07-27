import React, { useMemo } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import * as Haptics from 'expo-haptics'

import Icon from '../ui/Icon'
import { ANALYTICS_RANGES, type AnalyticsRange } from '../../lib/analytics'
import { useI18n } from '../../i18n'
import { font, radius, shadows, spacing } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

const MIN_TOUCH_TARGET = Platform.OS === 'ios' ? 44 : 48

interface Props {
  value: AnalyticsRange
  onChange: (value: AnalyticsRange) => void
  loading?: boolean
}

export default function AnalyticsRangeSelector({ value, onChange, loading = false }: Props) {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])

  return (
    <View style={styles.shell}>
      <View style={styles.labelWrap}>
        <Icon name="calendar-clear-outline" size={15} color={c.brand as string} />
        <Text style={styles.label}>{t('analytics.rangeLabel')}</Text>
        {loading ? <ActivityIndicator size="small" color={c.brand as string} /> : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.options}
        accessibilityLabel={t('analytics.rangeLabel')}
      >
        {ANALYTICS_RANGES.map((range) => {
          const selected = value === range
          return (
            <Pressable
              key={range}
              onPress={() => {
                if (selected) return
                Haptics.selectionAsync()
                onChange(range)
              }}
              style={({ pressed }) => [
                styles.option,
                selected && styles.optionSelected,
                pressed && !selected && styles.optionPressed,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              accessibilityLabel={t(`analytics.range.${range}`)}
            >
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                {t(`analytics.range.${range}`)}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    shell: {
      width: '100%',
      maxWidth: 960,
      alignSelf: 'center',
      minHeight: MIN_TOUCH_TARGET + 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: spacing.xs,
      paddingHorizontal: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.brandSoft,
      borderRadius: radius.xl,
      backgroundColor: c.background,
      ...shadows.sm,
    },
    labelWrap: {
      minHeight: MIN_TOUCH_TARGET,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingLeft: 5,
      paddingRight: 2,
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
      alignItems: 'center',
      gap: 3,
      paddingRight: 2,
    },
    option: {
      minHeight: MIN_TOUCH_TARGET,
      justifyContent: 'center',
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: radius.md,
    },
    optionSelected: {
      backgroundColor: c.brand,
    },
    optionPressed: {
      backgroundColor: c.fillQuaternary,
    },
    optionText: {
      fontFamily: font('600'),
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '600',
      color: c.labelSecondary,
    },
    optionTextSelected: {
      color: '#FFFFFF',
    },
  })
}
