import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import * as Haptics from 'expo-haptics'
import BottomSheet from '../ui/BottomSheet'
import Icon from '../ui/Icon'
import { useI18n } from '../../i18n'
import { SUPPORTED_LOCALES, type Locale } from '../../constants'
import { radius, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

interface Props {
  visible: boolean
  onClose: () => void
}

const LABELS: Record<Locale, { native: string; flag: string }> = {
  uz: { native: "O'zbek", flag: '🇺🇿' },
  ru: { native: 'Русский', flag: '🇷🇺' },
  en: { native: 'English', flag: '🇬🇧' },
}

export default function LanguageSheet({ visible, onClose }: Props) {
  const { locale, setLocale, t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])

  const pick = (l: Locale) => {
    Haptics.selectionAsync()
    setLocale(l)
    onClose()
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('settings.languageSheet.title')}>
      <View style={styles.list}>
        {SUPPORTED_LOCALES.map((l, idx) => {
          const active = l === locale
          return (
            <React.Fragment key={l}>
              <Pressable
                onPress={() => pick(l)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <Text style={styles.flag}>{LABELS[l].flag}</Text>
                <Text style={styles.name}>{LABELS[l].native}</Text>
                {active ? (
                  <Icon name="checkmark" size={22} color={c.brand as string} />
                ) : (
                  <View style={{ width: 22 }} />
                )}
              </Pressable>
              {idx < SUPPORTED_LOCALES.length - 1 ? (
                <View style={styles.separator} />
              ) : null}
            </React.Fragment>
          )
        })}
      </View>
    </BottomSheet>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    list: {
      backgroundColor: c.background,
      borderRadius: radius.xl,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    rowPressed: { backgroundColor: c.fillQuaternary },
    flag: { fontSize: 22 },
    name: {
      flex: 1,
      fontFamily: font('500'),
      fontSize: 16,
      fontWeight: '500',
      color: c.label,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.separator as string,
      marginLeft: 52,
    },
  })
}
