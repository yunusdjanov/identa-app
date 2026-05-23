import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as Haptics from 'expo-haptics'
import { useI18n } from '../../i18n'
import { useAuthStore } from '../../stores/auth'
import { useToast } from '../ui/Toast'
import Icon from '../ui/Icon'
import LanguageSwitcher from '../ui/LanguageSwitcher'
import { radius, typography, spacing, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { formatLongDate, getGreetingKey } from '../../lib/format'
import type { MainStackParams } from '../../navigation'

type Nav = NativeStackNavigationProp<MainStackParams, 'Tabs'>

export default function DashboardHeader() {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const user = useAuthStore((s) => s.user)
  const toast = useToast()
  const navigation = useNavigation<Nav>()

  const greetingKey = getGreetingKey()
  const greeting =
    greetingKey === 'morning'
      ? t('dashboard.greetingMorning')
      : greetingKey === 'afternoon'
        ? t('dashboard.greetingAfternoon')
        : t('dashboard.greetingEvening')

  // Sun/moon ornament next to the greeting. Picks an icon and warm/cool tint
  // based on the time of day so the header subtly shifts mood through the day.
  const timeOrnament: { icon: 'sunny' | 'partly-sunny' | 'moon'; color: string } =
    greetingKey === 'morning'
      ? { icon: 'sunny', color: '#F59E0B' }
      : greetingKey === 'afternoon'
        ? { icon: 'partly-sunny', color: '#0EA5E9' }
        : { icon: 'moon', color: '#A5B4FC' }

  const todayLabel = formatLongDate(new Date(), locale, t('dashboard.today'))
  const firstName = user?.name?.split(' ')[0] ?? ''
  const initial = (firstName[0] || 'U').toUpperCase()
  // Doctors get "Dr." prefix in the greeting; assistants get plain first name.
  const greetingName = firstName
    ? user?.role === 'dentist'
      ? `Dr. ${firstName}`
      : firstName
    : ''

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.left}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync()
              navigation.navigate('Settings')
            }}
            style={({ pressed }) => [styles.avatar, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.avatarText}>{initial}</Text>
          </Pressable>
          <View style={styles.textBlock}>
            <View style={styles.greetingRow}>
              <Icon name={timeOrnament.icon} size={16} color={timeOrnament.color} />
              <Text style={styles.greeting} numberOfLines={1}>
                {greeting}
                {greetingName ? `, ${greetingName}` : ''}
              </Text>
            </View>
            <Text style={styles.date} numberOfLines={1}>
              {todayLabel}
            </Text>
          </View>
        </View>

        <View style={styles.right}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync()
              toast.info(t('settings.comingSoon'))
            }}
            style={styles.iconBtn}
            hitSlop={6}
          >
            <Icon name="notifications-outline" size={22} color={c.label as string} />
          </Pressable>
          <LanguageSwitcher />
        </View>
      </View>
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    wrap: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.lg,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    left: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: radius.pill,
      backgroundColor: c.brand,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: c.brand,
      shadowOpacity: 0.3,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    avatarText: {
      fontFamily: font('700'),
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '700',
    },
    textBlock: { flex: 1, gap: 2 },
    greetingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    greeting: {
      flex: 1,
      ...typography.headline,
      color: c.label,
    },
    date: {
      ...typography.footnote,
      color: c.labelSecondary,
      textTransform: 'capitalize',
    },
    right: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      backgroundColor: c.fillQuaternary,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
}
