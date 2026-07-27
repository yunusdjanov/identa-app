import React from 'react'
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native'
import * as Haptics from 'expo-haptics'

import Icon, { type IconName } from './Icon'
import { radius } from '../../constants/theme'
import { useColors } from '../../lib/useColors'

const MIN_TOUCH_TARGET = Platform.OS === 'ios' ? 44 : 48

interface Props {
  icon: IconName
  label: string
  onPress: () => void
  variant?: 'brand' | 'neutral'
  size?: 'sm' | 'md'
  disabled?: boolean
  loading?: boolean
}

/**
 * Icon-only contextual action with a compact visual surface and a full
 * 44-point touch target. The required accessibility label replaces visible
 * text without making the action ambiguous to assistive technologies.
 */
export default function CompactIconButton({
  icon,
  label,
  onPress,
  variant = 'brand',
  size = 'sm',
  disabled = false,
  loading = false,
}: Props) {
  const c = useColors()
  const isDisabled = disabled || loading
  const palette = variant === 'brand'
    ? {
        background: c.brandLight as string,
        border: c.brandSoft as string,
        foreground: c.brand as string,
      }
    : {
        background: c.fillQuaternary as string,
        border: c.separator as string,
        foreground: c.labelSecondary as string,
      }

  return (
    <Pressable
      onPress={() => {
        if (isDisabled) return
        Haptics.selectionAsync()
        onPress()
      }}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        compactIconStyles.target,
        pressed && !isDisabled && compactIconStyles.pressed,
        isDisabled && compactIconStyles.disabled,
      ]}
    >
      <View
        testID="compact-icon-visual"
        style={[
          compactIconStyles.visual,
          size === 'md' && compactIconStyles.visualMedium,
          {
            backgroundColor: palette.background,
            borderColor: palette.border,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={palette.foreground} />
        ) : (
          <Icon name={icon} size={17} color={palette.foreground} />
        )}
      </View>
    </Pressable>
  )
}

const compactIconStyles = StyleSheet.create({
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
  },
  visualMedium: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
  },
  pressed: {
    opacity: 0.68,
    transform: [{ scale: 0.96 }],
  },
  disabled: {
    opacity: 0.42,
  },
})
