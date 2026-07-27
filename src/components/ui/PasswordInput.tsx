import React, { useMemo, useState, forwardRef } from 'react'
import { Pressable, StyleSheet, Text, TextInput, TextInputProps } from 'react-native'
import Input from './Input'
import { typography } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

interface Props extends Omit<TextInputProps, 'secureTextEntry'> {
  label?: string
  required?: boolean
  error?: string | null
  showLabel?: string
  hideLabel?: string
}

const PasswordInput = forwardRef<TextInput, Props>(function PasswordInput(
  { showLabel = "Ko'rsatish", hideLabel = 'Yashirish', ...rest },
  ref
) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const [visible, setVisible] = useState(false)

  return (
    <Input
      ref={ref}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      rightAccessory={
        <Pressable
          onPress={() => setVisible((v) => !v)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={visible ? hideLabel : showLabel}
        >
          <Text style={styles.toggle}>{visible ? hideLabel : showLabel}</Text>
        </Pressable>
      }
      {...rest}
    />
  )
})

export default PasswordInput

function makeStyles(c: Colors) {
  return StyleSheet.create({
  toggle: { ...typography.footnoteBold, color: c.brand },
  })
}
