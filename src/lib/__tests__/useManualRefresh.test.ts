import { act, renderHook } from '@testing-library/react-native'

import { useManualRefresh } from '../useManualRefresh'

describe('useManualRefresh', () => {
  it('shows refreshing only for an explicitly requested refresh', async () => {
    let finishRefresh: (() => void) | undefined
    const refreshAction = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finishRefresh = resolve
        })
    )
    const { result } = renderHook(() => useManualRefresh(refreshAction))

    expect(result.current.isRefreshing).toBe(false)

    let refreshPromise: Promise<void> | undefined
    act(() => {
      refreshPromise = result.current.onRefresh()
    })

    expect(result.current.isRefreshing).toBe(true)
    expect(refreshAction).toHaveBeenCalledTimes(0)

    await act(async () => {
      await Promise.resolve()
    })
    expect(refreshAction).toHaveBeenCalledTimes(1)

    await act(async () => {
      finishRefresh?.()
      await refreshPromise
    })

    expect(result.current.isRefreshing).toBe(false)
  })

  it('coalesces repeated pulls while a refresh is already running', async () => {
    let finishRefresh: (() => void) | undefined
    const refreshAction = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finishRefresh = resolve
        })
    )
    const { result } = renderHook(() => useManualRefresh(refreshAction))

    let firstRefresh: Promise<void> | undefined
    let secondRefresh: Promise<void> | undefined
    act(() => {
      firstRefresh = result.current.onRefresh()
      secondRefresh = result.current.onRefresh()
    })

    expect(firstRefresh).toBe(secondRefresh)

    await act(async () => {
      await Promise.resolve()
    })
    expect(refreshAction).toHaveBeenCalledTimes(1)

    await act(async () => {
      finishRefresh?.()
      await firstRefresh
    })
  })
})
