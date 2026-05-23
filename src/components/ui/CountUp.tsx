import React, { useEffect, useRef, useState } from 'react'
import { Text, TextProps } from 'react-native'

interface Props extends Omit<TextProps, 'children'> {
  value: number
  duration?: number
  // Formats the in-flight numeric value into the string shown to the user.
  // Receives the current animated value (not the target) on each frame.
  format: (n: number) => string
}

// Animated number that counts from its previous render value up to the new
// target whenever `value` changes. Cubic ease-out so the last frames feel
// like a graceful settle, matching the Apple Health style finance counters.
export default function CountUp({ value, duration = 900, format, ...rest }: Props) {
  const [display, setDisplay] = useState<number>(value)
  const rafRef = useRef<number | null>(null)
  const startValueRef = useRef<number>(value)
  const startTimeRef = useRef<number | null>(null)

  useEffect(() => {
    // Snapshot the current display value as the animation's starting point
    // so re-entrant updates blend smoothly instead of snapping back to zero.
    startValueRef.current = display
    startTimeRef.current = null
    const target = value

    const tick = (now: number) => {
      if (startTimeRef.current === null) startTimeRef.current = now
      const elapsed = now - startTimeRef.current
      const t = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      const current = startValueRef.current + (target - startValueRef.current) * eased
      setDisplay(current)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        // Snap to the exact target so floating-point drift never leaves a
        // half-pixel value visible at rest.
        setDisplay(target)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
    // We intentionally exclude `display` so a state update inside the effect
    // doesn't restart the animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration])

  return <Text {...rest}>{format(display)}</Text>
}
