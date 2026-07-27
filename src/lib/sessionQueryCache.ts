import AsyncStorage from '@react-native-async-storage/async-storage'

const LEGACY_PROTECTED_QUERY_CACHE_KEYS = [
  '@identa/query-cache-v1',
  '@identa/query-cache-v2',
  '@identa/query-cache-v3',
  '@identa/query-cache-v4',
]

let clearQueryCache: (() => void) | null = null

export function bindSessionQueryCache(clearer: (() => void) | null): void {
  clearQueryCache = clearer
}

export function clearSessionQueryCache(): void {
  clearQueryCache?.()
}

export async function purgeLegacyProtectedQueryCaches(): Promise<void> {
  await AsyncStorage.multiRemove(LEGACY_PROTECTED_QUERY_CACHE_KEYS)
}
