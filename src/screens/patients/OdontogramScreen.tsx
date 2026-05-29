import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

import { Odontogram, ToothDetailModal, type ToothChipState, type ToothConditionMap, type ToothBadgeMap } from '../../components/odontogram'
import TreatmentDetailSheet from '../../components/payments/TreatmentDetailSheet'
import { TreatmentEditSheet } from '../../components/treatments'
import Icon from '../../components/ui/Icon'
import EmptyState from '../../components/ui/EmptyState'

import { useI18n } from '../../i18n'
import { useAuthStore } from '../../stores/auth'
import { canManage } from '../../lib/permissions'
import { listTreatments } from '../../api/treatments'
import { getPatientOdontogramSummary } from '../../api/odontogram'
import { getPatient } from '../../api/patients'
import { radius, spacing, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import type { MainStackParams } from '../../navigation'
import type { ApiTreatment } from '../../types'

type Route = RouteProp<MainStackParams, 'PatientOdontogram'>
type Nav = NativeStackNavigationProp<MainStackParams, 'PatientOdontogram'>

export default function OdontogramScreen() {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const route = useRoute<Route>()
  const navigation = useNavigation<Nav>()
  const user = useAuthStore((s) => s.user)
  const canEdit = canManage(user, 'patients')

  const { patientId, patientName: nameFromParams } = route.params

  const patientQuery = useQuery({
    queryKey: ['patients', 'detail', patientId],
    queryFn: () => getPatient(patientId),
    // Reuse PatientDetailScreen's cache so navigating back-and-forth is free.
    staleTime: 60_000,
    enabled: !nameFromParams,
  })

  const summaryQuery = useQuery({
    queryKey: ['odontogram', 'summary', patientId],
    queryFn: () => getPatientOdontogramSummary(patientId),
    staleTime: 30_000,
  })

  const treatmentsQuery = useQuery({
    queryKey: ['treatments', 'list', { patient_id: patientId }],
    queryFn: () => listTreatments({ patient_id: patientId }),
    staleTime: 30_000,
  })

  const patientName = nameFromParams ?? patientQuery.data?.full_name ?? '—'
  const summary = summaryQuery.data
  const allTreatments = treatmentsQuery.data?.data ?? []

  // Build per-tooth condition map from the latest_conditions list. Conditions
  // not present default to 'neutral' (no fill) — we deliberately don't paint
  // every healthy tooth green because the visual noise overwhelms the few
  // teeth that actually need attention.
  const conditions: ToothConditionMap = useMemo(() => {
    if (!summary) return {}
    const map: ToothConditionMap = {}
    for (const entry of summary.latest_conditions) {
      map[entry.tooth_number] = entry.condition_type as ToothChipState
    }
    return map
  }, [summary])

  // Badges = count of TREATMENTS that referenced this tooth (a better
  // "how much work has happened on this tooth" signal than odontogram
  // history_count, which only counts explicit condition changes).
  const badges: ToothBadgeMap = useMemo(() => {
    const map: ToothBadgeMap = {}
    for (const tr of allTreatments) {
      const teethList = Array.isArray(tr.teeth) ? tr.teeth : []
      for (const n of teethList) {
        if (typeof n === 'number' && n >= 1 && n <= 32) {
          map[n] = (map[n] ?? 0) + 1
        }
      }
    }
    return map
  }, [allTreatments])

  // Tooth detail modal state
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)
  const treatmentsForTooth = useMemo(() => {
    if (selectedTooth === null) return []
    return allTreatments
      .filter((tr) => Array.isArray(tr.teeth) && tr.teeth.includes(selectedTooth))
      .sort((a, b) => b.treatment_date.localeCompare(a.treatment_date))
  }, [selectedTooth, allTreatments])

  const selectedCondition = useMemo(() => {
    if (selectedTooth === null || !summary) return null
    return summary.latest_conditions.find((e) => e.tooth_number === selectedTooth) ?? null
  }, [selectedTooth, summary])

  // Treatment sheets — same two-sheet pattern as PatientDetailScreen.
  const [detailTreatment, setDetailTreatment] = useState<ApiTreatment | null>(null)
  const [editTreatment, setEditTreatment] = useState<ApiTreatment | null>(null)

  const onSelectTreatment = (tr: ApiTreatment) => {
    // Close the tooth modal first so the treatment detail sheet has the
    // foreground to itself. Defer by one frame so the dismiss animation
    // doesn't visually collide with the open animation.
    setSelectedTooth(null)
    setTimeout(() => setDetailTreatment(tr), 220)
  }

  const isLoading = summaryQuery.isLoading || treatmentsQuery.isLoading

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView edges={['top']} style={styles.flex}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backBtn}>
            <Icon name="chevron-back" size={22} color={c.brand as string} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{t('odontogram.title')}</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {patientName}
            </Text>
          </View>
          <View style={styles.spacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary cards */}
          {summary ? (
            <View style={styles.summaryRow}>
              <SummaryCard
                c={c}
                label={t('odontogram.summary.entries')}
                value={String(summary.total_entries)}
              />
              <SummaryCard
                c={c}
                label={t('odontogram.summary.affectedTeeth')}
                value={String(summary.affected_teeth_count)}
              />
            </View>
          ) : null}

          {isLoading && !summary ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={c.brand as string} />
            </View>
          ) : (
            <View style={styles.odontogramCard}>
              <Odontogram
                mode="view"
                conditions={conditions}
                badges={badges}
                onPressTooth={(n) => {
                  Haptics.selectionAsync()
                  setSelectedTooth(n)
                }}
                showHeader={false}
              />
            </View>
          )}

          {/* Empty hint */}
          {!isLoading &&
          summary?.total_entries === 0 &&
          allTreatments.length === 0 ? (
            <EmptyState
              iconName="information-circle-outline"
              title={t('odontogram.emptyTitle')}
              subtitle={t('odontogram.emptySubtitle')}
              style={{ marginTop: spacing.lg }}
            />
          ) : null}
        </ScrollView>
      </SafeAreaView>

      <ToothDetailModal
        visible={selectedTooth !== null}
        toothNumber={selectedTooth}
        condition={selectedCondition}
        treatments={treatmentsForTooth}
        onClose={() => setSelectedTooth(null)}
        onSelectTreatment={onSelectTreatment}
      />

      <TreatmentDetailSheet
        visible={detailTreatment !== null}
        treatment={detailTreatment}
        onClose={() => setDetailTreatment(null)}
        onEditRequested={
          canEdit
            ? (tr) => {
                setDetailTreatment(null)
                setTimeout(() => setEditTreatment(tr), 220)
              }
            : undefined
        }
      />

      <TreatmentEditSheet
        visible={editTreatment !== null}
        patientId={patientId}
        treatment={editTreatment}
        onClose={() => setEditTreatment(null)}
      />
    </View>
  )
}

function SummaryCard({ c, label, value }: { c: Colors; label: string; value: string }) {
  const styles = useMemo(() => makeStyles(c), [c])
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.backgroundSecondary },
    flex: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: c.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    backBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
      backgroundColor: c.brandLight,
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: spacing.sm,
    },
    headerTitle: {
      ...typography.headline,
      fontFamily: font('600'),
      color: c.label,
    },
    headerSubtitle: {
      ...typography.caption1,
      color: c.labelSecondary as string,
    },
    spacer: { width: 36 },
    scrollContent: {
      padding: spacing.lg,
      gap: spacing.lg,
    },
    summaryRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    summaryCard: {
      flex: 1,
      backgroundColor: c.background,
      padding: spacing.lg,
      borderRadius: radius.xl,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      gap: 4,
    },
    summaryValue: {
      ...typography.title2,
      fontFamily: font('700'),
      color: c.brandDeep as string,
    },
    summaryLabel: {
      ...typography.caption1,
      color: c.labelSecondary as string,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    odontogramCard: {
      backgroundColor: c.background,
      padding: spacing.lg,
      borderRadius: radius.xl,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    loadingWrap: {
      paddingVertical: spacing.xxxl,
      alignItems: 'center',
    },
  })
}
