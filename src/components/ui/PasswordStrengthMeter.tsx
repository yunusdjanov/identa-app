import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { getPasswordStrength, type PasswordStrength } from '../../lib/validation'
import { useI18n } from '../../i18n'

interface Props {
  value: string
}

const SEGMENT_COUNT = 3

export default function PasswordStrengthMeter({ value }: Props) {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const strength = getPasswordStrength(value)

  if (!value) return null

  const label = labelFor(strength, t)
  const color = colorFor(strength, c)

  return (
    <View style={styles.wrap}>
      <View style={styles.segments}>
        {Array.from({ length: SEGMENT_COUNT }).map((_, i) => (
          <Segment key={i} filled={i < strength} color={color} />
        ))}
      </View>
      {label ? <Text style={[styles.label, { color }]}>{label}</Text> : null}
    </View>
  )
}

function Segment({ filled, color }: { filled: boolean; color: string }) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const widthAnim = React.useRef(new Animated.Value(filled ? 1 : 0)).current

  React.useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: filled ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start()
  }, [filled, widthAnim])

  return (
    <View style={styles.segmentTrack}>
      <Animated.View
        style={[
          styles.segmentFill,
          {
            backgroundColor: color,
            width: widthAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          },
        ]}
      />
    </View>
  )
}

function labelFor(s: PasswordStrength, t: (key: string) => string): string {
  switch (s) {
    case 1:
      return t('register.strength.weak')
    case 2:
      return t('register.strength.medium')
    case 3:
      return t('register.strength.strong')
    default:
      return ''
  }
}

function colorFor(s: PasswordStrength, c: Colors): string {
  switch (s) {
    case 1:
      return c.danger
    case 2:
      return c.warning
    case 3:
      return c.success
    default:
      return c.systemGray4
  }
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
    marginTop: -4,
  },
  segments: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  segmentTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.systemGray5,
    overflow: 'hidden',
  },
  segmentFill: {
    height: '100%',
    borderRadius: 2,
  },
  label: {
    ...typography.caption1,
    fontFamily: font('600'),
    fontWeight: '600',
    minWidth: 50,
    textAlign: 'right',
  },
  })
}
