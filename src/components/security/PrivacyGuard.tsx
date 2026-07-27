import React, { useEffect, useState } from 'react'
import {
  AppState,
  Platform,
  StyleSheet,
  Text,
  View,
  type AppStateStatus,
} from 'react-native'
import * as ScreenCapture from 'expo-screen-capture'

import { useAuthStore } from '../../stores/auth'
import { font } from '../../constants/theme'

const SCREEN_CAPTURE_KEY = 'identa-clinical-data'

function ProductionCaptureBlocker() {
  ScreenCapture.usePreventScreenCapture(SCREEN_CAPTURE_KEY)
  return null
}

/**
 * Keeps patient data out of app-switcher snapshots and production screen
 * captures. The JS curtain is immediate and cross-platform; the native Expo
 * protection covers the OS-level snapshot/capture paths that React cannot.
 */
export default function PrivacyGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState)

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState)
    return () => subscription.remove()
  }, [])

  useEffect(() => {
    if (Platform.OS !== 'ios') return

    if (isAuthenticated) {
      void ScreenCapture.enableAppSwitcherProtectionAsync(0.9).catch(() => {})
    } else {
      void ScreenCapture.disableAppSwitcherProtectionAsync().catch(() => {})
    }

    return () => {
      void ScreenCapture.disableAppSwitcherProtectionAsync().catch(() => {})
    }
  }, [isAuthenticated])

  const shouldHideContent = isAuthenticated && appState !== 'active'
  const shouldBlockCapture =
    isAuthenticated && !__DEV__ && Platform.OS !== 'web'

  return (
    <View style={styles.root}>
      {children}
      {shouldBlockCapture ? <ProductionCaptureBlocker /> : null}
      {shouldHideContent ? (
        <View
          style={styles.curtain}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          testID="privacy-curtain"
        >
          <View style={styles.mark}>
            <Text style={styles.markText}>I</Text>
          </View>
          <Text style={styles.title}>Identa</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  curtain: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10_000,
    elevation: 10_000,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#F0FAF8',
  },
  mark: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14B8A6',
  },
  markText: {
    fontFamily: font('800'),
    fontSize: 25,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  title: {
    fontFamily: font('700'),
    fontSize: 18,
    fontWeight: '700',
    color: '#153B3A',
  },
})
