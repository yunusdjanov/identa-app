import { useNetworkStore } from '../stores/network'

export class OfflineError extends Error {
  isOfflineError = true
  constructor() {
    super('OFFLINE')
    this.name = 'OfflineError'
  }
}

// Throws `OfflineError` if the device is currently offline. Call this at
// the top of any mutating API function (create/update/delete/record) so
// reads still work from cache while writes are blocked.
export function requireOnline(): void {
  if (!useNetworkStore.getState().isOnline) {
    throw new OfflineError()
  }
}

export function isOfflineError(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && (err as any).isOfflineError === true)
}
