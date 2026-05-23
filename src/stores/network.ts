import { create } from 'zustand'
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'

interface NetworkState {
  // True when the device has an active network connection that can reach
  // the public internet. False during airplane mode, Wi-Fi without internet,
  // or any time fetch would fail at the link layer.
  isOnline: boolean
  // Last time the connection state flipped — used to debounce flicker.
  lastChangeAt: number
  _apply: (s: NetInfoState) => void
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isOnline: true,
  lastChangeAt: Date.now(),
  _apply: (s) => {
    const next = Boolean(s.isConnected && (s.isInternetReachable ?? true))
    set((curr) =>
      curr.isOnline === next
        ? curr
        : { isOnline: next, lastChangeAt: Date.now() }
    )
  },
}))

// Subscribe once at module load. NetInfo fires on connection change and
// when isInternetReachable is determined (a beat after isConnected).
NetInfo.addEventListener((s) => {
  useNetworkStore.getState()._apply(s)
})

// Prime the initial value so the banner doesn't flicker on cold start.
NetInfo.fetch().then((s) => useNetworkStore.getState()._apply(s)).catch(() => {})
