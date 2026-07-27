import React, { useMemo } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native'
import * as Haptics from 'expo-haptics'

import Icon, { type IconName } from '../ui/Icon'
import ProfileAvatarButton from './ProfileAvatarButton'
import { spacing, typography, radius } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

interface AppHeaderProps {
  title: string
  subtitle?: string
  supportingContent?: React.ReactNode
  onBack?: () => void
  backLabel?: string
  leading?: React.ReactNode
  actions?: React.ReactNode
  showProfile?: boolean
  style?: StyleProp<ViewStyle>
}

export default function AppHeader({
  title,
  subtitle,
  supportingContent,
  onBack,
  backLabel = 'Back',
  leading,
  actions,
  showProfile = false,
  style,
}: AppHeaderProps) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])

  return (
    <View style={[styles.container, style]}>
      {onBack ? (
        <HeaderIconButton
          icon="chevron-back"
          label={backLabel}
          onPress={onBack}
          variant="plain"
        />
      ) : (
        leading
      )}

      <View style={styles.copy}>
        <Text
          style={styles.title}
          numberOfLines={1}
          ellipsizeMode="tail"
          accessibilityRole="header"
        >
          {title}
        </Text>
        {supportingContent ? (
          <View style={styles.supportingContent}>{supportingContent}</View>
        ) : subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
            {subtitle}
          </Text>
        ) : null}
      </View>

      {actions || showProfile ? (
        <View style={styles.actions}>
          {actions}
          {showProfile ? <ProfileAvatarButton /> : null}
        </View>
      ) : null}
    </View>
  )
}

type HeaderIconButtonVariant = 'tinted' | 'neutral' | 'surface' | 'brand' | 'plain'
type HeaderIconButtonShape = 'circle' | 'rounded'

interface HeaderIconButtonProps {
  icon: IconName
  label: string
  onPress: () => void
  variant?: HeaderIconButtonVariant
  disabled?: boolean
  loading?: boolean
  iconSize?: number
  shape?: HeaderIconButtonShape
}

export function HeaderIconButton({
  icon,
  label,
  onPress,
  variant = 'tinted',
  disabled = false,
  loading = false,
  iconSize = 20,
  shape = 'circle',
}: HeaderIconButtonProps) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const isDisabled = disabled || loading
  const palette = getButtonPalette(c, variant)

  return (
    <Pressable
      onPress={() => {
        if (isDisabled) return
        Haptics.selectionAsync()
        onPress()
      }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.actionButton,
        pressed && !isDisabled && styles.actionPressed,
        isDisabled && styles.actionDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      <View
        style={[
          styles.actionVisual,
          shape === 'rounded' && styles.actionVisualRounded,
          { backgroundColor: palette.background },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={palette.foreground} />
        ) : (
          <Icon name={icon} size={iconSize} color={palette.foreground} />
        )}
      </View>
    </Pressable>
  )
}

function getButtonPalette(c: Colors, variant: HeaderIconButtonVariant) {
  switch (variant) {
    case 'brand':
      return { background: c.brand as string, foreground: '#FFFFFF' }
    case 'neutral':
      return {
        background: c.fillQuaternary as string,
        foreground: c.labelSecondary as string,
      }
    case 'surface':
      return {
        background: c.backgroundTertiary as string,
        foreground: c.labelSecondary as string,
      }
    case 'plain':
      return { background: 'transparent', foreground: c.label as string }
    case 'tinted':
    default:
      return { background: c.brandLight as string, foreground: c.brand as string }
  }
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: {
      minHeight: 60,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    title: {
      ...typography.title3,
      color: c.brandDeep,
    },
    subtitle: {
      ...typography.footnote,
      color: c.labelSecondary,
    },
    supportingContent: {
      minHeight: 20,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    actions: {
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    actionButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
    },
    actionVisual: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
    },
    actionVisualRounded: {
      width: 38,
      height: 38,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.separator as string,
      shadowColor: '#000000',
      shadowOpacity: 0.07,
      shadowRadius: 7,
      shadowOffset: { width: 0, height: 3 },
      elevation: 1,
    },
    actionPressed: {
      opacity: 0.7,
      transform: [{ scale: 0.96 }],
    },
    actionDisabled: {
      opacity: 0.42,
    },
  })
}
