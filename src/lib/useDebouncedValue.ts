import { useEffect, useState } from 'react'

// Tiny debounce hook. Returns a value that lags `value` by `delay` ms.
// Used to throttle search-as-you-type so each keystroke doesn't fire a query.
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])

  return debounced
}
