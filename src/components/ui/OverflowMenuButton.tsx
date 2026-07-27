import React, { useMemo } from 'react'
import {
  ActivityIndicator,
  GestureResponderEvent,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import * as Haptics from 'expo-haptics'

import Icon from './Icon'
import { radius } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

const MIN_TOUCH_TARGET = Platform.OS === 'ios' ? 44 : 48

interface Props {
  label: string
  onPress: () => void
  size?: 'sm' | 'md'
  loading?: boolean
  disabled?: boolean
  stopPropagation?: boolean
}

/**
 * Shared three-dot trigger for headers and compact list rows. Its visible
 * surface stays small while the 44-point target remains comfortable to tap.
 */
export default function OverflowMenuButton({
  label,
  onPress,
  size = 'sm',
  loading = false,
  disabled = false,
  stopPropagation = false,
}: Props) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const isDisabled = disabled || loading

  const handlePress = (event?: GestureResponderEvent) => {
    if (stopPropagation) event?.stopPropagation()
    if (isDisabled) return
    Haptics.selectionAsync()
    onPress()
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      testID="overflow-menu-button"
      style={({ pressed }) => [
        styles.target,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      <View
        style={[styles.visual, size === 'md' && styles.visualMedium]}
        testID="overflow-menu-visual"
      >
        {loading ? (
          <ActivityIndicator size="small" color={c.labelSecondary as string} />
        ) : (
          <Icon name="ellipsis-horizontal" size={17} color={c.labelSecondary as string} />
        )}
      </View>
    </Pressable>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    target: {
      width: MIN_TOUCH_TARGET,
      height: MIN_TOUCH_TARGET,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
    },
    visual: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.separator as string,
      backgroundColor: c.fillQuaternary,
    },
    visualMedium: {
      width: 36,
      height: 36,
      borderRadius: radius.lg,
    },
    pressed: {
      opacity: 0.65,
      transform: [{ scale: 0.96 }],
    },
    disabled: {
      opacity: 0.42,
    },
  })
}
