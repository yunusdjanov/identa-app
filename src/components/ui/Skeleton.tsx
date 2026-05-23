import React, { useEffect, useMemo, useRef } from 'react'
import { Animated, Easing, StyleSheet, View, ViewStyle, StyleProp } from 'react-native'
import { radius } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

interface SkeletonProps {
  width?: number | `${number}%`
  height?: number
  borderRadius?: number
  style?: StyleProp<ViewStyle>
}

// Soft pulse animation. Cheaper than a shimmer translation and reads as
// "loading" without distracting motion.
export function Skeleton({ width, height = 14, borderRadius = 6, style }: SkeletonProps) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const opacity = useRef(new Animated.Value(0.5)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [opacity])

  return (
    <Animated.View
      style={[
        styles.base,
        {
          width: width as any,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  )
}

// Prebuilt skeleton for a list row with avatar + 2 lines + trailing chip.
export function ListRowSkeleton() {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  return (
    <View style={styles.rowWrap}>
      <Skeleton width={42} height={42} borderRadius={21} />
      <View style={styles.rowText}>
        <Skeleton width="55%" height={14} />
        <Skeleton width="35%" height={11} />
      </View>
      <Skeleton width={48} height={20} borderRadius={10} />
    </View>
  )
}

// Prebuilt skeleton for a stat / finance card.
export function StatCardSkeleton() {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  return (
    <View style={styles.statCard}>
      <Skeleton width={28} height={28} borderRadius={8} />
      <Skeleton width="60%" height={12} style={{ marginTop: 12 }} />
      <Skeleton width="80%" height={22} style={{ marginTop: 8 }} />
    </View>
  )
}

// Prebuilt skeleton for a hero "today" card.
export function HeroCardSkeleton() {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  return (
    <View style={styles.heroCard}>
      <Skeleton width={40} height={40} borderRadius={12} />
      <View style={styles.heroText}>
        <Skeleton width="35%" height={12} />
        <Skeleton width="60%" height={24} style={{ marginTop: 10 }} />
        <Skeleton width="80%" height={14} style={{ marginTop: 8 }} />
      </View>
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    base: {
      // Brand-tinted shimmer surface — subtler than plain gray and ties
      // loading state to the rest of the app's identity.
      backgroundColor: c.brandLight,
    },
    rowWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    rowText: {
      flex: 1,
      gap: 8,
    },
    statCard: {
      flex: 1,
      backgroundColor: c.background,
      padding: 14,
      borderRadius: radius.xl,
      minHeight: 110,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    heroCard: {
      flexDirection: 'row',
      gap: 14,
      backgroundColor: c.background,
      padding: 16,
      borderRadius: radius.xxl,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
    },
    heroText: {
      flex: 1,
    },
  })
}

export default Skeleton
