import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
  TextStyle,
  StyleProp,
  Animated,
  View,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { radius, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

type Variant = 'primary' | 'secondary' | 'tinted' | 'plain' | 'destructive'
type Size = 'sm' | 'md' | 'lg'

interface Props {
  title: string
  onPress?: () => void
  variant?: Variant
  size?: Size
  loading?: boolean
  disabled?: boolean
  fullWidth?: boolean
  haptic?: boolean
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled = false,
  fullWidth = false,
  haptic = true,
  style,
  textStyle,
  leftIcon,
  rightIcon,
}: Props) {
  const c = useColors()
  const isDisabled = disabled || loading
  const scale = React.useRef(new Animated.Value(1)).current

  const onPressIn = () => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start()
  }
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 6 }).start()
  }
  const handlePress = () => {
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress?.()
  }

  const v = getVariantStyle(variant, isDisabled, c)
  const s = getSizeStyle(size)
  const showGradient = variant === 'primary' && !isDisabled

  const Inner = (
    <>
      {loading ? (
        <ActivityIndicator color={v.text.color as string} />
      ) : (
        <>
          {leftIcon}
          <Text style={[v.text, s.text, styles.label, textStyle]}>{title}</Text>
          {rightIcon}
        </>
      )}
    </>
  )

  return (
    <Animated.View
      style={[
        { transform: [{ scale }] },
        fullWidth && styles.fullWidth,
        showGradient && v.shadow,
        style,
      ]}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
      >
        {showGradient ? (
          <LinearGradient
            colors={[c.brand, c.brand === '#14B8A6' ? '#0E9C8E' : '#15B5A3']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.base, s.container]}
          >
            {Inner}
          </LinearGradient>
        ) : (
          <View style={[styles.base, v.container, s.container]}>{Inner}</View>
        )}
      </Pressable>
    </Animated.View>
  )
}

function getVariantStyle(variant: Variant, disabled: boolean, c: Colors) {
  const opacity = disabled ? 0.45 : 1
  switch (variant) {
    case 'primary':
      return {
        container: { backgroundColor: c.brand, opacity },
        text: { fontFamily: font('700'), color: '#FFFFFF', fontWeight: '700' as const },
        shadow: {
          shadowColor: c.brand,
          shadowOpacity: 0.35,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 6,
          borderRadius: radius.xl,
        },
      }
    case 'secondary':
      return {
        container: { backgroundColor: c.fillTertiary, opacity },
        text: { fontFamily: font('600'), color: c.label, fontWeight: '600' as const },
        shadow: {},
      }
    case 'tinted':
      return {
        container: { backgroundColor: c.brandLight, opacity },
        text: { fontFamily: font('600'), color: c.brandDeep, fontWeight: '600' as const },
        shadow: {},
      }
    case 'plain':
      return {
        container: { backgroundColor: 'transparent', opacity },
        text: { fontFamily: font('600'), color: c.brand, fontWeight: '600' as const },
        shadow: {},
      }
    case 'destructive':
      return {
        container: { backgroundColor: c.danger, opacity },
        text: { fontFamily: font('700'), color: '#FFFFFF', fontWeight: '700' as const },
        shadow: {},
      }
  }
}

function getSizeStyle(size: Size) {
  switch (size) {
    case 'sm':
      return {
        container: { minHeight: 36, paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.md },
        text: typography.subheadBold,
      }
    case 'md':
      return {
        container: { minHeight: 44, paddingHorizontal: 18, paddingVertical: 9, borderRadius: radius.lg },
        text: typography.bodyEmphasized,
      }
    case 'lg':
      return {
        container: { minHeight: 54, paddingHorizontal: 22, paddingVertical: 14, borderRadius: radius.xl },
        text: { ...typography.bodyEmphasized, fontFamily: font('700'), fontSize: 17, fontWeight: '700' as const },
      }
  }
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  label: {
    flexShrink: 1,
    textAlign: 'center',
  },
  fullWidth: { width: '100%' },
})
