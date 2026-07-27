import React, { useRef } from 'react'
import { Animated, PanResponder, StyleSheet, ViewStyle, StyleProp } from 'react-native'

interface Props {
  children: React.ReactNode
  onSwipeLeft: () => void   // → next week
  onSwipeRight: () => void  // ← previous week
  style?: StyleProp<ViewStyle>
}

const SWIPE_THRESHOLD = 60
const DIRECTION_RATIO = 1.4

// Wraps content with a horizontal swipe gesture: a confirmed left/right
// pan triggers onSwipeLeft / onSwipeRight (week navigation). Vertical
// scroll inside children still works — we only claim horizontal pans that
// are clearly horizontal (dx > dy * DIRECTION_RATIO).
export default function SwipeableWeek({ children, onSwipeLeft, onSwipeRight, style }: Props) {
  const translateX = useRef(new Animated.Value(0)).current

  // IMPORTANT — driver consistency:
  // `Animated.event` from the pan responder writes to `translateX` via
  // the JS driver (PanResponder requires JS-side `dx` access). If the
  // follow-up timing animation uses `useNativeDriver: true`, RN will
  // accept it but the native and JS sides of the value diverge — once
  // the timing reaches -300 in native land, `setValue(0)` only updates
  // the JS copy and the next render still paints at translateX=-300.
  // That's the "appointments not visible after swipe" bug. Keeping all
  // writes on the JS driver avoids the divergence at the cost of a
  // ~negligible amount of frame work for a 180ms transform.

  const reset = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: false,
      speed: 18,
      bounciness: 5,
    }).start()
  }

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => {
        return (
          Math.abs(g.dx) > 12 &&
          Math.abs(g.dx) > Math.abs(g.dy) * DIRECTION_RATIO
        )
      },
      onPanResponderMove: Animated.event([null, { dx: translateX }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_e, g) => {
        if (g.dx <= -SWIPE_THRESHOLD) {
          Animated.timing(translateX, {
            toValue: -300,
            duration: 180,
            useNativeDriver: false,
          }).start(() => {
            // Reset to 0 FIRST so the next render of the swapped content
            // never paints at the off-screen position; then dispatch the
            // navigation callback that re-mounts the content.
            translateX.setValue(0)
            onSwipeLeft()
          })
        } else if (g.dx >= SWIPE_THRESHOLD) {
          Animated.timing(translateX, {
            toValue: 300,
            duration: 180,
            useNativeDriver: false,
          }).start(() => {
            translateX.setValue(0)
            onSwipeRight()
          })
        } else {
          reset()
        }
      },
      onPanResponderTerminate: reset,
    })
  ).current

  return (
    <Animated.View
      {...responder.panHandlers}
      style={[styles.wrap, style, { transform: [{ translateX }] }]}
    >
      {children}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
})
