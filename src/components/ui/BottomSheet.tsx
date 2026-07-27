import React, { useEffect, useMemo, useRef } from 'react'
import {
  Modal,
  Pressable,
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Icon from './Icon'
import { radius, spacing, typography, shadows } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

interface Props {
  visible: boolean
  onClose: () => void
  /**
   * Runs before the closing animation. Return false to keep the sheet open.
   * This is used by forms that need to confirm discarding unsaved changes.
   */
  onBeforeClose?: () => boolean | Promise<boolean>
  title: string
  closeAccessibilityLabel: string
  children: React.ReactNode
  footer?: React.ReactNode
  // When true, content is rendered inside a ScrollView (default).
  scroll?: boolean
}

// Reusable iOS-style bottom sheet: backdrop + slide-up panel with drag
// handle, title row, close button, and scrollable content. Handles
// keyboard avoidance automatically. Animations are 280ms cubic-out.
export default function BottomSheet({
  visible,
  onClose,
  onBeforeClose,
  title,
  closeAccessibilityLabel,
  children,
  footer,
  scroll = true,
}: Props) {
  const insets = useSafeAreaInsets()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const slide = useRef(new Animated.Value(700)).current
  const fade = useRef(new Animated.Value(0)).current
  const closing = useRef(false)
  const closeRequestPending = useRef(false)

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slide, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start()
    } else {
      slide.setValue(700)
      fade.setValue(0)
    }
  }, [visible, slide, fade])

  const close = async () => {
    if (closing.current || closeRequestPending.current) return

    closeRequestPending.current = true
    let allowed = true
    try {
      if (onBeforeClose) allowed = await onBeforeClose()
    } catch {
      allowed = false
    } finally {
      closeRequestPending.current = false
    }
    if (!allowed) return

    closing.current = true
    Animated.parallel([
      Animated.timing(slide, { toValue: 700, duration: 220, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      closing.current = false
      onClose()
    })
  }

  const Content = scroll ? (
    <ScrollView
      style={styles.scrollView}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.staticContent}>{children}</View>
  )

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => {
        void close()
      }}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => {
          void close()
        }}
      >
        <Animated.View style={[styles.backdrop, { opacity: fade }]} />
      </Pressable>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kbWrap}
        pointerEvents="box-none"
      >
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            shadows.lg,
            { paddingBottom: insets.bottom + spacing.lg, transform: [{ translateY: slide }] },
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.titleRow}>
            <Text accessibilityRole="header" style={styles.title} numberOfLines={1}>{title}</Text>
            <Pressable
              onPress={() => {
                void close()
              }}
              hitSlop={10}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel={closeAccessibilityLabel}
            >
              <Icon name="close" size={20} color={c.labelSecondary as string} />
            </Pressable>
          </View>

          {Content}
          {footer ? (
            <View testID="bottom-sheet-footer" style={styles.footer}>
              {footer}
            </View>
          ) : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    kbWrap: { flex: 1, justifyContent: 'flex-end' },
    sheet: {
      maxHeight: '92%',
      backgroundColor: c.background,
      borderTopLeftRadius: radius.xxl,
      borderTopRightRadius: radius.xxl,
      paddingTop: 10,
    },
    handle: {
      alignSelf: 'center',
      width: 38,
      height: 5,
      borderRadius: 3,
      backgroundColor: c.systemGray4,
      marginBottom: spacing.md,
    },
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.md,
      gap: 12,
    },
    title: {
      flex: 1,
      ...typography.title2,
      color: c.brandDeep,
    },
    closeBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: c.fillQuaternary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.lg,
      gap: spacing.lg,
    },
    staticContent: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.lg,
    },
    scrollView: {
      flexShrink: 1,
    },
    footer: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.separator,
      backgroundColor: c.background,
    },
  })
}
