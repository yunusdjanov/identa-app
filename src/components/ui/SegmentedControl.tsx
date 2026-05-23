import React, { useMemo } from 'react'
import { View, Pressable, Text, StyleSheet, Animated } from 'react-native'
import * as Haptics from 'expo-haptics'
import { radius, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

interface Option<T extends string> {
  value: T
  label: string
}

interface Props<T extends string> {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
}

// iOS UISegmentedControl-style pill. Animated thumb glides between segments.
export default function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value))
  const thumbAnim = React.useRef(new Animated.Value(activeIndex)).current
  const [trackWidth, setTrackWidth] = React.useState(0)

  React.useEffect(() => {
    Animated.spring(thumbAnim, {
      toValue: activeIndex,
      useNativeDriver: false,
      speed: 18,
      bounciness: 4,
    }).start()
  }, [activeIndex, thumbAnim])

  const segmentWidth = trackWidth > 0 ? (trackWidth - 4) / options.length : 0

  return (
    <View
      style={styles.track}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      {trackWidth > 0 ? (
        <Animated.View
          style={[
            styles.thumb,
            {
              width: segmentWidth,
              transform: [
                {
                  translateX: thumbAnim.interpolate({
                    inputRange: options.map((_, i) => i),
                    outputRange: options.map((_, i) => i * segmentWidth),
                  }),
                },
              ],
            },
          ]}
        />
      ) : null}

      {options.map((option) => {
        const isActive = option.value === value
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              Haptics.selectionAsync()
              onChange(option.value)
            }}
            style={styles.segment}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              style={[styles.label, isActive && styles.labelActive]}
            >
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    track: {
      flexDirection: 'row',
      backgroundColor: c.fillQuaternary,
      borderRadius: radius.md,
      padding: 2,
      height: 30,
    },
    thumb: {
      position: 'absolute',
      top: 2,
      bottom: 2,
      left: 2,
      backgroundColor: c.background,
      borderRadius: radius.sm,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
    },
    segment: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
      zIndex: 1,
    },
    label: {
      fontFamily: font('600'),
      fontSize: 12,
      fontWeight: '600',
      color: c.labelSecondary,
      letterSpacing: 0,
    },
    labelActive: {
      color: c.label,
    },
  })
}
