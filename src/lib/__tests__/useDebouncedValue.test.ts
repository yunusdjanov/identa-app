/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react-native'
import { useDebouncedValue } from '../useDebouncedValue'

describe('useDebouncedValue', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('initial', 250))
    expect(result.current).toBe('initial')
  })

  it('debounces value updates by the configured delay', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 250),
      { initialProps: { value: 'a' } }
    )

    rerender({ value: 'ab' })
    expect(result.current).toBe('a') // not yet propagated

    act(() => {
      jest.advanceTimersByTime(249)
    })
    expect(result.current).toBe('a') // still pending

    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(result.current).toBe('ab') // now propagated
  })

  it('resets the timer when the value changes mid-debounce (typing pattern)', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 200),
      { initialProps: { value: '' } }
    )

    rerender({ value: 'T' })
    act(() => { jest.advanceTimersByTime(150) })
    rerender({ value: 'Te' })
    act(() => { jest.advanceTimersByTime(150) })
    // 300ms elapsed but only 150ms since last change → still debouncing
    expect(result.current).toBe('')

    act(() => { jest.advanceTimersByTime(60) })
    expect(result.current).toBe('Te')
  })
})
