import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import * as Haptics from 'expo-haptics'

import BottomSheet from '../ui/BottomSheet'
import Icon, { IconName } from '../ui/Icon'
import { useI18n } from '../../i18n'
import { useThemeStore, type ThemeMode } from '../../stores/theme'
import { radius, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

interface Props {
  visible: boolean
  onClose: () => void
}

interface ModeOption {
  value: ThemeMode
  iconName: IconName
  label: string
  hint: string
}

export default function AppearanceSheet({ visible, onClose }: Props) {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)

  const options: ModeOption[] = [
    {
      value: 'light',
      iconName: 'sunny-outline',
      label: t('settings.appearanceSheet.light'),
      hint: t('settings.appearanceSheet.lightHint'),
    },
    {
      value: 'dark',
      iconName: 'moon-outline',
      label: t('settings.appearanceSheet.dark'),
      hint: t('settings.appearanceSheet.darkHint'),
    },
    {
      value: 'auto',
      iconName: 'contrast-outline',
      label: t('settings.appearanceSheet.auto'),
      hint: t('settings.appearanceSheet.autoHint'),
    },
  ]

  const pick = (m: ThemeMode) => {
    Haptics.selectionAsync()
    setMode(m)
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('settings.appearanceSheet.title')}
    >
      <View style={styles.list}>
        {options.map((opt, idx) => {
          const active = opt.value === mode
          return (
            <React.Fragment key={opt.value}>
              <Pressable
                onPress={() => pick(opt.value)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={[styles.iconBubble, active && styles.iconBubbleActive]}>
                  <Icon
                    name={opt.iconName}
                    size={20}
                    color={active ? '#FFFFFF' : (c.brand as string)}
                  />
                </View>
                <View style={styles.text}>
                  <Text style={styles.label}>{opt.label}</Text>
                  <Text style={styles.hint}>{opt.hint}</Text>
                </View>
                {active ? (
                  <Icon name="checkmark" size={22} color={c.brand as string} />
                ) : (
                  <View style={{ width: 22 }} />
                )}
              </Pressable>
              {idx < options.length - 1 ? <View style={styles.separator} /> : null}
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
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    rowPressed: { backgroundColor: c.fillQuaternary },
    iconBubble: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: c.brandLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBubbleActive: {
      backgroundColor: c.brand,
    },
    text: { flex: 1, gap: 2 },
    label: {
      ...typography.bodyEmphasized,
      color: c.label,
    },
    hint: {
      ...typography.footnote,
      color: c.labelSecondary,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.separator as string,
      marginLeft: 16 + 36 + 14,
    },
  })
}
