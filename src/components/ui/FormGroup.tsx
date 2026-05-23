import React, { Children, isValidElement, cloneElement, useMemo } from 'react'
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native'
import { radius } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

interface Props {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}

// Apple-style "Inset Grouped" container: multiple rows with hairline separators.
// Used to host stacked Input rows visually grouped as one card.
export default function FormGroup({ children, style }: Props) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const items = Children.toArray(children).filter(isValidElement)

  return (
    <View style={[styles.wrap, style]}>
      {items.map((child, index) => (
        <View key={index}>
          {cloneElement(child as React.ReactElement<any>, {})}
          {index < items.length - 1 ? <View style={styles.separator} /> : null}
        </View>
      ))}
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
  wrap: {
    backgroundColor: c.background,
    borderRadius: radius.xxl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.separator as string,
    overflow: 'hidden',
    shadowColor: '#0F2E4C',
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.separator as string,
    marginLeft: 52,
  },
  })
}
