import React, { useEffect, useRef, useState } from 'react'
import { View, StyleSheet, ActivityIndicator, Platform, Animated, Easing } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter'
import Brand from './Brand'
import { useAuthStore } from '../../stores/auth'
import { useThemeStore } from '../../stores/theme'
import { useColors } from '../../lib/useColors'
import { useI18n } from '../../i18n'

interface Props {
  children: React.ReactNode
}

// Shows the brand splash while the auth state is being restored from
// SecureStore AND while Inter fonts (Android typography baseline) load.
// Once both are ready we mount the app and cross-fade the splash out so
// there is no hard "pop" between the two layers.
export default function SplashGate({ children }: Props) {
  const c = useColors()
  const isHydrating = useAuthStore((s) => s.isHydrating)
  const hydrate = useAuthStore((s) => s.hydrate)
  const themeHydrating = useThemeStore((s) => s.isHydrating)
  const hydrateTheme = useThemeStore((s) => s.hydrate)
  const { isHydrating: localeHydrating } = useI18n()

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  })

  useEffect(() => {
    hydrate()
    hydrateTheme()
  }, [hydrate, hydrateTheme])

  // On iOS we don't need to wait for Inter — System (SF Pro) is built-in.
  const waitingForFonts = Platform.OS !== 'ios' && !fontsLoaded
  const ready = !isHydrating && !waitingForFonts && !themeHydrating && !localeHydrating

  const [showSplash, setShowSplash] = useState(true)
  const splashOpacity = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (!ready) return
    // Mount children first, then on the next frame fade the splash out.
    // 380ms cubic-out reads as deliberate without feeling slow.
    const id = requestAnimationFrame(() => {
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setShowSplash(false)
      })
    })
    return () => cancelAnimationFrame(id)
  }, [ready, splashOpacity])

  return (
    <View style={styles.root}>
      {ready ? children : null}
      {showSplash ? (
        <Animated.View
          pointerEvents={ready ? 'none' : 'auto'}
          style={[StyleSheet.absoluteFill, { opacity: splashOpacity }]}
        >
          <LinearGradient
            colors={[c.brandSurface, c.background, c.background]}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
          {/* SafeAreaView centers the brand+spinner group within the
              visible safe area (excluding status bar / home indicator), so
              the visual center matches what the user expects regardless of
              notch / system gesture inset. The brand and the spinner sit
              in the same column with a tight gap, reading as one unified
              loading state rather than two disconnected pieces. */}
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.group}>
              <Brand variant="full" size={160} />
              <ActivityIndicator
                style={styles.spinner}
                color={c.brand as string}
                size="small"
              />
            </View>
          </SafeAreaView>
        </Animated.View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The brand image + spinner form a vertical column that's centered as a
  // whole within the safe area. Tight gap (24px) keeps them visually
  // related instead of feeling like two separate elements at opposite
  // ends of the screen.
  group: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  spinner: {
    // marginTop already covered by the parent `gap`. Kept as a style hook
    // in case future tweaks want a different offset just for the spinner.
  },
})
