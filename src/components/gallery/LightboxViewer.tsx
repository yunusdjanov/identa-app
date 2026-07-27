import React, { useMemo, useState, useRef, useCallback } from 'react'
import {
  Modal,
  View,
  Text,
  Pressable,
  Image,
  FlatList,
  StyleSheet,
  StatusBar,
  useWindowDimensions,
  type ViewToken,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Icon from '../ui/Icon'
import ProtectedPatientMediaImage from '../ui/ProtectedPatientMediaImage'
import { useI18n } from '../../i18n'
import { spacing, typography, font } from '../../constants/theme'

// Fullscreen pager for an array of image URIs. Built on FlatList + paging so
// we don't pull in a heavier carousel dependency.
//
// Design notes:
//   • Each page renders at full screen width/height with contain-fit so the
//     image keeps its aspect ratio (no cropping).
//   • Pinch-zoom isn't wired here — pulling in reanimated gesture handlers
//     for a v1 viewer was deemed not worth the complexity. Users can long
//     press → Share → open in Photos to inspect detail. Track a follow-up
//     in TASKS if the dentist team asks for in-app zoom.
//   • Index counter and close button sit over the image with a translucent
//     scrim so they stay legible on bright photos.

interface Props {
  visible: boolean
  uris: string[]
  startIndex?: number
  onClose: () => void
  // Optional caption rendered above the index counter — useful for "before"
  // / "after" / patient names when called from the patient timeline.
  caption?: string
  actionLabel?: string
  onAction?: () => void
  moreLabel?: string
  onMore?: () => void
  protectedPatientMedia?: boolean
}

export default function LightboxViewer({
  visible,
  uris,
  startIndex = 0,
  onClose,
  caption,
  actionLabel,
  onAction,
  moreLabel,
  onMore,
  protectedPatientMedia = false,
}: Props) {
  const { t } = useI18n()
  // Re-read dimensions every render via the hook so rotation, foldables,
  // and split-screen don't leave the pager pinned to the wrong width
  // (which would crop images and break paging offsets).
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions()
  const styles = useMemo(
    () => makeStyles(SCREEN_W, SCREEN_H),
    [SCREEN_W, SCREEN_H]
  )
  const listRef = useRef<FlatList<string>>(null)
  const [currentIndex, setCurrentIndex] = useState(startIndex)

  // When the modal becomes visible OR the start index changes, scroll the
  // list to the requested page. Use `requestAnimationFrame` so the list has
  // mounted before scrollToIndex runs (otherwise the call is a no-op).
  React.useEffect(() => {
    if (!visible) return
    setCurrentIndex(startIndex)
    const handle = requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: startIndex, animated: false })
    })
    return () => cancelAnimationFrame(handle)
  }, [visible, startIndex])

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0]
      if (first?.index != null) setCurrentIndex(first.index)
    }
  ).current

  // Fallback when the list reports an out-of-window scrollToIndex (race on
  // very fast double-mounts). Recovers by deferring to the next tick.
  const onScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      const wait = new Promise((resolve) => setTimeout(resolve, 80))
      wait.then(() => {
        listRef.current?.scrollToOffset({ offset: info.index * SCREEN_W, animated: false })
      })
    },
    [SCREEN_W]
  )

  // Pin currentIndex to match the actual scroll position on momentum end —
  // viewability sometimes fires late if a single image dominates the viewport.
  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W)
    if (idx !== currentIndex) setCurrentIndex(idx)
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
      // Black status bar background looks correct on iOS; on Android we
      // explicitly set the StatusBar color inside the modal below.
      statusBarTranslucent
    >
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <FlatList
          ref={listRef}
          data={uris}
          keyExtractor={(item, idx) => `${idx}-${item}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex}
          getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
          onScrollToIndexFailed={onScrollToIndexFailed}
          onViewableItemsChanged={onViewableItemsChanged}
          onMomentumScrollEnd={onMomentumScrollEnd}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          renderItem={({ item }) => (
            <View style={styles.page}>
              {protectedPatientMedia ? (
                <ProtectedPatientMediaImage
                  uri={item}
                  style={styles.image}
                  resizeMode="contain"
                />
              ) : (
                <Image source={{ uri: item }} style={styles.image} resizeMode="contain" />
              )}
            </View>
          )}
        />

        {/* Top overlay — close + counter + caption */}
        <SafeAreaView edges={['top']} style={styles.topBar} pointerEvents="box-none">
          <View style={styles.topBarInner}>
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Icon name="close" size={22} color="#FFFFFF" />
            </Pressable>
            <View style={styles.captionWrap}>
              {caption ? <Text style={styles.caption}>{caption}</Text> : null}
              {uris.length > 1 ? (
                <Text style={styles.counter}>
                  {currentIndex + 1} / {uris.length}
                </Text>
              ) : null}
            </View>
            {onMore ? (
              <Pressable
                onPress={onMore}
                style={styles.closeBtn}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={moreLabel ?? t('patients.actions.more')}
              >
                <Icon name="ellipsis-horizontal" size={21} color="#FFFFFF" />
              </Pressable>
            ) : (
              <View style={styles.spacer} />
            )}
          </View>
        </SafeAreaView>

        {actionLabel && onAction ? (
          <SafeAreaView edges={['bottom']} style={styles.bottomBar} pointerEvents="box-none">
            <Pressable
              onPress={onAction}
              style={styles.actionBtn}
              accessibilityRole="button"
              accessibilityLabel={actionLabel}
            >
              <Icon name="create-outline" size={18} color="#FFFFFF" />
              <Text style={styles.actionText}>{actionLabel}</Text>
            </Pressable>
          </SafeAreaView>
        ) : null}
      </View>
    </Modal>
  )
}

function makeStyles(screenW: number, screenH: number) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: '#000',
    },
    page: {
      width: screenW,
      height: screenH,
      justifyContent: 'center',
      alignItems: 'center',
    },
    image: {
      width: screenW,
      height: screenH,
    },
    topBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
    },
    topBarInner: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    captionWrap: {
      flex: 1,
      alignItems: 'center',
    },
    caption: {
      ...typography.subheadBold,
      fontFamily: font('600'),
      color: '#FFFFFF',
    },
    counter: {
      ...typography.footnote,
      color: 'rgba(255,255,255,0.85)',
      marginTop: 2,
    },
    spacer: {
      width: 36,
    },
    bottomBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    actionBtn: {
      minHeight: 44,
      paddingHorizontal: spacing.lg,
      borderRadius: 22,
      backgroundColor: 'rgba(20, 184, 166, 0.92)',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    actionText: {
      ...typography.subheadBold,
      fontFamily: font('600'),
      color: '#FFFFFF',
    },
  })
}
