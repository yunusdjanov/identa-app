import React, { useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'

import BottomSheet from '../ui/BottomSheet'
import Icon from '../ui/Icon'
import EmptyState from '../ui/EmptyState'
import TreatmentHistoryRow from '../payments/TreatmentHistoryRow'

import { useI18n } from '../../i18n'
import { formatCurrencyParts, formatDayMonth, fromLocalDateKey } from '../../lib/format'
import { spacing, radius, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import type { Locale } from '../../constants'
import type { ApiTreatment, ApiOdontogramSummaryEntry, ToothCondition } from '../../types'

// Same colour table the ToothChip uses. Kept in sync by hand because
// importing the chip's internal map would leak presentational state into
// the modal's logic layer (and they're small enough that drift risk is
// negligible — both come from the web app's documented spec).
const CONDITION_COLOR: Record<ToothCondition, string> = {
  healthy: '#22C55E',
  cavity: '#EF4444',
  filling: '#3B82F6',
  crown: '#EAB308',
  root_canal: '#A855F7',
  extraction: '#6B7280',
  implant: '#16A34A',
}

interface Props {
  visible: boolean
  toothNumber: number | null
  // Latest condition on this tooth (null = no condition recorded yet — the
  // tooth is "healthy by absence" rather than an explicit healthy mark).
  condition: ApiOdontogramSummaryEntry | null
  // Treatments that referenced this tooth (filtered by caller). Already
  // sorted newest-first by the standalone odontogram screen.
  treatments: ApiTreatment[]
  onClose: () => void
  onSelectTreatment?: (treatment: ApiTreatment) => void
}

export default function ToothDetailModal({
  visible,
  toothNumber,
  condition,
  treatments,
  onClose,
  onSelectTreatment,
}: Props) {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])

  // Per-tooth accounting — sum across all treatments that affected this
  // tooth. Mirrors the web "tooth detail" modal's metric cards.
  const summary = useMemo(() => {
    let debt = 0
    let paid = 0
    for (const tr of treatments) {
      debt += Number(tr.debt_amount ?? 0)
      paid += Number(tr.paid_amount ?? 0)
    }
    return { debt, paid, balance: debt - paid }
  }, [treatments])

  if (toothNumber === null) return null

  const conditionColor = condition ? CONDITION_COLOR[condition.condition_type] : null
  const conditionKey = condition?.condition_type
  const conditionDate = condition?.condition_date
    ? formatDayMonth(fromLocalDateKey(condition.condition_date), locale as Locale)
    : null

  const debtParts = formatCurrencyParts(summary.debt, locale as Locale)
  const paidParts = formatCurrencyParts(summary.paid, locale as Locale)
  const balanceParts = formatCurrencyParts(summary.balance, locale as Locale)

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('odontogram.toothNumber', { n: toothNumber })}
    >
      {/* Condition pill — coloured by the latest condition. Falls back to a
          neutral "no condition recorded" state when the tooth has no entry
          but has treatments attached (e.g., teeth listed on an invoice
          without a corresponding odontogram update). */}
      <View style={styles.conditionRow}>
        <View
          style={[
            styles.conditionPill,
            conditionColor ? { backgroundColor: conditionColor + '22', borderColor: conditionColor } : null,
          ]}
        >
          {conditionColor ? <View style={[styles.conditionDot, { backgroundColor: conditionColor }]} /> : null}
          <Text
            style={[
              styles.conditionLabel,
              conditionColor ? { color: conditionColor } : null,
            ]}
          >
            {conditionKey
              ? t(`odontogram.condition.${conditionKey}` as 'odontogram.condition.healthy')
              : t('odontogram.noCondition')}
          </Text>
        </View>
        {conditionDate ? (
          <Text style={styles.conditionDate}>
            {t('odontogram.conditionSince', { date: conditionDate })}
          </Text>
        ) : null}
      </View>

      {/* Per-tooth accounting cards */}
      {treatments.length > 0 ? (
        <View style={styles.metrics}>
          <Metric
            label={t('payments.treatment.debt')}
            value={`${debtParts.value} ${debtParts.unit}`}
            color={c.label as string}
          />
          <Metric
            label={t('payments.treatment.paid')}
            value={`${paidParts.value} ${paidParts.unit}`}
            color={c.success as string}
          />
          <Metric
            label={t('payments.treatment.balance')}
            value={`${balanceParts.value} ${balanceParts.unit}`}
            color={(summary.balance > 0 ? c.danger : summary.balance < 0 ? c.success : c.labelSecondary) as string}
            emphasize
          />
        </View>
      ) : null}

      {/* Treatment history for this tooth */}
      <View>
        <Text style={styles.sectionTitle}>
          {t('odontogram.toothHistoryTitle')}
        </Text>
        {treatments.length === 0 ? (
          <EmptyState
            iconName="time-outline"
            title={t('odontogram.noEntries')}
            style={{ paddingVertical: spacing.xl }}
          />
        ) : (
          <View style={styles.list}>
            {treatments.map((tr, idx) => (
              <React.Fragment key={tr.id}>
                <TreatmentHistoryRow
                  treatment={tr}
                  onPress={onSelectTreatment ? () => onSelectTreatment(tr) : undefined}
                />
                {idx < treatments.length - 1 ? <View style={styles.sep} /> : null}
              </React.Fragment>
            ))}
          </View>
        )}
      </View>
    </BottomSheet>
  )
}

function Metric({
  label,
  value,
  color,
  emphasize,
}: {
  label: string
  value: string
  color: string
  emphasize?: boolean
}) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  return (
    <View style={[styles.metric, emphasize && styles.metricEmphasize]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }, emphasize && styles.metricValueEmphasize]}>
        {value}
      </Text>
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    conditionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      flexWrap: 'wrap',
    },
    conditionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.pill,
      borderWidth: 1,
      backgroundColor: c.fillQuaternary,
      borderColor: c.separator,
    },
    conditionDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    conditionLabel: {
      ...typography.subheadBold,
      fontFamily: font('600'),
      color: c.label,
    },
    conditionDate: {
      ...typography.caption1,
      color: c.labelSecondary as string,
    },
    metrics: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    metric: {
      flex: 1,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      backgroundColor: c.fillQuaternary,
      borderRadius: radius.lg,
      gap: 4,
    },
    metricEmphasize: {
      backgroundColor: c.brandLight,
    },
    metricLabel: {
      ...typography.caption1,
      color: c.labelSecondary as string,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    metricValue: {
      ...typography.bodyEmphasized,
      fontFamily: font('700'),
    },
    metricValueEmphasize: {
      fontFamily: font('800'),
    },
    sectionTitle: {
      ...typography.subheadBold,
      fontFamily: font('600'),
      color: c.labelSecondary as string,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.sm,
    },
    list: {
      backgroundColor: c.background,
      borderRadius: radius.xl,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
    sep: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.separator as string,
      marginLeft: 20 + 38 + 12,
    },
  })
}
