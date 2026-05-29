import React, { useMemo } from 'react'
import { Modal, View, Text, Pressable, StyleSheet, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import * as Haptics from 'expo-haptics'
import Icon from '../ui/Icon'
import { useI18n } from '../../i18n'
import { useToast } from '../ui/Toast'
import { spacing, radius, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

// Asset shape we hand back to the caller. Maps the subset of fields we
// actually need downstream (the upload helper in src/api/treatments.ts
// only reads uri, mimeType, fileName, fileSize). This shields callers from
// SDK churn in the wider ImagePickerAsset interface.
export interface PickedAsset {
  uri: string
  mimeType?: string
  fileName?: string
  fileSize?: number
  width?: number
  height?: number
}

interface Props {
  visible: boolean
  onClose: () => void
  onPicked: (assets: PickedAsset[]) => void
  // Hard ceiling on how many images can be picked in a single round, used
  // both as `selectionLimit` for the library picker (iOS) and as a manual
  // truncate on the result (Android selectionLimit isn't enforced in older
  // surfaces). Defaults to 10 to match the web app's per-treatment cap.
  maxSelection?: number
  // When true the camera option is shown. Defaults true; pass false when
  // attaching to an existing item where re-taking doesn't make sense.
  allowCamera?: boolean
}

const DEFAULT_QUALITY = 0.8

export default function ImagePickerSheet({
  visible,
  onClose,
  onPicked,
  maxSelection = 10,
  allowCamera = true,
}: Props) {
  const { t } = useI18n()
  const c = useColors()
  const toast = useToast()
  const styles = useMemo(() => makeStyles(c), [c])

  // Both handlers ALWAYS close the sheet before opening the system picker.
  // expo-image-picker on Android can't open the camera/library UI while our
  // own Modal is in the foreground — the camera intent silently no-ops.
  // Closing first restores the activity hierarchy so the intent succeeds.
  const handleCamera = async () => {
    Haptics.selectionAsync()
    onClose()

    // Wait one frame so the Modal exits before we launch the camera. Without
    // this, Android still hands the screen to us mid-animation and the
    // permission prompt can race the modal teardown.
    await new Promise((r) => setTimeout(r, 250))

    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      if (!perm.granted) {
        toast.error(t('gallery.cameraPermissionDenied'))
        return
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: DEFAULT_QUALITY,
        // Editing crops the photo to a square on Android which is almost
        // never what a dentist wants for a treatment record. Keep the full
        // original framing.
        allowsEditing: false,
        exif: false,
      })
      if (!result.canceled && result.assets?.length) {
        onPicked(result.assets.slice(0, maxSelection).map(toPickedAsset))
      }
    } catch (e) {
      toast.error(t('gallery.cameraFailed'))
    }
  }

  const handleLibrary = async () => {
    Haptics.selectionAsync()
    onClose()
    await new Promise((r) => setTimeout(r, 250))

    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!perm.granted) {
        toast.error(t('gallery.libraryPermissionDenied'))
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: DEFAULT_QUALITY,
        allowsMultipleSelection: true,
        // iOS-only: caps the picker UI to N selections. Android's system
        // picker doesn't honor this in SDK 54 — we truncate manually below.
        selectionLimit: maxSelection,
        allowsEditing: false,
        exif: false,
      })
      if (!result.canceled && result.assets?.length) {
        onPicked(result.assets.slice(0, maxSelection).map(toPickedAsset))
      }
    } catch (e) {
      toast.error(t('gallery.libraryFailed'))
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      // Use overFullScreen so the dim backdrop covers the status bar on iOS.
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessible={false}>
        {/* Stop the press from bubbling into the backdrop dismiss when the
            user taps a button inside the sheet. */}
        <Pressable style={styles.sheetWrap} onPress={(e) => e.stopPropagation()}>
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.title}>{t('gallery.pickerTitle')}</Text>

            {allowCamera ? (
              <Pressable style={styles.row} onPress={handleCamera}>
                <View style={styles.iconBubble}>
                  <Icon name="camera-outline" size={22} color={c.brand as string} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{t('gallery.useCamera')}</Text>
                  <Text style={styles.rowSubtitle}>{t('gallery.useCameraSub')}</Text>
                </View>
              </Pressable>
            ) : null}

            <Pressable style={styles.row} onPress={handleLibrary}>
              <View style={styles.iconBubble}>
                <Icon name="images-outline" size={22} color={c.brand as string} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{t('gallery.useLibrary')}</Text>
                <Text style={styles.rowSubtitle}>{t('gallery.useLibrarySub')}</Text>
              </View>
            </Pressable>

            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function toPickedAsset(asset: ImagePicker.ImagePickerAsset): PickedAsset {
  return {
    uri: asset.uri,
    mimeType: asset.mimeType,
    fileName: asset.fileName ?? undefined,
    fileSize: asset.fileSize ?? undefined,
    width: asset.width,
    height: asset.height,
  }
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    sheetWrap: {
      width: '100%',
    },
    sheet: {
      backgroundColor: c.background,
      borderTopLeftRadius: radius.xxl,
      borderTopRightRadius: radius.xxl,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.lg,
      gap: spacing.sm,
    },
    handle: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.separator,
      marginBottom: spacing.sm,
    },
    title: {
      ...typography.headline,
      fontFamily: font('600'),
      color: c.label,
      marginBottom: spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.lg,
      backgroundColor: c.fillQuaternary,
    },
    iconBubble: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.brandLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowText: {
      flex: 1,
    },
    rowTitle: {
      ...typography.bodyEmphasized,
      fontFamily: font('600'),
      color: c.label,
    },
    rowSubtitle: {
      ...typography.footnote,
      color: c.labelSecondary as string,
      marginTop: 2,
    },
    cancelBtn: {
      marginTop: spacing.sm,
      paddingVertical: spacing.md,
      alignItems: 'center',
      borderRadius: radius.lg,
      backgroundColor: c.fillTertiary,
    },
    cancelText: {
      ...typography.bodyEmphasized,
      fontFamily: font('600'),
      color: c.label,
    },
  })
}
