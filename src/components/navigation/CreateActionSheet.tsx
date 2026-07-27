import React, { useMemo, useRef, useEffect } from 'react'
import {
  Modal,
  Pressable,
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { useI18n } from '../../i18n'
import { radius, spacing, typography, shadows } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import Icon, { IconName } from '../ui/Icon'

interface Props {
  visible: boolean
  onClose: () => void
  onAddPatient: () => void
  onNewAppointment: () => void
  // Permission/subscription gates from the parent. Default true so existing
  // callers keep working; CustomTabBar passes the real values.
  canAddPatient?: boolean
  canNewAppointment?: boolean
}

interface Action {
  iconName: IconName
  iconColor: string
  iconBg: string
  title: string
  description: string
  onPress: () => void
}

export default function CreateActionSheet({
  visible,
  onClose,
  onAddPatient,
  onNewAppointment,
  canAddPatient = true,
  canNewAppointment = true,
}: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])

  const slide = useRef(new Animated.Value(400)).current
  const fade = useRef(new Animated.Value(0)).current

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
      slide.setValue(400)
      fade.setValue(0)
    }
  }, [visible, slide, fade])

  const close = () => {
    Animated.parallel([
      Animated.timing(slide, { toValue: 400, duration: 200, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(() => onClose())
  }

  const tap = (cb: () => void) => () => {
    Haptics.selectionAsync()
    close()
    setTimeout(cb, 200)
  }

  const actions: Action[] = [
    ...(canNewAppointment
      ? [
          {
            iconName: 'calendar' as IconName,
            iconColor: '#FFFFFF',
            iconBg: c.brand as string,
            title: t('create.newAppointment'),
            description: t('create.newAppointmentDesc'),
            onPress: tap(onNewAppointment),
          },
        ]
      : []),
    ...(canAddPatient
      ? [
          {
            iconName: 'person-add' as IconName,
            iconColor: '#FFFFFF',
            iconBg: c.brand as string,
            title: t('create.addPatient'),
            description: t('create.addPatientDesc'),
            onPress: tap(onAddPatient),
          },
        ]
      : []),
  ]

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={close}
        accessible={false}
      >
        <Animated.View style={[styles.backdrop, { opacity: fade }]} />
      </Pressable>

      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.sheet,
          shadows.lg,
          { paddingBottom: insets.bottom + spacing.lg, transform: [{ translateY: slide }] },
        ]}
      >
        <View style={styles.handle} />
        <Text style={styles.title}>{t('create.title')}</Text>

        <View style={styles.actions}>
          {actions.map((action, i) => (
            <Pressable
              key={i}
              onPress={action.onPress}
              accessibilityRole="button"
              accessibilityLabel={action.title}
              accessibilityHint={action.description}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={[styles.iconBubble, { backgroundColor: action.iconBg }]}>
                <Icon name={action.iconName} size={22} color={action.iconColor} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{action.title}</Text>
                <Text style={styles.rowDesc}>{action.description}</Text>
              </View>
              <Icon
                name="chevron-forward"
                size={20}
                color={c.labelTertiary as string}
              />
            </Pressable>
          ))}
        </View>
      </Animated.View>
    </Modal>
  )
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
    ...typography.title3,
    color: c.brandDeep,
    paddingHorizontal: 4,
    marginBottom: spacing.lg,
  },
  actions: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: radius.xl,
    backgroundColor: c.fillQuaternary,
  },
  rowPressed: { opacity: 0.7 },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowTitle: { ...typography.bodyEmphasized, color: c.label },
  rowDesc: { ...typography.footnote, color: c.labelSecondary, marginTop: 2 },
  })
}
