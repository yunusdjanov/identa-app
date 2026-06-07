import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Modal, View, Text, TextInput, StyleSheet, Pressable, Animated, Easing } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'

import Icon, { IconName } from './Icon'
import Button from './Button'
import { useI18n } from '../../i18n'
import { radius, spacing, typography, shadows, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

// App-styled replacements for the raw OS Alert.alert / ActionSheetIOS. Used
// imperatively (like the Toast API) so call sites stay simple:
//   const ok = await confirm({ title, message, confirmLabel, destructive: true })
//   const i  = await actionSheet({ options: [...] })

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  // Type-to-confirm guard (mirrors the web's permanent-delete dialog): when
  // set, the user must type this exact string before the confirm button
  // enables. Used for irreversible actions like permanent patient deletion.
  requireText?: string
  requireTextLabel?: string
  requireTextPlaceholder?: string
}

export interface ActionItem {
  label: string
  icon?: IconName
  destructive?: boolean
}

export interface ActionSheetOptions {
  title?: string
  message?: string
  options: ActionItem[]
  cancelLabel?: string
}

interface DialogContextValue {
  // Resolves true when confirmed, false when cancelled/dismissed.
  confirm: (opts: ConfirmOptions) => Promise<boolean>
  // Resolves the chosen option index, or -1 when cancelled/dismissed.
  actionSheet: (opts: ActionSheetOptions) => Promise<number>
}

const DialogContext = createContext<DialogContextValue | null>(null)

type State =
  | { kind: 'confirm'; opts: ConfirmOptions }
  | { kind: 'action'; opts: ActionSheetOptions }
  | null

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets()
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])

  const [state, setState] = useState<State>(null)
  const resolver = useRef<((value: any) => void) | null>(null)

  const slide = useRef(new Animated.Value(400)).current
  const fade = useRef(new Animated.Value(0)).current

  const animateIn = useCallback(() => {
    slide.setValue(400)
    fade.setValue(0)
    Animated.parallel([
      Animated.timing(slide, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start()
  }, [fade, slide])

  // Resolve the pending promise and animate the sheet away.
  const settle = useCallback(
    (value: boolean | number) => {
      const resolve = resolver.current
      resolver.current = null
      Animated.parallel([
        Animated.timing(slide, { toValue: 400, duration: 200, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0, duration: 160, useNativeDriver: true }),
      ]).start(() => {
        setState(null)
        resolve?.(value)
      })
    },
    [fade, slide]
  )

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve as (v: any) => void
        setState({ kind: 'confirm', opts })
        animateIn()
      }),
    [animateIn]
  )

  const actionSheet = useCallback(
    (opts: ActionSheetOptions) =>
      new Promise<number>((resolve) => {
        resolver.current = resolve as (v: any) => void
        setState({ kind: 'action', opts })
        animateIn()
      }),
    [animateIn]
  )

  const api = useMemo<DialogContextValue>(() => ({ confirm, actionSheet }), [confirm, actionSheet])

  const onCancel = useCallback(() => {
    Haptics.selectionAsync()
    settle(state?.kind === 'action' ? -1 : false)
  }, [settle, state])

  return (
    <DialogContext.Provider value={api}>
      {children}
      <Modal
        visible={state !== null}
        transparent
        animationType="none"
        onRequestClose={onCancel}
        statusBarTranslucent
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel}>
          <Animated.View style={[styles.backdrop, { opacity: fade }]} />
        </Pressable>

        <Animated.View
          style={[
            styles.sheet,
            shadows.lg,
            { paddingBottom: insets.bottom + spacing.lg, transform: [{ translateY: slide }] },
          ]}
        >
          <View style={styles.handle} />

          {state?.kind === 'confirm' ? (
            <ConfirmBody
              c={c}
              styles={styles}
              opts={state.opts}
              cancelLabel={state.opts.cancelLabel ?? t('common.cancel')}
              onConfirm={() => {
                Haptics.notificationAsync(
                  state.opts.destructive
                    ? Haptics.NotificationFeedbackType.Warning
                    : Haptics.NotificationFeedbackType.Success
                )
                settle(true)
              }}
              onCancel={onCancel}
            />
          ) : state?.kind === 'action' ? (
            <ActionBody
              c={c}
              styles={styles}
              opts={state.opts}
              cancelLabel={state.opts.cancelLabel ?? t('common.cancel')}
              onSelect={(i) => {
                Haptics.selectionAsync()
                settle(i)
              }}
              onCancel={onCancel}
            />
          ) : null}
        </Animated.View>
      </Modal>
    </DialogContext.Provider>
  )
}

function ConfirmBody({
  c,
  styles,
  opts,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  c: Colors
  styles: ReturnType<typeof makeStyles>
  opts: ConfirmOptions
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const [text, setText] = useState('')
  const needsText = typeof opts.requireText === 'string' && opts.requireText.length > 0
  const matched = !needsText || text.trim() === opts.requireText

  return (
    <>
      <Text style={styles.title}>{opts.title}</Text>
      {opts.message ? <Text style={styles.message}>{opts.message}</Text> : null}
      {needsText ? (
        <View style={styles.requireWrap}>
          {opts.requireTextLabel ? (
            <Text style={styles.requireLabel}>{opts.requireTextLabel}</Text>
          ) : null}
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={opts.requireTextPlaceholder}
            placeholderTextColor={c.labelTertiary as string}
            style={styles.requireInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      ) : null}
      <View style={styles.confirmActions}>
        <Button
          title={cancelLabel}
          variant="secondary"
          size="md"
          fullWidth
          onPress={onCancel}
          style={{ flex: 1 }}
        />
        <Button
          title={opts.confirmLabel}
          variant={opts.destructive ? 'destructive' : 'primary'}
          size="md"
          fullWidth
          disabled={!matched}
          onPress={onConfirm}
          style={{ flex: 1 }}
        />
      </View>
    </>
  )
}

function ActionBody({
  c,
  styles,
  opts,
  cancelLabel,
  onSelect,
  onCancel,
}: {
  c: Colors
  styles: ReturnType<typeof makeStyles>
  opts: ActionSheetOptions
  cancelLabel: string
  onSelect: (index: number) => void
  onCancel: () => void
}) {
  return (
    <>
      {opts.title ? <Text style={styles.title}>{opts.title}</Text> : null}
      {opts.message ? <Text style={styles.message}>{opts.message}</Text> : null}
      <View style={styles.actionList}>
        {opts.options.map((opt, i) => (
          <Pressable
            key={i}
            onPress={() => onSelect(i)}
            style={({ pressed }) => [styles.actionRow, pressed && styles.rowPressed]}
          >
            {opt.icon ? (
              <Icon
                name={opt.icon}
                size={20}
                color={(opt.destructive ? c.danger : c.brand) as string}
              />
            ) : null}
            <Text
              style={[styles.actionLabel, opt.destructive && { color: c.danger as string }]}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={onCancel} style={({ pressed }) => [styles.cancelRow, pressed && styles.rowPressed]}>
        <Text style={styles.cancelText}>{cancelLabel}</Text>
      </Pressable>
    </>
  )
}

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useDialog must be used within DialogProvider')
  return ctx
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: c.background,
      borderTopLeftRadius: radius.xxl,
      borderTopRightRadius: radius.xxl,
      paddingTop: 10,
      paddingHorizontal: spacing.lg,
    },
    handle: {
      alignSelf: 'center',
      width: 38,
      height: 5,
      borderRadius: 3,
      backgroundColor: c.systemGray4,
      marginBottom: spacing.lg,
    },
    title: {
      ...typography.headline,
      fontFamily: font('700'),
      color: c.label,
      textAlign: 'center',
      paddingHorizontal: 4,
    },
    message: {
      ...typography.subhead,
      color: c.labelSecondary,
      textAlign: 'center',
      marginTop: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    requireWrap: {
      marginTop: spacing.md,
      gap: 6,
    },
    requireLabel: {
      ...typography.footnote,
      color: c.labelSecondary as string,
      textAlign: 'center',
      paddingHorizontal: 4,
    },
    requireInput: {
      ...typography.body,
      fontFamily: font('500'),
      color: c.label,
      backgroundColor: c.background,
      borderWidth: 1.2,
      borderColor: c.separator as string,
      borderRadius: radius.lg,
      paddingHorizontal: 14,
      paddingVertical: 12,
      textAlign: 'center',
    },
    confirmActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    actionList: {
      marginTop: spacing.md,
      gap: spacing.xs,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 15,
      paddingHorizontal: 16,
      borderRadius: radius.lg,
      backgroundColor: c.fillQuaternary,
    },
    rowPressed: { opacity: 0.6 },
    actionLabel: {
      ...typography.bodyEmphasized,
      color: c.label,
    },
    cancelRow: {
      marginTop: spacing.sm,
      paddingVertical: 15,
      alignItems: 'center',
      borderRadius: radius.lg,
      backgroundColor: c.fillTertiary,
    },
    cancelText: {
      ...typography.bodyEmphasized,
      fontFamily: font('600'),
      color: c.label,
    },
  })
}
