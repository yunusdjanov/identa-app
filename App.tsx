import 'react-native-gesture-handler'
import React from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClient, MutationCache } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { StatusBar } from 'expo-status-bar'
import Navigation from './src/navigation'
import { I18nProvider } from './src/i18n'
import { ToastProvider, getGlobalToast } from './src/components/ui/Toast'
import SplashGate from './src/components/ui/SplashGate'
import NetworkBanner from './src/components/ui/NetworkBanner'
import { isOfflineError } from './src/lib/offlineGuard'
import { translations } from './src/i18n/translations'
import { getCurrentLocale } from './src/lib/currentLocale'
import { initSentry, wrapApp } from './src/lib/sentry'
import { checkAndDownloadUpdate } from './src/lib/otaUpdates'

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

// gcTime is bumped well past staleTime so cached data survives long enough
// to act as the offline fallback. Without this the persister would prune
// entries before the user comes back online.
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
      gcTime: 24 * 60 * 60 * 1000, // 1 day — covers an overnight offline session
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
    mutations: {
      retry: false,
    },
  },
})

// Persists the React Query cache to AsyncStorage so the user sees the last
// known state instantly on cold start — and so cached lists keep rendering
// when the network drops. Mutations are NOT persisted; only queries.
// NOTE on cache key version: bump the `-vN` suffix any time a backend
// response mapper changes shape (e.g. casing fix in src/api/dashboard.ts).
// Without bumping, users with persisted cache from a previous app version
// hydrate stale rows — the most painful example is the dashboard cards
// showing "не число" because the old cached snapshot was mapped while
// snake/camel mismatch was still bugged.
const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: '@identa/query-cache-v2',
  // Cache JSON can grow as patients/appointments accumulate. Bump throttle
  // so writes stay batched instead of firing on every query update.
  throttleTime: 1500,
})

function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister,
            maxAge: 24 * 60 * 60 * 1000,
            // Only persist successful query state — failed/pending entries
            // shouldn't be revived on next launch.
            dehydrateOptions: {
              shouldDehydrateQuery: (q) => q.state.status === 'success',
            },
          }}
        >
          <I18nProvider>
            <ToastProvider>
              <StatusBar style="auto" />
              <SplashGate>
                <Navigation />
              </SplashGate>
              <NetworkBanner />
            </ToastProvider>
          </I18nProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

// Sentry.wrap auto-instruments the root with an error boundary that
// captures any uncaught render-tree error before React Native's red box.
// Pass-through component when Sentry isn't initialized (no DSN).
export default wrapApp(App)
