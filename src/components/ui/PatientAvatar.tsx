import React from 'react'
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native'
import { font } from '../../constants/theme'

interface Props {
  name: string
  size?: number
  style?: StyleProp<ViewStyle>
}

// Pastel palette deterministically chosen from name. Keeps avatars
// recognizably consistent across renders without storing extra state.
const PALETTE = [
  { bg: '#E6FAF7', fg: '#0E7490' },
  { bg: '#DBEAFE', fg: '#1D4ED8' },
  { bg: '#FCE7F3', fg: '#BE185D' },
  { bg: '#FEF3C7', fg: '#92400E' },
  { bg: '#E8F8EE', fg: '#15803D' },
  { bg: '#EDE9FE', fg: '#6D28D9' },
  { bg: '#FFEDD5', fg: '#C2410C' },
  { bg: '#F0F9FF', fg: '#0369A1' },
]

function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]![0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? '') : ''
  return (first + last).toUpperCase()
}

export default function PatientAvatar({ name, size = 40, style }: Props) {
  const initials = initialsFrom(name)
  const palette = PALETTE[hashCode(name) % PALETTE.length]

  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: palette!.bg },
        style,
      ]}
    >
      <Text style={[styles.text, { color: palette!.fg, fontSize: size * 0.4 }]}>{initials}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: font('700'),
    fontWeight: '700',
    letterSpacing: 0.3,
  },
})
