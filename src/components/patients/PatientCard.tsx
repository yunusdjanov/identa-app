import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import * as Haptics from 'expo-haptics'

import Icon from '../ui/Icon'
import OverflowMenuButton from '../ui/OverflowMenuButton'
import PatientAvatar from '../ui/PatientAvatar'
import { radius, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { useI18n } from '../../i18n'
import type { TFunction } from '../../i18n/helpers'
import { ageFromDob, getRelativeDateBucket } from '../../lib/format'
import { formatStoredPhone } from '../../lib/phoneFormat'
import { getPatientPhotoUris } from '../../lib/patientPhoto'
import type { ApiPatient } from '../../types'

interface Props {
  patient: ApiPatient
  onPress?: () => void
  onLongPress?: () => void
  searchQuery?: string
  action?: {
    accessibilityLabel: string
    onPress: () => void
    loading?: boolean
  }
}

export default function PatientCard({
  patient,
  onPress,
  onLongPress,
  searchQuery = '',
  action,
}: Props) {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const lastVisitLabel = formatLastVisit(patient.last_visit_at, t)
  const phoneFormatted = formatStoredPhone(patient.phone)
  const secondaryPhoneFormatted = formatStoredPhone(patient.secondary_phone)

  // If search matched only the secondary number, show that exact number.
  // Otherwise a valid result appears to have no relationship to the query.
  const queryDigits = searchQuery.replace(/\D/g, '')
  const primaryDigits = patient.phone?.replace(/\D/g, '') ?? ''
  const secondaryDigits = patient.secondary_phone?.replace(/\D/g, '') ?? ''
  const matchedSecondary =
    queryDigits.length >= 3 &&
    secondaryDigits.includes(queryDigits) &&
    !primaryDigits.includes(queryDigits)
  const displayedPhone = matchedSecondary ? secondaryPhoneFormatted : phoneFormatted

  const photoUris = getPatientPhotoUris(patient)
  const dobDate = patient.date_of_birth ? new Date(patient.date_of_birth) : null
  const age = ageFromDob(dobDate)
  const phoneLine =
    age != null && displayedPhone
      ? `${displayedPhone} · ${t('patients.detail.vitals.age', { n: age })}`
      : age != null
        ? t('patients.detail.vitals.age', { n: age })
        : displayedPhone

  const handlePress = () => {
    if (!onPress) return
    Haptics.selectionAsync()
    onPress()
  }

  const inner = (
    <View style={styles.row}>
      <PatientAvatar
        name={patient.full_name}
        size={54}
        initialsFontSize={16}
        uri={photoUris}
        style={styles.avatar}
      />

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {patient.full_name}
        </Text>

        {phoneLine ? (
          <Text style={[styles.phone, matchedSecondary && styles.matchedPhone]} numberOfLines={1}>
            {matchedSecondary ? `${t('patients.secondaryPhoneShort')}: ` : ''}
            {phoneLine}
          </Text>
        ) : null}

        <View style={styles.metaLine}>
          {lastVisitLabel ? (
            <View style={styles.metaItem}>
              <Icon name="time-outline" size={13} color={c.labelTertiary as string} />
              <Text style={styles.lastVisit} numberOfLines={1}>{lastVisitLabel}</Text>
            </View>
          ) : <View style={styles.metaSpacer} />}
        </View>

      </View>

      {action ? (
        <OverflowMenuButton
          label={action.accessibilityLabel}
          onPress={action.onPress}
          loading={action.loading}
          stopPropagation
        />
      ) : null}
    </View>
  )

  if (!onPress) return inner

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={onLongPress}
      delayLongPress={400}
      testID="PatientCard"
      style={({ pressed }) => pressed && styles.pressed}
      accessibilityRole="button"
      accessibilityLabel={[
        patient.full_name,
        displayedPhone,
      ].filter(Boolean).join(', ')}
    >
      {inner}
    </Pressable>
  )
}

function formatLastVisit(iso: string | undefined, t: TFunction): string | null {
  if (!iso) return null
  const bucket = getRelativeDateBucket(new Date(iso))
  switch (bucket.bucket) {
    case 'today': return t('patients.time.today')
    case 'yesterday': return t('patients.time.yesterday')
    case 'daysAgo': return t('patients.time.daysAgo', { n: bucket.value })
    case 'weeksAgo': return t('patients.time.weeksAgo', { n: bucket.value })
    case 'monthsAgo': return t('patients.time.monthsAgo', { n: bucket.value })
    case 'yearsAgo': return t('patients.time.yearsAgo', { n: bucket.value })
  }
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 7,
      paddingHorizontal: 20,
      gap: 10,
    },
    avatar: {
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.brandSoft,
      backgroundColor: c.brandSurface,
    },
    pressed: { backgroundColor: c.fillQuaternary },
    body: { flex: 1, gap: 3 },
    name: {
      ...typography.bodyEmphasized,
      color: c.label,
    },
    phone: {
      ...typography.footnote,
      color: c.labelSecondary,
      letterSpacing: -0.1,
    },
    matchedPhone: {
      color: c.brandDeep,
      fontFamily: font('600'),
      fontWeight: '600',
    },
    metaLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    metaItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaSpacer: { flex: 1 },
    lastVisit: {
      ...typography.caption1,
      color: c.labelTertiary,
      fontFamily: font('500'),
      fontWeight: '500',
    },
  })
}
