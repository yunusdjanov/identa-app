import React, { forwardRef, useMemo, useState } from 'react'
import {
  View,
  TextInput,
  TextInputProps,
  StyleSheet,
  Animated,
  ViewStyle,
  StyleProp,
} from 'react-native'
import Icon, { IconName } from './Icon'
import { font, inputMetrics, radius } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

interface Props extends TextInputProps {
  iconName?: IconName
  rightAccessory?: React.ReactNode
  error?: boolean
  errorMessage?: string | null
  containerStyle?: StyleProp<ViewStyle>
}

// Premium "floating card" input: each input is its own rounded elevated box.
// Focused state animates a soft border + shadow ring in brand color.
const InputCard = forwardRef<TextInput, Props>(function InputCard(
  {
    iconName,
    rightAccessory,
    error,
    errorMessage,
    containerStyle,
    style,
    onFocus,
    onBlur,
    accessibilityHint,
    ...rest
  },
  ref
) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const [focused, setFocused] = useState(false)
  const focusAnim = React.useRef(new Animated.Value(0)).current

  React.useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: focused ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start()
  }, [focused, focusAnim])

  const borderColor = error
    ? (c.danger as string)
    : focusAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [c.separator as string, c.brand as string],
      })

  const shadowOpacity = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.04, 0.14],
  })

  return (
    <Animated.View
      style={[
        styles.card,
        {
          borderColor,
          shadowOpacity,
          shadowColor: error ? (c.danger as string) : focused ? (c.brand as string) : '#0F2E4C',
        },
        containerStyle,
      ]}
    >
      {iconName ? (
        <View style={styles.iconWrap}>
          <Icon
            name={iconName}
            size={inputMetrics.iconSize}
            color={focused ? (c.brand as string) : (c.labelSecondary as string)}
          />
        </View>
      ) : null}

      <TextInput
        ref={ref}
        style={[styles.input, style]}
        placeholderTextColor={c.labelTertiary as string}
        onFocus={(e) => {
          setFocused(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          onBlur?.(e)
        }}
        accessibilityHint={errorMessage ?? accessibilityHint}
        aria-invalid={Boolean(error)}
        {...rest}
        accessibilityLabel={rest.accessibilityLabel ?? rest.placeholder}
      />

      {rightAccessory ? <View style={styles.rightWrap}>{rightAccessory}</View> : null}
    </Animated.View>
  )
})

export default InputCard

function makeStyles(c: Colors) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: inputMetrics.height,
      backgroundColor: c.background,
      borderRadius: radius.lg,
      borderWidth: 1.2,
      paddingHorizontal: inputMetrics.paddingHorizontal,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
    },
    iconWrap: {
      width: inputMetrics.iconBoxSize,
      height: inputMetrics.iconBoxSize,
      marginRight: inputMetrics.contentGap,
      alignItems: 'center',
      justifyContent: 'center',
    },
    input: {
      flex: 1,
      fontFamily: font('400'),
      fontSize: inputMetrics.fontSize,
      lineHeight: inputMetrics.lineHeight,
      color: c.label,
      paddingVertical: 10,
    },
    rightWrap: { marginLeft: 8 },
  })
}
