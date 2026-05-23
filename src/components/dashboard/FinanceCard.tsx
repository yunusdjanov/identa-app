import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import Icon, { IconName } from '../ui/Icon'
import CountUp from '../ui/CountUp'
import Sparkline from '../ui/Sparkline'
import { radius, typography, shadows, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { useThemeStore } from '../../stores/theme'

type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info'

interface Props {
  iconName: IconName
  label: string
  // Pre-formatted display string used when `numericValue` is omitted.
  value: string
  unit: string
  tone?: Tone
  // When provided, the value animates from its previous render to this
  // number using `formatValue` for each frame. Falls back to the static
  // `value` string if `numericValue` is missing.
  numericValue?: number
  formatValue?: (n: number) => string
  // Optional 7-point trend drawn as an inline sparkline beneath the icon.
  trend?: number[]
  onPress?: () => void
}

export default function FinanceCard({
  iconName,
  label,
  value,
  unit,
  tone = 'neutral',
  numericValue,
  formatValue,
  trend,
  onPress,
}: Props) {
  const themeColors = useColors()
  const effective = useThemeStore((s) => s.effective)
  const styles = useMemo(() => makeStyles(themeColors), [themeColors])
  const c = toneColors(tone, themeColors, effective)

  const handlePress = () => {
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      onPress()
    }
  }

  const animatedValue =
    typeof numericValue === 'number' && formatValue ? (
      <CountUp
        value={numericValue}
        format={formatValue}
        style={[styles.value, { color: c.valueColor }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      />
    ) : (
      <Text style={[styles.value, { color: c.valueColor }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    )

  const Inner = (
    <LinearGradient
      colors={c.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, shadows.sm]}
    >
      <View style={styles.topRow}>
        <View style={[styles.iconBubble, { backgroundColor: c.iconBg }]}>
          <Icon name={iconName} size={16} color={c.iconColor} />
        </View>
        {trend && trend.length >= 2 ? (
          <Sparkline
            data={trend}
            width={54}
            height={16}
            strokeColor={c.iconColor}
            fillColor={c.iconColor}
            strokeWidth={1.4}
          />
        ) : null}
      </View>

      <Text
        style={styles.label}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {label}
      </Text>

      <View style={styles.valueRow}>
        {animatedValue}
        <Text style={[styles.unit, { color: c.unitColor }]} numberOfLines={1}>
          {unit}
        </Text>
      </View>
    </LinearGradient>
  )

  if (onPress) {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      >
        {Inner}
      </Pressable>
    )
  }
  return <View style={styles.wrap}>{Inner}</View>
}

function toneColors(tone: Tone, themeColors: Colors, effective: 'light' | 'dark') {
  // In dark mode, gradients use very subtle alpha-tinted overlays so the
  // card reads as colored surface rather than washing out the deep root.
  if (effective === 'dark') {
    switch (tone) {
      case 'info':
        return {
          gradient: ['rgba(10, 132, 255, 0.18)', 'rgba(10, 132, 255, 0.08)'] as [string, string],
          iconBg: 'rgba(10, 132, 255, 0.24)',
          iconColor: '#0A84FF',
          valueColor: themeColors.label,
          unitColor: '#7DD3FC',
        }
      case 'success':
        return {
          gradient: ['rgba(48, 209, 88, 0.16)', 'rgba(48, 209, 88, 0.08)'] as [string, string],
          iconBg: 'rgba(48, 209, 88, 0.22)',
          iconColor: '#30D158',
          valueColor: themeColors.label,
          unitColor: '#86EFAC',
        }
      case 'warning':
        return {
          gradient: ['rgba(255, 159, 10, 0.18)', 'rgba(255, 159, 10, 0.08)'] as [string, string],
          iconBg: 'rgba(255, 159, 10, 0.22)',
          iconColor: '#FF9F0A',
          valueColor: themeColors.label,
          unitColor: '#FCD34D',
        }
      case 'danger':
        return {
          gradient: ['rgba(255, 69, 58, 0.18)', 'rgba(255, 69, 58, 0.08)'] as [string, string],
          iconBg: 'rgba(255, 69, 58, 0.22)',
          iconColor: '#FF453A',
          valueColor: themeColors.label,
          unitColor: '#FCA5A5',
        }
      default:
        return {
          gradient: [themeColors.backgroundSecondary, themeColors.backgroundSecondary] as [string, string],
          iconBg: themeColors.fillTertiary,
          iconColor: themeColors.labelSecondary as string,
          valueColor: themeColors.label,
          unitColor: themeColors.labelSecondary as string,
        }
    }
  }
  switch (tone) {
    case 'info':
      // Blue gradient — used on the dashboard's first finance card so it
      // visually contrasts with the green "outstanding debt" card next to
      // it. iOS-HIG blue family, light-mode palette.
      return {
        gradient: ['#EFF6FF', '#DBEAFE'] as [string, string],
        iconBg: '#DBEAFE',
        iconColor: '#2563EB',
        valueColor: '#0F172A',
        unitColor: '#1D4ED8',
      }
    case 'success':
      return {
        gradient: ['#F0FDF4', '#E8F8EE'] as [string, string],
        iconBg: '#DCFCE7',
        iconColor: '#16A34A',
        valueColor: '#0F172A',
        unitColor: '#15803D',
      }
    case 'warning':
      return {
        gradient: ['#FFFBEB', '#FEF3C7'] as [string, string],
        iconBg: '#FEF3C7',
        iconColor: '#D97706',
        valueColor: '#0F172A',
        unitColor: '#92400E',
      }
    case 'danger':
      return {
        gradient: ['#FEF2F2', '#FEE2E2'] as [string, string],
        iconBg: '#FEE2E2',
        iconColor: '#DC2626',
        valueColor: '#0F172A',
        unitColor: '#B91C1C',
      }
    default:
      return {
        gradient: ['#F8FAFC', '#F1F5F9'] as [string, string],
        iconBg: themeColors.fillTertiary,
        iconColor: themeColors.labelSecondary as string,
        valueColor: themeColors.label,
        unitColor: themeColors.labelSecondary as string,
      }
  }
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
  wrap: { flex: 1 },
  pressed: { opacity: 0.85 },
  card: {
    minHeight: 96,
    borderRadius: radius.xxl,
    padding: 12,
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBubble: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: font('600'),
    fontSize: 12,
    color: c.labelSecondary,
    fontWeight: '600',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 'auto',
  },
  value: {
    fontFamily: font('800'),
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  unit: {
    fontFamily: font('600'),
    fontSize: 11,
    fontWeight: '600',
  },
  })
}
