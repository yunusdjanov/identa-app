import { OfflineError, isOfflineError, requireOnline } from '../offlineGuard'
import { useNetworkStore } from '../../stores/network'

describe('OfflineError', () => {
  it('isOfflineError → true on an OfflineError instance', () => {
    expect(isOfflineError(new OfflineError())).toBe(true)
  })

  it('isOfflineError → false on a plain Error', () => {
    expect(isOfflineError(new Error('boom'))).toBe(false)
  })

  it('isOfflineError → false on non-error values', () => {
    expect(isOfflineError(null)).toBe(false)
    expect(isOfflineError(undefined)).toBe(false)
    expect(isOfflineError('offline')).toBe(false)
  })
})

describe('requireOnline', () => {
  // The store has a real (non-mocked) implementation — flip its state
  // directly to test both branches.
  afterEach(() => {
    useNetworkStore.setState({ isOnline: true })
  })

  it('does nothing when isOnline is true', () => {
    useNetworkStore.setState({ isOnline: true })
    expect(() => requireOnline()).not.toThrow()
  })

  it('throws OfflineError when isOnline is false', () => {
    useNetworkStore.setState({ isOnline: false })
    expect(() => requireOnline()).toThrow(OfflineError)
  })
})
