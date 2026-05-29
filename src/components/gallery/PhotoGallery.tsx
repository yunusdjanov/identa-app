import React, { useMemo } from 'react'
import { View, Text, ScrollView, Pressable, Image, StyleSheet, ActivityIndicator } from 'react-native'
import Icon from '../ui/Icon'
import { useI18n } from '../../i18n'
import { spacing, radius, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

// Unified "photo to display" type. The gallery handles both
//  - already-uploaded backend images (kind='remote', carry an id + url)
//  - just-picked local images that are queued for upload (kind='local',
//    carry a file:// uri and an optional `uploading` flag that paints the
//    overlay spinner)
//
// We model them as one discriminated union so the gallery doesn't have to
// learn about either lifecycle stage — both render the same way.
export type GalleryPhoto =
  | {
      kind: 'remote'
      id: string
      url: string
      thumbnailUrl?: string | null
    }
  | {
      kind: 'local'
      // Stable key per local pick so React doesn't re-mount on reorder
      // (RN's Image is expensive to remount). Caller can use `Date.now()+i`.
      localId: string
      uri: string
      uploading?: boolean
      // Set when upload fails so the row can render a small retry chip.
      error?: boolean
    }

interface Props {
  photos: GalleryPhoto[]
  onPressAdd?: () => void
  onPressPhoto?: (index: number) => void
  onRemovePhoto?: (photo: GalleryPhoto) => void
  // Optional cap to show a "max reached" label and hide the add tile.
  maxPhotos?: number
  // Compact = smaller thumbnails (used in detail sheet preview), default =
  // standard size (used in create/edit form).
  size?: 'compact' | 'default'
  // Hides the surrounding header / hint text — useful when embedding inside
  // an already-titled section.
  bare?: boolean
}

export default function PhotoGallery({
  photos,
  onPressAdd,
  onPressPhoto,
  onRemovePhoto,
  maxPhotos,
  size = 'default',
  bare,
}: Props) {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c, size), [c, size])
  const reachedMax = maxPhotos !== undefined && photos.length >= maxPhotos
  const canAdd = !!onPressAdd && !reachedMax

  return (
    <View style={styles.wrap}>
      {!bare ? (
        <View style={styles.header}>
          <Text style={styles.title}>{t('gallery.title')}</Text>
          {maxPhotos !== undefined ? (
            <Text style={styles.counter}>
              {photos.length}/{maxPhotos}
            </Text>
          ) : null}
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {canAdd ? (
          <Pressable style={styles.addTile} onPress={onPressAdd} accessibilityRole="button">
            <Icon name="add" size={size === 'compact' ? 24 : 28} color={c.brand as string} />
            <Text style={styles.addLabel}>{t('gallery.add')}</Text>
          </Pressable>
        ) : null}

        {photos.map((p, idx) => {
          const uri = p.kind === 'remote' ? (p.thumbnailUrl ?? p.url) : p.uri
          const key = p.kind === 'remote' ? p.id : p.localId
          return (
            <View key={key} style={styles.thumbWrap}>
              <Pressable
                style={styles.thumb}
                onPress={() => onPressPhoto?.(idx)}
                accessibilityRole="button"
                testID={`gallery-thumb-${idx}`}
              >
                <Image
                  source={{ uri }}
                  style={styles.thumbImg}
                  // Cap memory on big originals; the FlatList in the lightbox
                  // shows the high-res version when the user actually opens it.
                  resizeMode="cover"
                />
                {p.kind === 'local' && p.uploading ? (
                  <View style={styles.overlay}>
                    <ActivityIndicator color="#FFFFFF" />
                  </View>
                ) : null}
                {p.kind === 'local' && p.error ? (
                  <View style={[styles.overlay, styles.errorOverlay]}>
                    <Icon name="alert-circle" size={20} color="#FFFFFF" />
                  </View>
                ) : null}
              </Pressable>
              {onRemovePhoto ? (
                <Pressable
                  style={styles.removeBtn}
                  onPress={() => onRemovePhoto(p)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={t('gallery.remove')}
                >
                  <Icon name="close" size={14} color="#FFFFFF" />
                </Pressable>
              ) : null}
            </View>
          )
        })}

        {photos.length === 0 && !canAdd ? (
          <View style={styles.emptyPlaceholder}>
            <Icon name="images-outline" size={20} color={c.labelTertiary as string} />
            <Text style={styles.emptyText}>{t('gallery.empty')}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}

function makeStyles(c: Colors, size: 'compact' | 'default') {
  const tile = size === 'compact' ? 64 : 88
  return StyleSheet.create({
    wrap: {
      gap: spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    title: {
      ...typography.subheadBold,
      fontFamily: font('600'),
      color: c.label,
    },
    counter: {
      ...typography.caption1,
      color: c.labelSecondary as string,
    },
    scrollContent: {
      gap: spacing.sm,
      paddingRight: spacing.sm,
      alignItems: 'center',
    },
    addTile: {
      width: tile,
      height: tile,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: c.brand,
      borderStyle: 'dashed',
      backgroundColor: c.brandLight,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    addLabel: {
      ...typography.caption2,
      fontFamily: font('600'),
      color: c.brand as string,
    },
    thumbWrap: {
      position: 'relative',
    },
    thumb: {
      width: tile,
      height: tile,
      borderRadius: radius.md,
      overflow: 'hidden',
      backgroundColor: c.fillQuaternary,
    },
    thumbImg: {
      width: '100%',
      height: '100%',
    },
    overlay: {
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorOverlay: {
      backgroundColor: 'rgba(220,38,38,0.7)',
    },
    removeBtn: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: 'rgba(0,0,0,0.75)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyPlaceholder: {
      height: tile,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    emptyText: {
      ...typography.footnote,
      color: c.labelSecondary as string,
    },
  })
}
