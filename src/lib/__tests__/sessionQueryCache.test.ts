import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  bindSessionQueryCache,
  clearSessionQueryCache,
  purgeLegacyProtectedQueryCaches,
} from '../sessionQueryCache'

describe('session query cache boundary', () => {
  afterEach(() => {
    bindSessionQueryCache(null)
  })

  it('clears the registered in-memory query client', () => {
    const clear = jest.fn()
    bindSessionQueryCache(clear)

    clearSessionQueryCache()

    expect(clear).toHaveBeenCalledTimes(1)
  })

  it('removes every legacy protected query cache key', async () => {
    await purgeLegacyProtectedQueryCaches()

    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
      '@identa/query-cache-v1',
      '@identa/query-cache-v2',
      '@identa/query-cache-v3',
      '@identa/query-cache-v4',
    ])
  })
})
