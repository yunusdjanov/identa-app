import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import * as Haptics from 'expo-haptics'
import Icon, { IconName } from '../ui/Icon'
import { radius, typography, shadows, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

type Tone = 'green' | 'red' | 'blue' | 'amber' | 'neutral'

interface Props {
  iconName: IconName
  value: string
  label: string
  tone?: Tone
  onPress?: () => void
}

export default function StatCard({ iconName, value, label, tone = 'neutral', onPress }: Props) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const tc = toneColors(tone, c)

  const handlePress = () => {
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      onPress()
    }
  }

  const Inner = (
    <View style={[styles.card, shadows.sm]}>
      <View style={[styles.iconBubble, { backgroundColor: tc.bg }]}>
        <Icon name={iconName} size={18} color={tc.fg} />
      </View>
      <Text style={[styles.value, { color: tc.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
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

function toneColors(tone: Tone, c: Colors) {
  switch (tone) {
    case 'green':
      return { bg: '#E8F8EE', fg: '#16A34A', text: c.brandDeep }
    case 'red':
      return { bg: '#FEE2E2', fg: '#DC2626', text: c.brandDeep }
    case 'blue':
      return { bg: '#DBEAFE', fg: '#2563EB', text: c.brandDeep }
    case 'amber':
      return { bg: '#FEF3C7', fg: '#D97706', text: c.brandDeep }
    default:
      return { bg: c.fillQuaternary, fg: c.labelSecondary as string, text: c.label }
  }
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
  wrap: { flex: 1 },
  pressed: { opacity: 0.7 },
  card: {
    backgroundColor: c.background,
    borderRadius: radius.xl,
    padding: 16,
    minHeight: 110,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.separator as string,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  value: {
    fontFamily: font('800'),
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  label: {
    ...typography.footnote,
    color: c.labelSecondary,
  },
  })
}
