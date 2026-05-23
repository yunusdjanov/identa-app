import React, { createContext, useContext, useCallback, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Pressable,
  Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import Icon, { IconName } from './Icon'
import { radius, typography, shadows } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

interface ToastConfig {
  message: string
  variant?: ToastVariant
  duration?: number
}

interface ToastContextValue {
  show: (config: ToastConfig) => void
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

// Module-level handle to the active Toast API so non-React code (axios
// interceptors, MutationCache callbacks, background jobs) can fire toasts.
// Set by ToastProvider on mount; null until the provider mounts.
let globalToast: ToastContextValue | null = null

export function getGlobalToast(): ToastContextValue | null {
  return globalToast
}

const ICON_MAP: Record<ToastVariant, IconName> = {
  success: 'checkmark-circle',
  error: 'close-circle',
  warning: 'alert-circle',
  info: 'information-circle',
}

const HAPTIC_MAP: Record<ToastVariant, Haptics.NotificationFeedbackType | null> = {
  success: Haptics.NotificationFeedbackType.Success,
  error: Haptics.NotificationFeedbackType.Error,
  warning: Haptics.NotificationFeedbackType.Warning,
  info: null,
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const [current, setCurrent] = useState<ToastConfig | null>(null)
  const slide = useRef(new Animated.Value(-120)).current
  const opacity = useRef(new Animated.Value(0)).current
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(slide, { toValue: -120, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setCurrent(null))
  }, [opacity, slide])

  const show = useCallback(
    (config: ToastConfig) => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
      const variant = config.variant ?? 'info'
      const duration = config.duration ?? 3000
      const haptic = HAPTIC_MAP[variant]
      if (haptic) Haptics.notificationAsync(haptic)

      setCurrent({ ...config, variant })
      Animated.parallel([
        Animated.spring(slide, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 6 }),
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start()

      hideTimer.current = setTimeout(hide, duration)
    },
    [hide, opacity, slide]
  )

  const api: ToastContextValue = useMemo(
    () => ({
      show,
      success: (message: string) => show({ message, variant: 'success' }),
      error: (message: string) => show({ message, variant: 'error' }),
      warning: (message: string) => show({ message, variant: 'warning' }),
      info: (message: string) => show({ message, variant: 'info' }),
    }),
    [show]
  )

  // Expose the active toast API to non-React modules. Cleared on unmount so
  // stale calls during teardown don't reach a detached tree.
  React.useEffect(() => {
    globalToast = api
    return () => {
      globalToast = null
    }
  }, [api])

  const variant = current?.variant ?? 'info'
  const colorMap: Record<ToastVariant, string> = {
    success: c.success,
    error: c.danger,
    warning: c.warning,
    info: c.info,
  }
  const accent = colorMap[variant]

  return (
    <ToastContext.Provider value={api}>
      {children}
      {current ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.wrap,
            { top: insets.top + 8, transform: [{ translateY: slide }], opacity },
          ]}
        >
          <Pressable
            onPress={hide}
            style={[styles.toast, shadows.lg, { borderLeftColor: accent }]}
          >
            <Icon name={ICON_MAP[variant]} size={22} color={accent} />
            <Text style={styles.message} numberOfLines={3}>
              {current.message}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: 16,
      right: 16,
      zIndex: 9999,
    },
    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.background,
      borderRadius: radius.lg,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderLeftWidth: 4,
      ...(Platform.OS === 'android' ? { elevation: 8 } : null),
    },
    message: {
      flex: 1,
      ...typography.subhead,
      color: c.label,
    },
  })
}
