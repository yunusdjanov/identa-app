import React, { useEffect, useRef } from 'react'
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native'

interface Props {
  // Index in the list. Used to stagger the entrance so rows cascade in
  // rather than popping all at once.
  index: number
  // Cap the cascade so the 30th row doesn't have to wait 1.5s before
  // appearing. After this point all later rows share the same delay.
  maxStaggeredIndex?: number
  delayPerItem?: number
  duration?: number
  style?: StyleProp<ViewStyle>
  children: React.ReactNode
}

// Cascading fade + slight upward slide for list rows. Each item starts a
// few pixels below and translucent, then animates into place. Designed for
// FlatList / SectionList renderItem.
export default function FadeInRow({
  index,
  maxStaggeredIndex = 8,
  delayPerItem = 35,
  duration = 320,
  style,
  children,
}: Props) {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(8)).current

  useEffect(() => {
    const stagger = Math.min(index, maxStaggeredIndex) * delayPerItem
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay: stagger,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay: stagger,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ])
    anim.start()
    return () => {
      anim.stop()
    }
    // Index changes shouldn't restart the animation when FlatList recycles
    // rows; the row appearing visually is what matters, not the index value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  )
}
