import React, { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import Icon, { type IconName } from '../ui/Icon'
import PatientAvatar from '../ui/PatientAvatar'
import { useI18n } from '../../i18n'
import { font, radius, spacing, typography } from '../../constants/theme'
import { getPatientPhotoUris } from '../../lib/patientPhoto'
import { useColors, type Colors } from '../../lib/useColors'
import type { ApiPatient } from '../../types'

export const PATIENT_SUGGESTION_DISPLAY_LIMIT = 3

export interface PatientSuggestionItem {
  id: string
  full_name: string
  phone?: ApiPatient['phone']
  photo_url?: ApiPatient['photo_url']
  photo_thumbnail_url?: ApiPatient['photo_thumbnail_url']
  photo_preview_url?: ApiPatient['photo_preview_url']
  photo_thumbnail_ready?: ApiPatient['photo_thumbnail_ready']
  photo_preview_ready?: ApiPatient['photo_preview_ready']
  photo_scan_status?: ApiPatient['photo_scan_status']
}

interface Props<T extends PatientSuggestionItem> {
  patients: T[]
  title: string
  titleIcon?: IconName
  clearing?: boolean
  onSelect: (patient: T) => void
  onClear?: () => void
  onDismiss?: () => void
}

export default function PatientSuggestionsPanel<T extends PatientSuggestionItem>({
  patients,
  title,
  titleIcon = 'time-outline',
  clearing,
  onSelect,
  onClear,
  onDismiss,
}: Props<T>) {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const visiblePatients = patients.slice(0, PATIENT_SUGGESTION_DISPLAY_LIMIT)

  if (visiblePatients.length === 0) return null

  return (
    <View style={styles.panel}>
      <View style={styles.panelContent}>
        <View style={styles.header}>
          <View style={styles.titleGroup}>
            <Icon name={titleIcon} size={14} color={c.brand as string} />
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
          </View>
          {onClear || onDismiss ? (
            <View style={styles.headerActions}>
              {onClear ? (
                <Pressable
                  onPress={onClear}
                  disabled={clearing}
                  hitSlop={4}
                  style={({ pressed }) => [
                    styles.clearButton,
                    pressed && !clearing && styles.headerButtonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t('patients.recent.clear')}
                  accessibilityState={{ disabled: Boolean(clearing) }}
                >
                  <Text style={styles.clearText}>{t('patients.recent.clear')}</Text>
                </Pressable>
              ) : null}
              {onDismiss ? (
                <Pressable
                  onPress={onDismiss}
                  hitSlop={4}
                  style={({ pressed }) => [
                    styles.dismissButton,
                    pressed && styles.headerButtonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.close')}
                >
                  <Icon name="close" size={18} color={c.labelSecondary as string} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>

        <View>
          {visiblePatients.map((patient, index) => (
            <React.Fragment key={patient.id}>
              <Pressable
                onPress={() => onSelect(patient)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                accessibilityRole="button"
                accessibilityLabel={
                  patient.phone
                    ? `${patient.full_name}, ${patient.phone}`
                    : patient.full_name
                }
              >
                <PatientAvatar
                  name={patient.full_name}
                  size={32}
                  initialsFontSize={12}
                  uri={getPatientPhotoUris(patient)}
                  style={styles.avatar}
                />
                <View style={styles.copy}>
                  <Text style={styles.name} numberOfLines={1}>{patient.full_name}</Text>
                  {patient.phone ? (
                    <Text style={styles.phone} numberOfLines={1}>{patient.phone}</Text>
                  ) : null}
                </View>
                <Icon name="chevron-forward" size={16} color={c.labelTertiary as string} />
              </Pressable>
              {index < visiblePatients.length - 1 ? <View style={styles.separator} /> : null}
            </React.Fragment>
          ))}
        </View>
      </View>
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    panel: {
      borderRadius: radius.xl,
      backgroundColor: c.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.brandSoft,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 7 },
      elevation: 8,
    },
    panelContent: {
      overflow: 'hidden',
      borderRadius: radius.xl,
      backgroundColor: c.background,
    },
    header: {
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: spacing.md,
      paddingRight: 6,
    },
    titleGroup: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    title: {
      flexShrink: 1,
      ...typography.caption1,
      fontFamily: font('700'),
      fontWeight: '700',
      color: c.labelSecondary,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    clearButton: {
      minHeight: 36,
      justifyContent: 'center',
      paddingHorizontal: 10,
      borderRadius: radius.md,
    },
    dismissButton: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerButtonPressed: {
      backgroundColor: c.brandSurface,
    },
    clearText: {
      ...typography.caption1,
      fontFamily: font('600'),
      fontWeight: '600',
      color: c.brand,
    },
    row: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: spacing.md,
      paddingVertical: 7,
    },
    rowPressed: {
      backgroundColor: c.brandSurface,
    },
    avatar: {
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.brandSoft,
      backgroundColor: c.brandSurface,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    name: {
      ...typography.subhead,
      fontFamily: font('600'),
      fontWeight: '600',
      color: c.label,
    },
    phone: {
      ...typography.caption1,
      color: c.labelSecondary,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      marginLeft: spacing.md + 32 + 10,
      backgroundColor: c.separator,
    },
  })
}
