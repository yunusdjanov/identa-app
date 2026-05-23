import React, { forwardRef, useMemo, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
  Pressable,
} from 'react-native'
import { typography } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

interface Props extends TextInputProps {
  icon?: React.ReactNode
  rightAccessory?: React.ReactNode
  error?: string | null
}

// Single row inside a FormGroup — icon + input + optional accessory
const FormRow = forwardRef<TextInput, Props>(function FormRow(
  { icon, rightAccessory, error, style, onFocus, onBlur, ...rest },
  ref
) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const [focused, setFocused] = useState(false)

  return (
    <View style={styles.row}>
      {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
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
    </View>
  )
})

export default FormRow

function makeStyles(c: Colors) {
  return StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    paddingHorizontal: 16,
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
    paddingVertical: 16,
  },
  rightWrap: { marginLeft: 8 },
  })
}
