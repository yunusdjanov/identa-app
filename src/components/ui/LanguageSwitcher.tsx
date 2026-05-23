import React, { useMemo, useRef, useState } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  Modal,
  Animated,
  Easing,
  Dimensions,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import Icon from './Icon'
import { useI18n } from '../../i18n'
import { radius, typography, shadows } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { SUPPORTED_LOCALES, type Locale } from '../../constants'

const LABELS: Record<Locale, { native: string; short: string; flag: string }> = {
  uz: { native: "O'zbek", short: 'UZ', flag: '🇺🇿' },
  ru: { native: 'Русский', short: 'RU', flag: '🇷🇺' },
  en: { native: 'English', short: 'EN', flag: '🇬🇧' },
}

interface Props {
  variant?: 'chip' | 'minimal'
}

export default function LanguageSwitcher({ variant = 'chip' }: Props) {
  const { locale, setLocale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const [open, setOpen] = useState(false)
  const fade = useRef(new Animated.Value(0)).current
  const slide = useRef(new Animated.Value(20)).current

  const openMenu = () => {
    Haptics.selectionAsync()
    setOpen(true)
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(slide, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start()
  }

  const closeMenu = () => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 20, duration: 180, useNativeDriver: true }),
    ]).start(() => setOpen(false))
  }

  const pick = (l: Locale) => {
    Haptics.selectionAsync()
    setLocale(l)
    closeMenu()
  }

  return (
    <>
      <Pressable onPress={openMenu} style={styles.trigger} hitSlop={8}>
        <Icon name="globe-outline" size={16} color={c.labelSecondary as string} />
        <Text style={styles.triggerText}>{LABELS[locale].short}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="none" onRequestClose={closeMenu}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu}>
          <Animated.View style={[styles.overlay, { opacity: fade }]} />
        </Pressable>

        <Animated.View
          style={[
            styles.sheet,
            shadows.lg,
            { opacity: fade, transform: [{ translateY: slide }] },
          ]}
        >
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Language</Text>
          {SUPPORTED_LOCALES.map((l) => {
            const isActive = locale === l
            return (
              <Pressable
                key={l}
                onPress={() => pick(l)}
                style={({ pressed }) => [
                  styles.option,
                  pressed && { backgroundColor: c.fillQuaternary },
                ]}
              >
                <Text style={styles.optionFlag}>{LABELS[l].flag}</Text>
                <Text style={styles.optionText}>{LABELS[l].native}</Text>
                {isActive ? (
                  <Icon name="checkmark" size={22} color={c.brand as string} />
                ) : (
                  <View style={{ width: 22 }} />
                )}
              </Pressable>
            )
          })}
        </Animated.View>
      </Modal>
    </>
  )
}

const screenHeight = Dimensions.get('window').height

function makeStyles(c: Colors) {
  return StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: c.fillQuaternary,
    borderRadius: radius.pill,
  },
  triggerText: {
    ...typography.footnoteBold,
    color: c.label,
    letterSpacing: 0.4,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    maxHeight: screenHeight * 0.6,
    backgroundColor: c.background,
    borderRadius: radius.xxl,
    padding: 12,
    paddingTop: 8,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: c.systemGray4,
    marginBottom: 12,
  },
  sheetTitle: {
    ...typography.footnoteBold,
    color: c.labelSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
  },
  optionFlag: { fontSize: 22 },
  optionText: { flex: 1, ...typography.body, color: c.label },
  })
}
