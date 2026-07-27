import React, { useMemo } from 'react'
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native'

import { font, radius } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import type { ApiPatientCategory } from '../../types'

interface Props {
  category: ApiPatientCategory
  additionalCount?: number
  style?: StyleProp<ViewStyle>
}

/**
 * Read-only patient category badge shared by compact list rows and the
 * patient summary. Category colour stays a secondary cue; the name remains
 * readable without relying on colour perception.
 */
export default function PatientCategoryBadge({
  category,
  additionalCount = 0,
  style,
}: Props) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const label = additionalCount > 0
    ? `${category.name} +${additionalCount}`
    : category.name

  return (
    <View
      style={[styles.badge, style]}
      accessible
      accessibilityLabel={label}
    >
      <View style={[styles.dot, { backgroundColor: category.color || c.brand }]} />
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    badge: {
      minWidth: 0,
      maxWidth: 116,
      minHeight: 22,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.separator as string,
      backgroundColor: c.fillQuaternary,
    },
    dot: {
      width: 6,
      height: 6,
      flexShrink: 0,
      borderRadius: radius.pill,
    },
    label: {
      flexShrink: 1,
      fontFamily: font('600'),
      fontSize: 11,
      fontWeight: '600',
      lineHeight: 14,
      color: c.labelSecondary,
    },
  })
}
