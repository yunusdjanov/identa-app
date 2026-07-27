import React, { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation, type NavigationProp } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'

import { useAuthStore } from '../../stores/auth'
import { useI18n } from '../../i18n'
import { font, radius } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import type { MainStackParams } from '../../navigation'

export default function ProfileAvatarButton() {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const user = useAuthStore((state) => state.user)
  const navigation = useNavigation<NavigationProp<MainStackParams>>()
  const initial = (user?.name?.trim()?.[0] || 'U').toUpperCase()

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync()
        navigation.navigate('Settings')
      }}
      style={({ pressed }) => [styles.touchTarget, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={t('settings.title')}
    >
      <View style={styles.avatar}>
        <Text style={styles.initial}>{initial}</Text>
      </View>
    </Pressable>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    touchTarget: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.brand,
      shadowColor: c.brand,
      shadowOpacity: 0.22,
      shadowRadius: 7,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    initial: {
      fontFamily: font('700'),
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    pressed: {
      opacity: 0.72,
      transform: [{ scale: 0.96 }],
    },
  })
}
