import React from 'react'
import { View, Image, StyleSheet, ViewStyle, StyleProp } from 'react-native'

type Variant = 'icon' | 'text' | 'full'

interface Props {
  variant?: Variant
  size?: number
  style?: StyleProp<ViewStyle>
}

const ICON = require('../../../assets/brand/identa-icon.png')
const TEXT = require('../../../assets/brand/identa-text.png')
const FULL = require('../../../assets/brand/identa-full.png')

// Native pixel dimensions of each source file (used to compute aspect ratio).
const ASPECT: Record<Variant, number> = {
  icon: 510 / 440, // ~1.16
  text: 640 / 240, // ~2.67
  full: 580 / 680, // ~0.85
}

export default function Brand({ variant = 'text', size = 140, style }: Props) {
  const source = variant === 'icon' ? ICON : variant === 'full' ? FULL : TEXT
  const aspect = ASPECT[variant]

  // `size` interpretation:
  // - icon  → height
  // - text  → width
  // - full  → width
  const dimensions =
    variant === 'icon'
      ? { width: size * aspect, height: size }
      : { width: size, height: size / aspect }

  return (
    <View style={[styles.container, style]}>
      <Image source={source} style={[styles.image, dimensions]} resizeMode="contain" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  image: {},
})
