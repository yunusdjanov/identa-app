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
import { radius, typography } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

interface Props extends TextInputProps {
  iconName?: IconName
  rightAccessory?: React.ReactNode
  error?: boolean
  containerStyle?: StyleProp<ViewStyle>
}

// Premium "floating card" input: each input is its own rounded elevated box.
// Focused state animates a soft border + shadow ring in brand color.
const InputCard = forwardRef<TextInput, Props>(function InputCard(
  { iconName, rightAccessory, error, containerStyle, style, onFocus, onBlur, ...rest },
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
            size={20}
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
        {...rest}
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
      minHeight: 56,
      backgroundColor: c.background,
      borderRadius: radius.xl,
      borderWidth: 1.2,
      paddingHorizontal: 16,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
    },
    iconWrap: {
      width: 24,
      height: 24,
      marginRight: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    input: {
      flex: 1,
      ...typography.body,
      color: c.label,
      paddingVertical: 18,
    },
    rightWrap: { marginLeft: 8 },
  })
}
