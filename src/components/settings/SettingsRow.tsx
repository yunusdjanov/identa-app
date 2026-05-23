import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import * as Haptics from 'expo-haptics'
import Icon, { IconName } from '../ui/Icon'
import { radius, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

interface Props {
  iconName: IconName
  iconColor?: string
  iconBg?: string
  label: string
  value?: string
  destructive?: boolean
  onPress?: () => void
  trailing?: React.ReactNode  // override default chevron
}

// iOS Settings–style row. Icon bubble + label + optional value + chevron.
// Destructive variant tints the label red and hides the icon bubble.
export default function SettingsRow({
  iconName,
  iconColor,
  iconBg,
  label,
  value,
  destructive,
  onPress,
  trailing,
}: Props) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const finalIconColor = iconColor ?? (c.brand as string)
  const finalIconBg = iconBg ?? c.brandLight

  const handlePress = () => {
    if (onPress) {
      Haptics.selectionAsync()
      onPress()
    }
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {destructive ? null : (
        <View style={[styles.iconBubble, { backgroundColor: finalIconBg }]}>
          <Icon name={iconName} size={17} color={finalIconColor} />
        </View>
      )}

      <Text
        style={[styles.label, destructive && styles.labelDestructive]}
        numberOfLines={1}
      >
        {label}
      </Text>

      {value ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}

      {trailing
        ? trailing
        : !destructive
          ? <Icon name="chevron-forward" size={16} color={c.labelTertiary as string} />
          : null}
    </Pressable>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 14,
      gap: 12,
      minHeight: 50,
    },
    pressed: { backgroundColor: c.fillQuaternary },
    iconBubble: {
      width: 30,
      height: 30,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      flex: 1,
      ...typography.body,
      color: c.label,
    },
    labelDestructive: {
      fontFamily: font('600'),
      fontWeight: '600',
      color: c.danger,
      textAlign: 'center',
    },
    value: {
      ...typography.body,
      color: c.labelSecondary,
      maxWidth: 140,
    },
  })
}
