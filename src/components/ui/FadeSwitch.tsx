import React from 'react'
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native'

interface Props {
  watch: string
  duration?: number
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}

// Pass-through wrapper. We removed the opacity cross-fade because the
// half-transparent mid-state read as a "shadow" on Android. Keep the
// component shape so consumers don't have to be rewritten; if we want a
// transition later (slide, scale), reintroduce it here.
export default function FadeSwitch({ children, style }: Props) {
  return <View style={[styles.flex, style]}>{children}</View>
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
})
