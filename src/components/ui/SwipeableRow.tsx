import React, { useMemo, useRef } from 'react'
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native'
import Swipeable from 'react-native-gesture-handler/Swipeable'
import * as Haptics from 'expo-haptics'

import Icon, { IconName } from './Icon'
import { font, radius } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

export interface SwipeAction {
  key: string
  label: string
  iconName: IconName
  // Color for the action background. Used as-is (no theme remap) so red stays
  // red etc. — matches iOS conventions for swipe actions.
  bg: string
  onPress: () => void
}

interface Props {
  children: React.ReactNode
  // Actions revealed on left-swipe (from the right edge).
  rightActions?: SwipeAction[]
  // Actions revealed on right-swipe (from the left edge).
  leftActions?: SwipeAction[]
  // Closes automatically after an action is tapped.
  closeOnAction?: boolean
}

// iOS-style swipeable row. Wraps any child and reveals contextual action
// buttons when the user swipes horizontally. Light haptic on each action
// tap. Closes automatically after a tap so the row resets to its resting
// state.
export default function SwipeableRow({
  children,
  rightActions,
  leftActions,
  closeOnAction = true,
}: Props) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const ref = useRef<Swipeable>(null)

  const handlePress = (action: SwipeAction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    action.onPress()
    if (closeOnAction) ref.current?.close()
  }

  const renderActions = (actions: SwipeAction[], side: 'right' | 'left') => {
    return (progress: Animated.AnimatedInterpolation<number>) => {
      const total = actions.length * 76
      return (
        <View style={[styles.actionsRow, side === 'left' && { flexDirection: 'row-reverse' }]}>
          {actions.map((action, i) => {
            // Stagger the action buttons so they slide in with a slight
            // cascade as the user drags further.
            const trans = progress.interpolate({
              inputRange: [0, 1],
              outputRange: [side === 'right' ? total : -total, 0],
            })
            return (
              <Animated.View
                key={action.key}
                style={{ transform: [{ translateX: trans }] }}
              >
                <Pressable
                  onPress={() => handlePress(action)}
                  style={[styles.actionBtn, { backgroundColor: action.bg }]}
                >
                  <Icon name={action.iconName} size={20} color="#FFFFFF" />
                  <Text style={styles.actionLabel} numberOfLines={1}>
                    {action.label}
                  </Text>
                </Pressable>
              </Animated.View>
            )
          })}
        </View>
      )
    }
  }

  return (
    <Swipeable
      ref={ref}
      friction={2}
      overshootRight={false}
      overshootLeft={false}
      rightThreshold={40}
      leftThreshold={40}
      renderRightActions={rightActions ? renderActions(rightActions, 'right') : undefined}
      renderLeftActions={leftActions ? renderActions(leftActions, 'left') : undefined}
      onSwipeableWillOpen={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      }}
    >
      {children}
    </Swipeable>
  )
}

function makeStyles(_c: Colors) {
  return StyleSheet.create({
    actionsRow: {
      flexDirection: 'row',
      height: '100%',
    },
    actionBtn: {
      width: 76,
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingHorizontal: 8,
    },
    actionLabel: {
      fontFamily: font('700'),
      fontSize: 11,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: 0.2,
    },
  })
}
