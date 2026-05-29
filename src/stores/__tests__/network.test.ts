import { useNetworkStore } from '../network'

describe('useNetworkStore._apply', () => {
  beforeEach(() => {
    useNetworkStore.setState({ isOnline: true, lastChangeAt: 0 } as any)
  })

  it('flips to offline when isConnected is false', () => {
    useNetworkStore.getState()._apply({ isConnected: false, isInternetReachable: null } as any)
    expect(useNetworkStore.getState().isOnline).toBe(false)
  })

  it('flips to offline when connected but internet is unreachable', () => {
    useNetworkStore.getState()._apply({
      isConnected: true,
      isInternetReachable: false,
    } as any)
    expect(useNetworkStore.getState().isOnline).toBe(false)
  })

  it('stays online when isInternetReachable is null (treat as true)', () => {
    // RN's NetInfo on iOS can transiently return null for isInternetReachable
    // before the probe completes; defaulting to "online" avoids a flicker.
    useNetworkStore.getState()._apply({
      isConnected: true,
      isInternetReachable: null,
    } as any)
    expect(useNetworkStore.getState().isOnline).toBe(true)
  })

  it('updates lastChangeAt only on actual flips (debounce)', () => {
    const before = useNetworkStore.getState().lastChangeAt
    // Same state — no flip → timestamp unchanged.
    useNetworkStore.getState()._apply({ isConnected: true, isInternetReachable: true } as any)
    expect(useNetworkStore.getState().lastChangeAt).toBe(before)
    // Real flip — timestamp moves forward.
    useNetworkStore.getState()._apply({ isConnected: false, isInternetReachable: null } as any)
    expect(useNetworkStore.getState().lastChangeAt).toBeGreaterThan(before)
  })
})
