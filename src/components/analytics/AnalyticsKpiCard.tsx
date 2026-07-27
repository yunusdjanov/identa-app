import React, { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import Icon, { type IconName } from '../ui/Icon'
import { useI18n } from '../../i18n'
import { font, radius, shadows } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

export type AnalyticsKpiTone = 'positive' | 'negative' | 'neutral'
export type AnalyticsKpiAccent = 'teal' | 'rose' | 'blue' | 'emerald'

interface Props {
  label: string
  description: string
  value: string
  delta?: number | null
  tone?: AnalyticsKpiTone
  icon: IconName
  accent: AnalyticsKpiAccent
  wide?: boolean
}

const ACCENTS: Record<AnalyticsKpiAccent, { surface: string; foreground: string }> = {
  teal: { surface: '#EAF9F5', foreground: '#0F8A78' },
  rose: { surface: '#FFF1F2', foreground: '#C2414F' },
  blue: { surface: '#EFF6FF', foreground: '#2563EB' },
  emerald: { surface: '#ECFDF5', foreground: '#16805A' },
}

export default function AnalyticsKpiCard({
  label,
  description,
  value,
  delta,
  tone = 'positive',
  icon,
  accent,
  wide = false,
}: Props) {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const palette = ACCENTS[accent]
  const hasBaseline = typeof delta === 'number' && Number.isFinite(delta)
  const isUp = hasBaseline && delta > 0
  const isFlat = hasBaseline && delta === 0
  const isGood =
    hasBaseline && !isFlat && tone !== 'neutral'
      ? tone === 'positive'
        ? isUp
        : !isUp
      : null
  const deltaColor =
    isGood === true
      ? '#16805A'
      : isGood === false
        ? '#C7464D'
        : (c.labelSecondary as string)
  const deltaSurface =
    isGood === true
      ? '#ECFDF5'
      : isGood === false
        ? '#FFF1F2'
        : (c.fillQuaternary as string)
  const deltaLabel = hasBaseline
    ? `${delta > 0 ? '+' : ''}${Math.round(delta)}%`
    : t('analytics.noBaseline')
  const deltaAccessibilityLabel = hasBaseline
    ? `${deltaLabel}, ${t('analytics.deltaVs')}`
    : deltaLabel

  return (
    <View
      style={[styles.card, wide && styles.cardWide]}
      accessible
      accessibilityLabel={`${label}: ${value}. ${description}. ${deltaAccessibilityLabel}`}
    >
      <View style={styles.header}>
        <View style={styles.copy}>
          <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {label}
          </Text>
          <Text style={styles.description} numberOfLines={1}>
            {description}
          </Text>
        </View>
        <View style={[styles.iconBadge, { backgroundColor: palette.surface }]}>
          <Icon name={icon} size={18} color={palette.foreground} />
        </View>
      </View>

      <Text
        style={styles.value}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.62}
      >
        {value}
      </Text>

      <View style={styles.deltaLine}>
        <View style={[styles.deltaBadge, { backgroundColor: deltaSurface }]}>
          {hasBaseline ? (
            <Icon
              name={isFlat ? 'remove' : isUp ? 'arrow-up' : 'arrow-down'}
              size={11}
              color={deltaColor}
            />
          ) : null}
          <Text style={[styles.deltaText, { color: deltaColor }]} numberOfLines={1}>
            {deltaLabel}
          </Text>
        </View>
      </View>
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    card: {
      width: '47.8%',
      flexGrow: 1,
      minHeight: 108,
      padding: 10,
      gap: 5,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.brandSoft,
      backgroundColor: c.background,
      ...shadows.sm,
    },
    cardWide: {
      width: '23.4%',
    },
    header: {
      minHeight: 30,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    label: {
      fontFamily: font('700'),
      fontSize: 9.5,
      lineHeight: 12,
      fontWeight: '700',
      letterSpacing: 0.45,
      textTransform: 'uppercase',
      color: c.labelSecondary,
    },
    description: {
      fontFamily: font('400'),
      fontSize: 9,
      lineHeight: 11,
      fontWeight: '400',
      color: c.labelTertiary,
    },
    iconBadge: {
      width: 28,
      height: 28,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
    },
    value: {
      fontFamily: font('700'),
      fontSize: 19,
      lineHeight: 22,
      fontWeight: '700',
      letterSpacing: -0.35,
      color: c.label,
    },
    deltaLine: {
      minHeight: 18,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    deltaBadge: {
      maxWidth: '100%',
      minHeight: 18,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: radius.pill,
    },
    deltaText: {
      flexShrink: 1,
      fontFamily: font('700'),
      fontSize: 9.5,
      lineHeight: 12,
      fontWeight: '700',
    },
  })
}
