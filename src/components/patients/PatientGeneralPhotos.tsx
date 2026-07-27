import React, { useMemo } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import Icon from '../ui/Icon'
import ProtectedPatientMediaImage from '../ui/ProtectedPatientMediaImage'
import { radius, spacing, typography, font } from '../../constants/theme'
import { useI18n } from '../../i18n'
import { useColors, type Colors } from '../../lib/useColors'
import type { ApiPatientClinicalPhoto } from '../../types'

export const PATIENT_GENERAL_PHOTO_LIMIT = 10
export const PATIENT_GENERAL_PHOTO_TILE_SIZE = 96

interface Props {
  photos: ApiPatientClinicalPhoto[]
  canManage: boolean
  manageDisabled?: boolean
  uploadingCount?: number
  busyPhotoId?: string | null
  onAdd: () => void
  onPressPhoto: (photo: ApiPatientClinicalPhoto) => void
}

export default function PatientGeneralPhotos({
  photos,
  canManage,
  manageDisabled,
  uploadingCount = 0,
  busyPhotoId,
  onAdd,
  onPressPhoto,
}: Props) {
  const { t } = useI18n()
  const c = useColors()
  // Match the 96px profile-photo frame so the patient summary and clinical
  // media use one visual scale. The fixed square rail also exposes more real
  // photos at once while preserving native horizontal scrolling.
  const styles = useMemo(() => makeStyles(c), [c])
  const ordered = useMemo(
    () => [...photos]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .slice(0, PATIENT_GENERAL_PHOTO_LIMIT),
    [photos]
  )
  const approvedCount = ordered.filter((photo) => photo.scan_status === 'approved').length
  const pendingTiles = Math.min(
    uploadingCount,
    PATIENT_GENERAL_PHOTO_LIMIT - ordered.length
  )
  const canAdd = canManage && !manageDisabled && ordered.length + pendingTiles < PATIENT_GENERAL_PHOTO_LIMIT
  // Mobile shows the photos that exist plus one add affordance. Repeating all
  // remaining empty slots adds noise and pushes real photos deeper into the
  // rail; the counter already communicates the 10-photo capacity.
  const slots: Array<{ photo?: ApiPatientClinicalPhoto; isUploading: boolean }> = [
    ...ordered.map((photo) => ({ photo, isUploading: false })),
    ...Array.from({ length: pendingTiles }, () => ({ isUploading: true })),
  ]
  if (canAdd || slots.length === 0) slots.push({ isUploading: false })

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <View style={styles.titleLeft}>
          <View style={styles.titleIcon}>
            <Icon name="camera-outline" size={16} color={c.brandDeep as string} />
          </View>
          <Text style={styles.title}>{t('patients.detail.generalPhotos.title')}</Text>
        </View>
        <View style={styles.counterPill}>
          <Text style={styles.counter}>{approvedCount}/{PATIENT_GENERAL_PHOTO_LIMIT}</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        snapToInterval={PATIENT_GENERAL_PHOTO_TILE_SIZE + spacing.sm}
        snapToAlignment="start"
        decelerationRate="fast"
      >
        {slots.map(({ photo, isUploading }, index) => {
          if (photo) {
            const busy = busyPhotoId === photo.id
            const imageUri = photo.thumbnail_url ?? photo.preview_url ?? photo.url ?? null
            return (
              <View key={photo.id} style={styles.tileWrap}>
                <Pressable
                  style={({ pressed }) => [styles.photoTile, pressed && styles.tilePressed]}
                  onPress={() => onPressPhoto(photo)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={t('patients.detail.generalPhotos.open', { n: index + 1 })}
                  testID={`general-photo-${index}`}
                >
                  {photo.scan_status === 'approved' && imageUri ? (
                    <ProtectedPatientMediaImage uri={imageUri} style={styles.image} />
                  ) : photo.scan_status === 'pending' ? (
                    <View style={styles.statusTile}>
                      <ActivityIndicator size="small" color={c.brand as string} />
                      <Text style={styles.statusText} numberOfLines={1}>
                        {t('patients.detail.generalPhotos.pending')}
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.statusTile, styles.rejectedTile]}>
                      <Icon name="alert-circle-outline" size={22} color={c.danger as string} />
                      <Text style={[styles.statusText, { color: c.danger as string }]} numberOfLines={1}>
                        {t('patients.detail.generalPhotos.rejected')}
                      </Text>
                    </View>
                  )}
                  {busy ? (
                    <View style={styles.busyOverlay}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    </View>
                  ) : null}
                </Pressable>
              </View>
            )
          }

          return (
            <Pressable
              key={`empty-${index}`}
              style={({ pressed }) => [
                styles.emptyTile,
                !canAdd && styles.emptyTileDisabled,
                pressed && canAdd && styles.tilePressed,
              ]}
              onPress={onAdd}
              disabled={!canAdd || isUploading}
              accessibilityRole={canAdd ? 'button' : undefined}
              accessibilityLabel={canAdd ? t('patients.detail.generalPhotos.add') : undefined}
              testID={`general-photo-empty-${index}`}
            >
              <View style={styles.emptyContent}>
                {isUploading ? (
                  <ActivityIndicator size="small" color={c.brand as string} />
                ) : canAdd ? (
                  <View style={styles.addIconBubble}>
                    <Icon name="add" size={20} color={c.brand as string} />
                  </View>
                ) : (
                  <Icon name="image-outline" size={21} color={c.labelTertiary as string} />
                )}
              </View>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    titleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    titleIcon: {
      width: 28,
      height: 28,
      borderRadius: radius.md,
      backgroundColor: c.brandSurface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.brandSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontFamily: font('700'),
      fontSize: 12,
      fontWeight: '700',
      color: c.labelSecondary,
      letterSpacing: 0.5,
    },
    counterPill: {
      minWidth: 46,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
      borderRadius: radius.pill,
      backgroundColor: c.brandSurface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.brandSoft,
    },
    counter: { ...typography.caption1, fontFamily: font('600'), color: c.labelSecondary },
    card: {
      marginHorizontal: spacing.lg,
      padding: spacing.md,
      borderRadius: radius.xl,
      backgroundColor: c.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.brandSoft,
      shadowColor: '#000',
      shadowOpacity: 0.045,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 3 },
    },
    scrollContent: {
      flexDirection: 'row',
      gap: 10,
      paddingRight: spacing.xs,
    },
    tileWrap: {
      width: PATIENT_GENERAL_PHOTO_TILE_SIZE,
      height: PATIENT_GENERAL_PHOTO_TILE_SIZE,
      position: 'relative',
      shadowColor: '#000',
      shadowOpacity: 0.045,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 2 },
    },
    photoTile: {
      width: '100%',
      height: '100%',
      borderRadius: radius.xl,
      overflow: 'hidden',
      backgroundColor: c.brandSurface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.brandSoft,
    },
    tilePressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
    image: { width: '100%', height: '100%' },
    emptyTile: {
      width: PATIENT_GENERAL_PHOTO_TILE_SIZE,
      height: PATIENT_GENERAL_PHOTO_TILE_SIZE,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: c.brandSoft,
      backgroundColor: c.brandSurface,
      shadowColor: '#000',
      shadowOpacity: 0.035,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 2 },
    },
    emptyTileDisabled: {
      borderStyle: 'solid',
      borderColor: c.separator,
      backgroundColor: c.fillQuaternary,
    },
    statusTile: {
      flex: 1,
      paddingHorizontal: 3,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      backgroundColor: c.brandSurface,
    },
    rejectedTile: { backgroundColor: 'rgba(255, 59, 48, 0.07)' },
    statusText: {
      fontFamily: font('600'),
      fontSize: 11,
      fontWeight: '600',
      color: c.labelSecondary,
    },
    emptyContent: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addIconBubble: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.brandSoft,
    },
    busyOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(15, 23, 42, 0.48)',
    },
  })
}
