import 'react-native-gesture-handler'
import React from 'react'
import { AppState } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import {
  QueryClient,
  QueryClientProvider,
  MutationCache,
  focusManager,
  onlineManager,
} from '@tanstack/react-query'
import NetInfo from '@react-native-community/netinfo'
import { StatusBar } from 'expo-status-bar'
import Navigation from './src/navigation'
import { I18nProvider } from './src/i18n'
import { ToastProvider, getGlobalToast } from './src/components/ui/Toast'
import { DialogProvider } from './src/components/ui/Dialog'
import SplashGate from './src/components/ui/SplashGate'
import NetworkBanner from './src/components/ui/NetworkBanner'
import { isOfflineError } from './src/lib/offlineGuard'
import { translations } from './src/i18n/translations'
import { getCurrentLocale } from './src/lib/currentLocale'
import { initSentry, wrapApp } from './src/lib/sentry'
import { checkAndDownloadUpdate } from './src/lib/otaUpdates'
import PrivacyGuard from './src/components/security/PrivacyGuard'
import {
  bindSessionQueryCache,
  purgeLegacyProtectedQueryCaches,
} from './src/lib/sessionQueryCache'

// Initialize Sentry at module load — earlier than any React component
// renders so even cold-start errors get captured. No-op if
// EXPO_PUBLIC_SENTRY_DSN isn't set (dev / first-time-running scenarios).
initSentry()

// Fire-and-forget OTA check. No-op in Expo Go / dev builds (Updates.isEnabled
// is false there). When a new bundle is available it downloads in the
// background and goes live on the next cold start — no mid-session restart.
checkAndDownloadUpdate().catch(() => {
  // checkAndDownloadUpdate already routes errors to Sentry; swallow here so
  // a flaky network on boot doesn't surface a red box.
})

focusManager.setEventListener((setFocused) => {
  const subscription = AppState.addEventListener('change', (state) => {
    setFocused(state === 'active')
  })

  return () => subscription.remove()
})

onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(Boolean(state.isConnected && (state.isInternetReachable ?? true)))
  })
)

// gcTime is bumped well past staleTime so in-memory data can act as a short
// offline fallback during the current authenticated session.
//
// The mutation cache intercepts offline-tagged errors and shows a unified
// "no internet" toast, so individual mutation handlers don't have to
// detect offline state themselves.
const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error) => {
      if (isOfflineError(error)) {
        const toast = getGlobalToast()
        const locale = getCurrentLocale()
        const dict = translations[locale] as any
        const message: string =
          dict?.network?.offlineMutation ?? 'No internet. Changes are disabled.'
        toast?.warning(message)
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
    },
  },
})

bindSessionQueryCache(() => queryClient.clear())
purgeLegacyProtectedQueryCaches().catch(() => {
  // Best-effort migration cleanup. New builds never hydrate these keys.
})

function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PrivacyGuard>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <I18nProvider>
              <ToastProvider>
                <DialogProvider>
                  <StatusBar style="dark" />
                  <SplashGate>
                    <Navigation />
                  </SplashGate>
                  <NetworkBanner />
                </DialogProvider>
              </ToastProvider>
            </I18nProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </PrivacyGuard>
    </GestureHandlerRootView>
  )
}

// Sentry.wrap auto-instruments the root with an error boundary that
// captures any uncaught render-tree error before React Native's red box.
// Pass-through component when Sentry isn't initialized (no DSN).
export default wrapApp(App)
