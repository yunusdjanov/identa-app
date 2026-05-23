import React, { useMemo } from 'react'
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native'
import { radius, shadows } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

interface Props {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  padding?: number
  elevated?: boolean
}

export default function Card({ children, style, padding = 20, elevated = true }: Props) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  return (
    <View style={[styles.card, { padding }, elevated && shadows.lg, style]}>
      {children}
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
  card: {
    backgroundColor: c.background,
    borderRadius: radius.xxl,
  },
  })
}
