import React, { useMemo, useState } from 'react'
import { View, TextInput, StyleSheet, Pressable, ActivityIndicator, TextInputProps } from 'react-native'
import Icon from './Icon'
import { radius, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

interface Props extends Omit<TextInputProps, 'style'> {
  value: string
  onChangeText: (v: string) => void
  // When true, replaces the trailing clear button with a small spinner so the
  // user sees that the search-as-you-type request is in flight (otherwise the
  // 250ms debounce + network round-trip feels like "search did nothing").
  loading?: boolean
}

export default function SearchBar({ value, onChangeText, placeholder, loading, ...rest }: Props) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const [focused, setFocused] = useState(false)

  return (
    <View style={[styles.wrap, focused && styles.wrapFocused]}>
      <Icon name="search" size={18} color={c.labelSecondary as string} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.labelTertiary as string}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        {...rest}
      />
      {loading ? (
        <ActivityIndicator size="small" color={c.labelSecondary as string} testID="searchbar-spinner" />
      ) : value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          hitSlop={10}
          testID="searchbar-clear"
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <Icon name="close-circle" size={18} color={c.labelTertiary as string} />
        </Pressable>
      ) : null}
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      height: 44,
      paddingHorizontal: 14,
      backgroundColor: c.fillQuaternary,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    wrapFocused: {
      borderColor: c.brand,
      backgroundColor: c.background,
    },
    input: {
      flex: 1,
      ...typography.body,
      fontFamily: font('400'),
      color: c.label,
      paddingVertical: 0,
    },
  })
}
