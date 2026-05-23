import * as Updates from 'expo-updates'
import { captureError } from './sentry'

// Over-the-air bundle update orchestrator.
//
// Lifecycle in production builds:
//   1) App boots, native code loads the cached JS bundle (instant launch)
//   2) `checkAndDownloadUpdate()` fires from App.tsx after first render
//   3) If a newer bundle is available, expo-updates downloads it in the
//      background. The user keeps using the current version.
//   4) On next cold start the new bundle is active. No mid-session restart
//      so the user never loses unsaved input.
//   5) Optional: caller-provided `onReady` hook can prompt the user to
//      restart now via `applyUpdateNow()`. The default UX is silent.
//
// Notes:
//   • Dev clients / Expo Go report `Updates.isEnabled === false` — every
//     call here becomes a no-op so dev sessions don't see noise.
//   • `runtimeVersion` in app.json gates compatibility: only bundles built
//     with the same runtime version can be downloaded over-the-air. Adding
//     a native module (new plugin, new permission) bumps appVersion which
//     bumps runtimeVersion which forces a full store build.

interface CheckOptions {
  onReady?: (info: { isNew: boolean }) => void
  onError?: (error: unknown) => void
}

let lastCheckAt = 0
const MIN_CHECK_INTERVAL_MS = 60_000 // throttle to once a minute max

export async function checkAndDownloadUpdate(options: CheckOptions = {}): Promise<void> {
  if (!Updates.isEnabled) return
  // Avoid hammering the update server when the app foregrounds rapidly.
  const now = Date.now()
  if (now - lastCheckAt < MIN_CHECK_INTERVAL_MS) return
  lastCheckAt = now

  try {
    const result = await Updates.checkForUpdateAsync()
    if (!result.isAvailable) {
      options.onReady?.({ isNew: false })
      return
    }
    await Updates.fetchUpdateAsync()
    // The new bundle is on disk; it'll be picked up on next cold start.
    options.onReady?.({ isNew: true })
  } catch (error) {
    // Network failures are normal (no connectivity, server hiccup) — Sentry
    // captures only because the categorical kind is unknown to us here. If
    // these turn out to be noisy in production we can guard with kind.
    captureError(error, { surface: 'ota_update_check' })
    options.onError?.(error)
  }
}

// Force-apply the cached bundle immediately. Use only when the user has
// explicitly asked to restart (e.g. tapping a "Restart to apply update"
// banner). NOT safe to call mid-session — any unsaved state is lost.
export async function applyUpdateNow(): Promise<void> {
  if (!Updates.isEnabled) return
  await Updates.reloadAsync()
}

// Hook-friendly status snapshot for a "current version" UI in Settings.
export function getCurrentUpdateInfo() {
  return {
    enabled: Updates.isEnabled,
    runtimeVersion: Updates.runtimeVersion,
    channel: Updates.channel,
    updateId: Updates.updateId,
    createdAt: Updates.createdAt,
  }
}
