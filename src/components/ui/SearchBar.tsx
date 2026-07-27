import React, { useMemo, useState } from 'react'
import { View, TextInput, StyleSheet, Pressable, ActivityIndicator, TextInputProps } from 'react-native'
import Icon from './Icon'
import { radius, inputMetrics, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

interface Props extends Omit<TextInputProps, 'style'> {
  value: string
  onChangeText: (v: string) => void
  // When true, replaces the trailing clear button with a small spinner so the
  // user sees that the search-as-you-type request is in flight (otherwise the
  // 250ms debounce + network round-trip feels like "search did nothing").
  loading?: boolean
  loadingAccessibilityLabel?: string
  clearAccessibilityLabel?: string
}

export default function SearchBar({
  value,
  onChangeText,
  placeholder,
  loading,
  loadingAccessibilityLabel = 'Loading',
  clearAccessibilityLabel = 'Clear search',
  accessibilityLabel,
  onFocus,
  onBlur,
  ...rest
}: Props) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const [focused, setFocused] = useState(false)

  return (
    <View style={[styles.wrap, focused && styles.wrapFocused]}>
      <Icon
        name="search"
        size={inputMetrics.iconSize}
        color={c.labelSecondary as string}
      />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.labelTertiary as string}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        onFocus={(event) => {
          setFocused(true)
          onFocus?.(event)
        }}
        onBlur={(event) => {
          setFocused(false)
          onBlur?.(event)
        }}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        {...rest}
      />
      {loading ? (
        <View
          accessibilityRole="progressbar"
          accessibilityLiveRegion="polite"
          accessibilityLabel={loadingAccessibilityLabel}
          accessibilityState={{ busy: true }}
        >
          <ActivityIndicator
            size="small"
            color={c.labelSecondary as string}
            testID="searchbar-spinner"
          />
        </View>
      ) : value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          hitSlop={10}
          testID="searchbar-clear"
          accessibilityRole="button"
          accessibilityLabel={clearAccessibilityLabel}
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
      height: inputMetrics.height,
      paddingHorizontal: inputMetrics.paddingHorizontal,
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
      fontFamily: font('400'),
      fontSize: inputMetrics.fontSize,
      lineHeight: inputMetrics.lineHeight,
      color: c.label,
      paddingVertical: 0,
    },
  })
}
