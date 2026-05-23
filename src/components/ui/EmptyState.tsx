import React, { useMemo } from 'react'
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Icon, { IconName } from './Icon'
import { radius, typography, spacing, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

type Tone = 'neutral' | 'success' | 'warning' | 'danger'

interface Props {
  iconName: IconName
  title: string
  subtitle?: string
  action?: React.ReactNode
  tone?: Tone
  style?: StyleProp<ViewStyle>
}

// Premium empty state with a layered illustration: outer gradient ring,
// inner solid bubble, primary icon, and a trio of decorative dots floating
// around the composition. Reads as deliberate "nothing here yet" rather
// than the plain icon-in-a-circle pattern.
export default function EmptyState({
  iconName,
  title,
  subtitle,
  action,
  tone = 'neutral',
  style,
}: Props) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const t = toneColors(tone, c)
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.illustration}>
        {/* Decorative floating dots — purely cosmetic */}
        <View style={[styles.dot, styles.dotTL, { backgroundColor: t.dot }]} />
        <View style={[styles.dot, styles.dotTR, { backgroundColor: t.dotSoft }]} />
        <View style={[styles.dot, styles.dotBL, { backgroundColor: t.dotSoft }]} />
        <View style={[styles.dotSmall, styles.dotBR, { backgroundColor: t.dot }]} />

        {/* Outer gradient ring */}
        <LinearGradient
          colors={[t.ringStart, t.ringEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.outerRing}
        >
          {/* Inner bubble holds the icon */}
          <View style={[styles.innerBubble, { backgroundColor: t.innerBg }]}>
            <Icon name={iconName} size={32} color={t.icon} />
          </View>
        </LinearGradient>
      </View>

      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  )
}

function toneColors(tone: Tone, c: Colors) {
  switch (tone) {
    case 'success':
      return {
        ringStart: 'rgba(48, 209, 88, 0.16)',
        ringEnd: 'rgba(48, 209, 88, 0.08)',
        innerBg: c.background,
        icon: c.success,
        dot: c.success,
        dotSoft: 'rgba(48, 209, 88, 0.45)',
      }
    case 'warning':
      return {
        ringStart: 'rgba(255, 159, 10, 0.18)',
        ringEnd: 'rgba(255, 159, 10, 0.08)',
        innerBg: c.background,
        icon: c.warning,
        dot: c.warning,
        dotSoft: 'rgba(255, 159, 10, 0.45)',
      }
    case 'danger':
      return {
        ringStart: 'rgba(255, 69, 58, 0.18)',
        ringEnd: 'rgba(255, 69, 58, 0.08)',
        innerBg: c.background,
        icon: c.danger,
        dot: c.danger,
        dotSoft: 'rgba(255, 69, 58, 0.45)',
      }
    default:
      return {
        ringStart: c.brandLight,
        ringEnd: 'rgba(45, 212, 191, 0.10)',
        innerBg: c.background,
        icon: c.brand as string,
        dot: c.brand as string,
        dotSoft: 'rgba(45, 212, 191, 0.45)',
      }
  }
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    wrap: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.lg,
    },
    illustration: {
      width: 140,
      height: 140,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    outerRing: {
      width: 110,
      height: 110,
      borderRadius: 55,
      alignItems: 'center',
      justifyContent: 'center',
    },
    innerBubble: {
      width: 78,
      height: 78,
      borderRadius: 39,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    dot: {
      position: 'absolute',
      width: 10,
      height: 10,
      borderRadius: 5,
      opacity: 0.7,
    },
    dotSmall: {
      position: 'absolute',
      width: 6,
      height: 6,
      borderRadius: 3,
      opacity: 0.7,
    },
    dotTL: { top: 6, left: 14 },
    dotTR: { top: 18, right: 4 },
    dotBL: { bottom: 14, left: 0 },
    dotBR: { bottom: 6, right: 22 },
    title: {
      fontFamily: font('700'),
      fontSize: 18,
      fontWeight: '700',
      color: c.label,
      textAlign: 'center',
      marginBottom: spacing.xs,
      letterSpacing: -0.2,
    },
    subtitle: {
      ...typography.subhead,
      color: c.labelSecondary,
      textAlign: 'center',
      paddingHorizontal: spacing.lg,
      lineHeight: 21,
    },
    action: {
      marginTop: spacing.lg,
      minWidth: 200,
    },
  })
}
