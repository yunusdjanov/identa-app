import React, { useMemo } from 'react'
import { Pressable, View, Text, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import { font, radius, typography } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

// One tooth in the odontogram grid. Two visual modes:
//  - "selected" (picker mode, user tapped it): solid brand fill + white text
//  - "neutral"  (picker mode, not selected): white surface + brand-tinted text
//  - "condition" (view mode, has a stored condition): coloured outline + dot
//    overlay so the underlying tooth number stays readable while the status
//    colour signals at a glance.
//
// The optional `badge` (a small number in the top-right corner) is used in
// view mode to surface "this tooth has N treatments" without needing the
// user to tap through.

export type ToothChipState =
  | 'neutral'
  | 'selected'
  | 'healthy'
  | 'cavity'
  | 'filling'
  | 'crown'
  | 'root_canal'
  | 'extraction'
  | 'implant'

interface Props {
  number: number
  state?: ToothChipState
  badge?: number
  onPress?: (n: number) => void
  // Disabled chips render at reduced opacity and ignore taps. Used for
  // primary-tooth toggles (the picker form lets you flip to "extracted"
  // state where future selection would be misleading).
  disabled?: boolean
  size?: 'compact' | 'default'
}

// Source-of-truth colour map for tooth conditions. Mirrors the constant in
// `src/constants/index.ts` (TOOTH_CONDITION_COLORS) so the picker form, the
// odontogram screen, and any summary chip all read from the same palette.
const CONDITION_COLOR: Record<Exclude<ToothChipState, 'neutral' | 'selected'>, string> = {
  healthy: '#22C55E',
  cavity: '#EF4444',
  filling: '#3B82F6',
  crown: '#EAB308',
  root_canal: '#A855F7',
  extraction: '#6B7280',
  implant: '#16A34A',
}

export default function ToothChip({
  number,
  state = 'neutral',
  badge,
  onPress,
  disabled,
  size = 'default',
}: Props) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c, size), [c, size])

  const handlePress = () => {
    if (disabled || !onPress) return
    Haptics.selectionAsync()
    onPress(number)
  }

  const isSelected = state === 'selected'
  const conditionColor =
    state === 'neutral' || state === 'selected' ? null : CONDITION_COLOR[state]

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || !onPress}
      style={({ pressed }) => [
        styles.chip,
        isSelected && styles.chipSelected,
        conditionColor ? { borderColor: conditionColor, borderWidth: 2 } : null,
        pressed && !disabled ? styles.chipPressed : null,
        disabled ? styles.chipDisabled : null,
      ]}
      hitSlop={4}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Tish ${number}`}
      accessibilityState={isSelected ? { selected: true } : undefined}
    >
      <Text
        style={[
          styles.label,
          isSelected ? styles.labelSelected : null,
          conditionColor ? { color: conditionColor } : null,
        ]}
        numberOfLines={1}
      >
        {number}
      </Text>
      {badge !== undefined && badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  )
}

function makeStyles(c: Colors, size: 'compact' | 'default') {
  const dim = size === 'compact' ? 32 : 40
  return StyleSheet.create({
    chip: {
      flex: 1,
      aspectRatio: 1,
      minWidth: 32,
      maxWidth: dim + 4,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.separator,
      backgroundColor: c.background,
      alignItems: 'center',
      justifyContent: 'center',
      // The badge floats outside the chip's content box. `overflow: visible`
      // keeps it clickable + visible on Android (default is hidden).
      overflow: 'visible',
      position: 'relative',
    },
    chipSelected: {
      backgroundColor: c.brand,
      borderColor: c.brand,
      // Subtle shadow only on selected to draw the eye to active picks.
      shadowColor: c.brand,
      shadowOpacity: 0.25,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
    },
    chipPressed: {
      opacity: 0.7,
    },
    chipDisabled: {
      opacity: 0.4,
    },
    label: {
      ...typography.footnoteBold,
      fontFamily: font('600'),
      color: c.label,
      // Reset lineHeight so the number sits visually centred — typography
      // tokens were tuned for body copy where line-height padding helps.
      lineHeight: undefined as unknown as number,
    },
    labelSelected: {
      color: '#FFFFFF',
    },
    badge: {
      position: 'absolute',
      top: -6,
      right: -6,
      minWidth: 16,
      height: 16,
      paddingHorizontal: 4,
      borderRadius: 8,
      backgroundColor: c.brandDeep,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: {
      fontFamily: font('700'),
      fontSize: 10,
      lineHeight: 12,
      color: '#FFFFFF',
    },
  })
}
