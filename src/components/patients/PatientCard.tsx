import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import * as Haptics from 'expo-haptics'
import Icon from '../ui/Icon'
import PatientAvatar from '../ui/PatientAvatar'
import { radius, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { useI18n } from '../../i18n'
import type { TFunction } from '../../i18n/helpers'
import { ageFromDob, getRelativeDateBucket } from '../../lib/format'
import { formatStoredPhone } from '../../lib/phoneFormat'
import type { ApiPatient } from '../../types'

interface Props {
  patient: ApiPatient
  onPress?: () => void
  onLongPress?: () => void
}

export default function PatientCard({ patient, onPress, onLongPress }: Props) {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const category = patient.categories?.[0]
  const lastVisitLabel = formatLastVisit(patient.last_visit_at, t)
  const phoneFormatted = formatStoredPhone(patient.phone)
  // Show the patient's profile photo when moderation has approved it; pending
  // / rejected fall back to initials (mirrors the detail screen and the web).
  const photoUri =
    patient.photo_scan_status === 'rejected' || patient.photo_scan_status === 'pending'
      ? null
      : (patient.photo_thumbnail_url ?? patient.photo_url ?? null)
  // Age derived from DOB so the row carries one more identifying signal next
  // to the phone (web shows DOB explicitly; age is a compact equivalent).
  const dobDate = patient.date_of_birth ? new Date(patient.date_of_birth) : null
  // Calendar-correct age via the shared helper (consistent with the detail screen).
  const age = ageFromDob(dobDate)
  const phoneLine =
    age != null && phoneFormatted
      ? `${phoneFormatted} · ${t('patients.detail.vitals.age', { n: age })}`
      : age != null
        ? t('patients.detail.vitals.age', { n: age })
        : phoneFormatted

  const handlePress = () => {
    if (onPress) {
      Haptics.selectionAsync()
      onPress()
    }
  }

  const Inner = (
    <View style={styles.row}>
      <PatientAvatar name={patient.full_name} size={40} uri={photoUri} />

      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text style={styles.name} numberOfLines={1}>
            {patient.full_name}
          </Text>
          {lastVisitLabel ? (
            <Text style={styles.lastVisit} numberOfLines={1}>
              {lastVisitLabel}
            </Text>
          ) : null}
        </View>
        <View style={styles.bottomLine}>
          <Text style={styles.phone} numberOfLines={1}>
            {phoneLine}
          </Text>
          {category ? (
            <View style={[styles.categoryPill, { backgroundColor: `${category.color}1A` }]}>
              <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
              <Text style={[styles.categoryText, { color: category.color }]} numberOfLines={1}>
                {category.name}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {onPress ? (
        <Icon name="chevron-forward" size={16} color={c.labelTertiary as string} />
      ) : null}
    </View>
  )

  if (onPress) {
    return (
      <Pressable
        onPress={handlePress}
        onLongPress={onLongPress}
        delayLongPress={400}
        style={({ pressed }) => pressed && styles.pressed}
      >
        {Inner}
      </Pressable>
    )
  }
  return Inner
}

function formatLastVisit(iso: string | undefined, t: TFunction): string | null {
  if (!iso) return null
  const date = new Date(iso)
  const bucket = getRelativeDateBucket(date)
  switch (bucket.bucket) {
    case 'today':
      return t('patients.time.today')
    case 'yesterday':
      return t('patients.time.yesterday')
    case 'daysAgo':
      return t('patients.time.daysAgo', { n: bucket.value })
    case 'weeksAgo':
      return t('patients.time.weeksAgo', { n: bucket.value })
    case 'monthsAgo':
      return t('patients.time.monthsAgo', { n: bucket.value })
    case 'yearsAgo':
      return t('patients.time.yearsAgo', { n: bucket.value })
  }
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 20,
      gap: 12,
    },
    pressed: { backgroundColor: c.fillQuaternary },
    body: { flex: 1, gap: 4 },
    topLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    name: {
      flex: 1,
      ...typography.bodyEmphasized,
      color: c.label,
    },
    lastVisit: {
      ...typography.caption1,
      color: c.labelTertiary,
      fontFamily: font('500'),
      fontWeight: '500',
    },
    bottomLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    phone: {
      flex: 1,
      ...typography.footnote,
      color: c.labelSecondary,
      letterSpacing: -0.1,
    },
    categoryPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.pill,
      maxWidth: 120,
    },
    categoryDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    categoryText: {
      fontFamily: font('600'),
      fontSize: 11,
      fontWeight: '600',
    },
  })
}
