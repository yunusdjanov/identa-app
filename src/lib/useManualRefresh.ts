import { useCallback, useEffect, useRef, useState } from 'react'

type RefreshAction = () => Promise<unknown> | unknown

/**
 * Keeps the native pull-to-refresh indicator tied to an explicit user gesture.
 *
 * React Query's `isFetching` / `isRefetching` also cover filter changes,
 * cache invalidation and focus refetches. Feeding those states directly into
 * RefreshControl makes a spinner appear even when the user did not pull.
 */
export function useManualRefresh(refreshAction: RefreshAction) {
  const actionRef = useRef(refreshAction)
  const activeRefreshRef = useRef<Promise<void> | null>(null)
  const mountedRef = useRef(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  actionRef.current = refreshAction

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const onRefresh = useCallback(() => {
    if (activeRefreshRef.current) return activeRefreshRef.current

    setIsRefreshing(true)
    const refresh = Promise.resolve()
      .then(() => actionRef.current())
      .then(() => undefined)
      .finally(() => {
        activeRefreshRef.current = null
        if (mountedRef.current) setIsRefreshing(false)
      })

    activeRefreshRef.current = refresh
    return refresh
  }, [])

  return { isRefreshing, onRefresh }
}
