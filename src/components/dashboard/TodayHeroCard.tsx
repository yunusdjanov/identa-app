import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import Icon from '../ui/Icon'
import PatientAvatar from '../ui/PatientAvatar'
import { useI18n } from '../../i18n'
import { radius, typography, shadows, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { formatTime } from '../../lib/format'
import type { DashboardAppointmentView } from '../../types'

interface Props {
  totalCount: number
  remainingCount: number
  next?: DashboardAppointmentView | null
  onPressViewAll?: () => void
  onPressNext?: () => void
}

export default function TodayHeroCard({
  totalCount,
  remainingCount,
  next,
  onPressViewAll,
  onPressNext,
}: Props) {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])

  const handleViewAll = () => {
    if (onPressViewAll) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      onPressViewAll()
    }
  }

  const handleNext = () => {
    if (onPressNext) {
      Haptics.selectionAsync()
      onPressNext()
    }
  }

  return (
    <View>
      <LinearGradient
        colors={[c.brand, '#0E9C8E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, shadows.lg]}
      >
        {/* Decorative blurred circles */}
        <View style={[styles.glow, styles.glowOne]} />
        <View style={[styles.glow, styles.glowTwo]} />

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Icon name="calendar-outline" size={18} color="rgba(255,255,255,0.85)" />
            <Text style={styles.headerLabel}>{t('dashboard.today')}</Text>
          </View>
          {onPressViewAll ? (
            <Pressable
              onPress={handleViewAll}
              hitSlop={10}
              style={({ pressed }) => pressed && { opacity: 0.65 }}
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.viewAll')}
            >
              <Icon name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.metricBlock}>
          <Text style={styles.value}>{remainingCount}</Text>
          <View style={styles.metricMeta}>
            <Text style={styles.unit}>{t('dashboard.remaining')}</Text>
            <Text style={styles.total}>{t('dashboard.totalAppointments', { n: totalCount })}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {next ? (
          <Pressable
            onPress={handleNext}
            style={({ pressed }) => [styles.nextRow, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel={`${t('dashboard.next')}: ${next.patient_name}, ${formatTime(next.start_time)}`}
          >
            <PatientAvatar name={next.patient_name} size={30} />
            <View style={styles.nextText}>
              <Text style={styles.nextLabel}>
                {t('dashboard.next')} · {formatTime(next.start_time)}
              </Text>
              <Text style={styles.nextName} numberOfLines={1}>
                {next.patient_name}
              </Text>
            </View>
            <Icon name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
          </Pressable>
        ) : (
          <Text style={styles.empty}>{t('dashboard.noUpcoming')}</Text>
        )}
      </LinearGradient>
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
  card: {
    borderRadius: radius.xxl,
    padding: 16,
    overflow: 'hidden',
    shadowColor: c.brand,
    shadowOpacity: 0.3,
  },
  glow: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 200,
  },
  glowOne: {
    width: 130,
    height: 130,
    top: -45,
    right: -30,
  },
  glowTwo: {
    width: 90,
    height: 90,
    bottom: -30,
    left: -15,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerLabel: {
    fontFamily: font('600'),
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.2,
    fontSize: 13,
    fontWeight: '600',
  },
  metricBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  metricMeta: { gap: 1 },
  value: {
    fontFamily: font('800'),
    fontSize: 40,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1.5,
    lineHeight: 44,
  },
  unit: {
    fontFamily: font('600'),
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  total: {
    fontFamily: font('500'),
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.68)',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: 10,
  },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nextText: {
    flex: 1,
    gap: 1,
  },
  nextLabel: {
    fontFamily: font('700'),
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    fontWeight: '700',
    fontSize: 10,
  },
  nextName: {
    ...typography.subheadBold,
    color: '#FFFFFF',
  },
  empty: {
    ...typography.footnote,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    paddingVertical: 2,
  },
  })
}
