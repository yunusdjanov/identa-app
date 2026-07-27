import React, { useMemo, useState } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import * as Haptics from 'expo-haptics'

import Icon from '../ui/Icon'
import CompactIconButton from '../ui/CompactIconButton'
import OverflowMenuButton from '../ui/OverflowMenuButton'
import ProtectedPatientMediaImage from '../ui/ProtectedPatientMediaImage'
import { LightboxViewer } from '../gallery'
import { radius, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { useI18n } from '../../i18n'
import { formatCurrencyParts, formatDayMonth, fromLocalDateKey } from '../../lib/format'
import { resolveTreatmentImageUrl } from '../../api/treatments'
import type { ApiTreatment } from '../../types'

interface Props {
  treatment: ApiTreatment
  onEdit?: () => void
  onDeleteActions?: () => void
  actionsLoading?: boolean
  actionsDisabled?: boolean
  showFinancials?: boolean
}

export default function TreatmentHistoryRow({
  treatment,
  onEdit,
  onDeleteActions,
  actionsLoading = false,
  actionsDisabled = false,
  showFinancials = true,
}: Props) {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])

  const date = fromLocalDateKey(treatment.treatment_date)
  const dateLabel = formatDayMonth(date, locale)
  const currency = treatment.currency === 'USD' ? 'USD' : 'UZS'
  const workParts = formatCurrencyParts(treatment.debt_amount, locale, currency)
  const paidParts = formatCurrencyParts(treatment.paid_amount, locale, currency)
  const remainingParts = formatCurrencyParts(treatment.balance, locale, currency)
  const remainingColor = treatment.balance > 0 ? '#A65F00' : '#16805A'

  const description = treatment.description?.trim() || null
  const metaLabel = [dateLabel, description].filter(Boolean).join(' · ')

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const imageUris = useMemo(() => {
    const images = treatment.images ?? []
    return images
      .map((image) =>
        resolveTreatmentImageUrl(image, 'preview') ?? resolveTreatmentImageUrl(image, 'full')
      )
      .filter((uri): uri is string => typeof uri === 'string')
  }, [treatment.images])
  const thumbnailUri =
    treatment.images && treatment.images.length > 0
      ? (resolveTreatmentImageUrl(treatment.images[0]!, 'thumbnail') ??
          resolveTreatmentImageUrl(treatment.images[0]!, 'preview'))
      : null

  const financeMetrics = [
    {
      key: 'work',
      label: t('payments.history.debt'),
      value: workParts.value,
      unit: workParts.unit,
      color: '#C7464D',
    },
    {
      key: 'paid',
      label: t('payments.history.paid'),
      value: paidParts.value,
      unit: paidParts.unit,
      color: '#16805A',
    },
    {
      key: 'remaining',
      label: t('payments.history.balance'),
      value: remainingParts.value,
      unit: remainingParts.unit,
      color: remainingColor,
    },
  ]

  const content = (
    <View style={styles.row}>
      <View style={styles.summaryRow}>
        <View
          style={styles.body}
          accessible
          accessibilityLabel={[treatment.treatment_type, metaLabel].filter(Boolean).join(', ')}
        >
          <Text style={styles.treatmentType} numberOfLines={1}>
            {treatment.treatment_type}
          </Text>
          <View style={styles.metaRow} testID="treatment-meta-row">
            <Icon name="calendar-clear-outline" size={12} color={c.labelTertiary as string} />
            <Text style={styles.meta} numberOfLines={1}>{metaLabel}</Text>
          </View>
        </View>

        {thumbnailUri ? (
          <Pressable
            onPress={(event) => {
              event.stopPropagation()
              Haptics.selectionAsync()
              setLightboxIndex(0)
            }}
            hitSlop={4}
            style={({ pressed }) => [styles.thumbWrap, pressed && styles.thumbPressed]}
            accessibilityRole="button"
            accessibilityLabel={`${treatment.treatment_type}, ${imageUris.length}`}
          >
            <ProtectedPatientMediaImage uri={thumbnailUri} style={styles.thumb} />
            {imageUris.length > 1 ? (
              <View style={styles.thumbBadge}>
                <Text style={styles.thumbBadgeText}>+{imageUris.length - 1}</Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}

      </View>

      {showFinancials || onEdit || onDeleteActions ? (
        <View style={styles.footerRow} testID="treatment-row-footer">
          {showFinancials ? (
            <View style={styles.financeBar} testID="treatment-finance-bar">
              {financeMetrics.map((metric, index) => (
                <React.Fragment key={metric.key}>
                  <View style={styles.financeMetric} testID={`treatment-finance-${metric.key}`}>
                    <Text style={styles.financeLabel} numberOfLines={1}>{metric.label}</Text>
                    <Text
                      style={[styles.financeValue, { color: metric.color }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.68}
                    >
                      {metric.value}<Text style={styles.financeUnit}> {metric.unit}</Text>
                    </Text>
                  </View>
                  {index < financeMetrics.length - 1 ? (
                    <View style={styles.financeSeparator} />
                  ) : null}
                </React.Fragment>
              ))}
            </View>
          ) : null}

          {onEdit || onDeleteActions ? (
            <View style={styles.actionGroup}>
              {onEdit ? (
                <CompactIconButton
                  icon="create-outline"
                  label={`${t('common.edit')}: ${treatment.treatment_type}`}
                  onPress={onEdit}
                  disabled={actionsDisabled}
                />
              ) : null}
              {onDeleteActions ? (
                <OverflowMenuButton
                  label={`${t('patients.actions.more')}: ${treatment.treatment_type}`}
                  onPress={onDeleteActions}
                  loading={actionsLoading}
                  disabled={actionsDisabled}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  )

  return (
    <>
      {content}
      <LightboxViewer
        visible={lightboxIndex !== null}
        uris={imageUris}
        startIndex={lightboxIndex ?? 0}
        onClose={() => setLightboxIndex(null)}
        protectedPatientMedia
      />
    </>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    row: {
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    body: {
      flex: 1,
      minWidth: 0,
      gap: 5,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    treatmentType: {
      flex: 1,
      minWidth: 0,
      fontFamily: font('700'),
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '700',
      color: c.label,
    },
    meta: {
      flex: 1,
      minWidth: 0,
      fontFamily: font('500'),
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '500',
      color: c.labelSecondary,
    },
    financeBar: {
      flex: 1,
      minWidth: 0,
      height: 42,
      flexDirection: 'row',
      alignItems: 'stretch',
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.separator,
      borderRadius: radius.md,
      backgroundColor: c.backgroundTertiary,
    },
    footerRow: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 2,
    },
    actionGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: -6,
    },
    financeMetric: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
      gap: 2,
      paddingHorizontal: 7,
      paddingVertical: 5,
    },
    financeLabel: {
      fontFamily: font('600'),
      fontSize: 9,
      lineHeight: 11,
      fontWeight: '600',
      color: c.labelTertiary,
    },
    financeValue: {
      fontFamily: font('700'),
      fontSize: 11.5,
      lineHeight: 14,
      fontWeight: '700',
      letterSpacing: -0.15,
    },
    financeUnit: {
      fontFamily: font('500'),
      fontSize: 8,
      fontWeight: '500',
      color: c.labelSecondary,
      letterSpacing: 0,
    },
    financeSeparator: {
      width: StyleSheet.hairlineWidth,
      marginVertical: 7,
      backgroundColor: c.separator,
    },
    thumbWrap: {
      position: 'relative',
      width: 44,
      height: 44,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.brandSoft,
      borderRadius: radius.md,
      backgroundColor: c.fillQuaternary,
    },
    thumbPressed: {
      opacity: 0.72,
    },
    thumb: {
      width: 44,
      height: 44,
    },
    thumbBadge: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderTopLeftRadius: 5,
      backgroundColor: 'rgba(0,0,0,0.62)',
    },
    thumbBadgeText: {
      color: '#FFFFFF',
      fontFamily: font('700'),
      fontSize: 9,
      fontWeight: '700',
    },
  })
}
