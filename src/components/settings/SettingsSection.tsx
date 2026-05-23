import React, { Children, isValidElement, useMemo } from 'react'
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native'
import { radius, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

interface Props {
  title?: string
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}

// iOS Settings–style grouped section. Optional uppercase title above,
// hairline separators between rows (children).
export default function SettingsSection({ title, children, style }: Props) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const items = Children.toArray(children).filter(isValidElement)

  return (
    <View style={[styles.wrap, style]}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={styles.group}>
        {items.map((child, i) => (
          <View key={i}>
            {child}
            {i < items.length - 1 ? <View style={styles.separator} /> : null}
          </View>
        ))}
      </View>
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    wrap: {
      gap: 8,
    },
    title: {
      fontFamily: font('700'),
      fontSize: 12,
      fontWeight: '700',
      color: c.labelSecondary,
      letterSpacing: 0.6,
      paddingHorizontal: 20,
    },
    group: {
      backgroundColor: c.background,
      borderRadius: radius.xl,
      overflow: 'hidden',
      marginHorizontal: 16,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.separator as string,
      marginLeft: 52,
    },
  })
}
