import React, { useEffect, useMemo, useRef } from 'react'
import { Animated, Easing, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Icon from './Icon'
import { useI18n } from '../../i18n'
import { useNetworkStore } from '../../stores/network'
import { font, radius, typography } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

// Sticky banner that fades in from the top when the device loses
// connectivity. Mounted globally so every screen gets the indicator
// without per-screen wiring. Designed to be unobtrusive — minimal
// height, soft amber tone, doesn't capture taps.
export default function NetworkBanner() {
  const isOnline = useNetworkStore((s) => s.isOnline)
  const insets = useSafeAreaInsets()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const { t } = useI18n()

  const slide = useRef(new Animated.Value(-80)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, {
        toValue: isOnline ? -80 : 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: isOnline ? 0 : 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start()
  }, [isOnline, slide, opacity])

  return (
    <Animated.View
      pointerEvents={isOnline ? 'none' : 'box-none'}
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + 6,
          transform: [{ translateY: slide }],
          opacity,
        },
      ]}
    >
      <View style={styles.banner}>
        <Icon name="cloud-offline" size={16} color="#FFFFFF" />
        <Text style={styles.text} numberOfLines={1}>
          {t('network.offline')}
        </Text>
      </View>
    </Animated.View>
  )
}

function makeStyles(_c: Colors) {
  return StyleSheet.create({
    wrap: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 14,
      paddingBottom: 6,
      zIndex: 10000,
    },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 9,
      paddingHorizontal: 14,
      borderRadius: radius.pill,
      // Warm amber — reads as "warning, but not critical".
      backgroundColor: '#B45309',
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    text: {
      ...typography.footnote,
      fontFamily: font('700'),
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: 0.1,
    },
  })
}
