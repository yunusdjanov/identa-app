import React, { forwardRef, useMemo, useState } from 'react'
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native'
import { font, inputMetrics, radius, typography } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

interface Props extends TextInputProps {
  label?: string
  required?: boolean
  error?: string | null
  hint?: string
  containerStyle?: StyleProp<ViewStyle>
  rightAccessory?: React.ReactNode
  leftAccessory?: React.ReactNode
}

const Input = forwardRef<TextInput, Props>(function Input(
  {
    label,
    required,
    error,
    hint,
    containerStyle,
    rightAccessory,
    leftAccessory,
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
  const hasError = Boolean(error)

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      ) : null}

      <View
        style={[
          styles.inputWrap,
          focused && styles.inputWrapFocused,
          hasError && styles.inputWrapError,
        ]}
      >
        {leftAccessory ? <View style={styles.accessory}>{leftAccessory}</View> : null}
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
          accessibilityLabel={rest.accessibilityLabel ?? label ?? rest.placeholder}
          accessibilityHint={error ?? accessibilityHint}
          aria-invalid={hasError}
        />
        {rightAccessory ? <View style={styles.accessory}>{rightAccessory}</View> : null}
      </View>

      {hasError ? (
        <Text style={styles.error} accessibilityRole="alert">{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  )
})

export default Input

function makeStyles(c: Colors) {
  return StyleSheet.create({
  container: { gap: 8 },
  label: { ...typography.footnoteBold, color: c.label, marginLeft: 4 },
  required: { color: c.danger },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.fillQuaternary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: inputMetrics.paddingHorizontal,
    height: inputMetrics.height,
    gap: 8,
  },
  inputWrapFocused: { borderColor: c.brand, backgroundColor: c.background },
  inputWrapError: { borderColor: c.danger, backgroundColor: c.background },
  accessory: { justifyContent: 'center', alignItems: 'center' },
  input: {
    flex: 1,
    fontFamily: font('400'),
    fontSize: inputMetrics.fontSize,
    lineHeight: inputMetrics.lineHeight,
    color: c.label,
    paddingVertical: 0,
  },
  error: { ...typography.footnote, color: c.danger, marginLeft: 4 },
  hint: { ...typography.footnote, color: c.labelSecondary, marginLeft: 4 },
  })
}
