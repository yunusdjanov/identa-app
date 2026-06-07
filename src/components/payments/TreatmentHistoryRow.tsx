import React, { useMemo, useState } from 'react'
import { View, Text, Image, StyleSheet, Pressable } from 'react-native'
import * as Haptics from 'expo-haptics'
import Icon from '../ui/Icon'
import PatientAvatar from '../ui/PatientAvatar'
import { LightboxViewer } from '../gallery'
import { radius, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { useI18n } from '../../i18n'
import { formatCurrencyParts, formatDayMonth, fromLocalDateKey } from '../../lib/format'
import { resolveTreatmentImageUrl } from '../../api/treatments'
import type { ApiTreatment } from '../../types'

interface Props {
  treatment: ApiTreatment
  onPress?: () => void
}

export default function TreatmentHistoryRow({ treatment, onPress }: Props) {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])

  const handlePress = () => {
    if (onPress) {
      Haptics.selectionAsync()
      onPress()
    }
  }

  const date = fromLocalDateKey(treatment.treatment_date)
  const dateLabel = formatDayMonth(date, locale)
  const balanceParts = formatCurrencyParts(treatment.balance, locale)
  const paidParts = formatCurrencyParts(treatment.paid_amount, locale)
  const debtParts = formatCurrencyParts(treatment.debt_amount, locale)

  const balanceColor =
    treatment.balance > 0
      ? c.danger
      : treatment.balance < 0
        ? c.success
        : c.labelSecondary

  const teethLabel =
    treatment.teeth && treatment.teeth.length > 0
      ? treatment.teeth.length === 1
        ? `${t('payments.history.teeth')} #${treatment.teeth[0]}`
        : t('payments.history.teethShort', { n: treatment.teeth.length })
      : null

  // Image preview + lightbox: gives the dentist direct visual access to
  // treatment photos without needing to open the edit sheet. Matches the
  // web tooth-detail dialog's per-treatment thumbnail+count badge.
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const imageUris = useMemo(() => {
    const imgs = treatment.images ?? []
    return imgs
      .map((img) =>
        resolveTreatmentImageUrl(img, 'preview') ?? resolveTreatmentImageUrl(img, 'full')
      )
      .filter((u): u is string => typeof u === 'string')
  }, [treatment.images])
  const thumbnailUri =
    treatment.images && treatment.images.length > 0
      ? (resolveTreatmentImageUrl(treatment.images[0]!, 'thumbnail') ??
          resolveTreatmentImageUrl(treatment.images[0]!, 'preview'))
      : null

  const Inner = (
    <View style={styles.row}>
      <PatientAvatar name={treatment.patient_name || '—'} size={38} />

      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text style={styles.name} numberOfLines={1}>
            {treatment.patient_name || '—'}
          </Text>
          <Text style={styles.date}>{dateLabel}</Text>
        </View>
        <Text style={styles.work} numberOfLines={1}>
          {treatment.treatment_type}
          {teethLabel ? ` · ${teethLabel}` : ''}
        </Text>
        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>
            {t('payments.history.debt')}{' '}
            <Text style={styles.amountDebt}>
              {debtParts.value}
            </Text>
          </Text>
          <Text style={styles.amountLabel}>
            {t('payments.history.paid')}{' '}
            <Text style={styles.amountPaid}>
              {paidParts.value}
            </Text>
          </Text>
          <Text style={[styles.amountBalance, { color: balanceColor as string }]}>
            {balanceParts.value}
            <Text style={styles.amountBalanceUnit}> {balanceParts.unit}</Text>
          </Text>
        </View>
      </View>

      {thumbnailUri ? (
        <Pressable
          onPress={() => {
            Haptics.selectionAsync()
            setLightboxIndex(0)
          }}
          hitSlop={6}
          style={styles.thumbWrap}
          accessibilityRole="button"
        >
          <Image source={{ uri: thumbnailUri }} style={styles.thumb} />
          {imageUris.length > 1 ? (
            <View style={styles.thumbBadge}>
              <Text style={styles.thumbBadgeText}>+{imageUris.length - 1}</Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}

      {onPress ? (
        <Icon name="chevron-forward" size={16} color={c.labelTertiary as string} />
      ) : null}
    </View>
  )

  const Row = onPress ? (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {Inner}
    </Pressable>
  ) : (
    Inner
  )

  return (
    <>
      {Row}
      <LightboxViewer
        visible={lightboxIndex !== null}
        uris={imageUris}
        startIndex={lightboxIndex ?? 0}
        onClose={() => setLightboxIndex(null)}
      />
    </>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 12,
  },
  pressed: { backgroundColor: c.fillQuaternary },
  body: { flex: 1, gap: 4 },
  topLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
    ...typography.bodyEmphasized,
    color: c.label,
  },
  date: {
    fontFamily: font('500'),
    fontSize: 12,
    fontWeight: '500',
    color: c.labelTertiary,
  },
  work: {
    ...typography.footnote,
    color: c.labelSecondary,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  amountLabel: {
    fontFamily: font('500'),
    fontSize: 11,
    fontWeight: '500',
    color: c.labelTertiary,
  },
  amountDebt: {
    fontFamily: font('700'),
    fontSize: 12,
    fontWeight: '700',
    color: c.danger,
  },
  amountPaid: {
    fontFamily: font('700'),
    fontSize: 12,
    fontWeight: '700',
    color: c.success,
  },
  amountBalance: {
    fontFamily: font('800'),
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 'auto',
  },
  amountBalanceUnit: {
    fontFamily: font('600'),
    fontSize: 10,
    fontWeight: '600',
  },
  thumbWrap: {
    position: 'relative',
    width: 40,
    height: 40,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: c.fillQuaternary,
  },
  thumb: {
    width: 40,
    height: 40,
  },
  thumbBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderTopLeftRadius: 4,
  },
  thumbBadgeText: {
    color: '#FFFFFF',
    fontFamily: font('700'),
    fontSize: 9,
    fontWeight: '700',
  },
  })
}
