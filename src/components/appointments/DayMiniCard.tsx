import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native'
import * as Haptics from 'expo-haptics'
import { useI18n } from '../../i18n'
import Icon from '../ui/Icon'
import { radius, font, shadows } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { formatTime, formatWeekdayShort, isSameDay } from '../../lib/format'
import type { ApiAppointment } from '../../types'

interface Props {
  date: Date
  appointments: ApiAppointment[]
  onPress: () => void
}

const MAX_VISIBLE = 8
const CARD_MIN_HEIGHT = 260

// Compact day card used in week-grid view. Fixed minHeight so empty days
// stay the same size as full days (uniform grid). Shows up to 8 appointments
// in a single line each, with "+N more" overflow indicator.
export default function DayMiniCard({ date, appointments, onPress }: Props) {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const isToday = isSameDay(date, new Date())

  const STATUS_COLOR: Record<ApiAppointment['status'], string> = {
    scheduled: c.scheduled,
    completed: c.completed,
    cancelled: c.cancelled,
    no_show: c.no_show,
  }

  const sorted = React.useMemo(
    () =>
      [...appointments].sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [appointments]
  )

  const visible = sorted.slice(0, MAX_VISIBLE)
  const overflow = Math.max(0, sorted.length - MAX_VISIBLE)
  const isEmpty = sorted.length === 0

  const scale = React.useRef(new Animated.Value(1)).current
  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start()
  }
  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 6,
    }).start()
  }

  const handlePress = () => {
    Haptics.selectionAsync()
    onPress()
  }

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <Pressable
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.card, shadows.sm]}
      >
        {/* Header — single compact row */}
        <View style={[styles.header, isToday && styles.headerToday]}>
          <View style={styles.headerLeft}>
            <Text style={[styles.weekday, isToday && styles.weekdayToday]}>
              {formatWeekdayShort(date, locale).slice(0, 3)}
            </Text>
            <Text style={[styles.dayNumber, isToday && styles.dayNumberToday]}>
              {date.getDate()}
            </Text>
            {isToday ? (
              <View style={styles.todayBadge}>
                <Text style={styles.todayBadgeText}>{t('appointments.todayBadge')}</Text>
              </View>
            ) : null}
          </View>
          <Icon
            name="expand-outline"
            size={13}
            color={isToday ? 'rgba(255,255,255,0.85)' : (c.labelTertiary as string)}
          />
        </View>

        {/* Body */}
        <View style={styles.body}>
          {isEmpty ? (
            <View style={styles.emptyBody}>
              <View style={styles.emptyIconWrap}>
                <Icon
                  name="add"
                  size={20}
                  color={isToday ? (c.brand as string) : (c.labelTertiary as string)}
                />
              </View>
            </View>
          ) : (
            <View style={styles.appointmentsList}>
              {visible.map((apt) => (
                <View key={apt.id} style={styles.aptRow}>
                  <View
                    style={[
                      styles.aptDot,
                      { backgroundColor: STATUS_COLOR[apt.status] },
                      apt.status === 'cancelled' && { opacity: 0.5 },
                    ]}
                  />
                  <Text style={styles.aptTime}>{formatTime(apt.start_time)}</Text>
                  <Text
                    style={[
                      styles.aptName,
                      apt.status === 'cancelled' && styles.aptNameStruck,
                    ]}
                    numberOfLines={1}
                  >
                    {apt.patient_name || '—'}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Edge-to-edge overflow footer */}
        {overflow > 0 ? (
          <View style={styles.moreFooter}>
            <Text style={styles.moreText}>
              {t('appointments.moreCount', { n: overflow })}
            </Text>
            <Icon name="chevron-forward" size={12} color={c.brand as string} />
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    card: {
      flex: 1,
      // Single elevated surface — no nested fill colors. Body, header, and
      // footer share the same background so the card reads as one unified
      // panel rather than a stack of brand-tinted slabs.
      backgroundColor: c.backgroundSecondary,
      borderRadius: radius.xl,
      overflow: 'hidden',
      minHeight: CARD_MIN_HEIGHT,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.separator as string,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator as string,
    },
    // Today gets the only brand accent in the whole card: a saturated
    // header. Body + footer stay neutral so the card has one focal point.
    headerToday: {
      backgroundColor: c.brand,
      borderBottomColor: c.brand,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
    },
    weekday: {
      fontFamily: font('700'),
      fontSize: 11,
      fontWeight: '700',
      color: c.labelSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    weekdayToday: {
      color: 'rgba(255,255,255,0.9)',
    },
    dayNumber: {
      fontFamily: font('700'),
      fontSize: 18,
      fontWeight: '700',
      color: c.label,
      letterSpacing: -0.3,
    },
    dayNumberToday: {
      color: '#FFFFFF',
    },
    todayBadge: {
      marginLeft: 4,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 4,
      backgroundColor: 'rgba(255,255,255,0.22)',
    },
    todayBadgeText: {
      fontFamily: font('800'),
      fontSize: 9,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: 0.6,
    },
    // Body is intentionally bg-less — it inherits the card surface. The
    // earlier brandLight wash for today was fighting the brand header.
    //
    // NOTE: appointments anchor to the TOP of the body (`flex-start`) so
    // a card with fewer items doesn't visually "sink" relative to its
    // taller neighbor — both cards in a row read as left-aligned lists.
    // The empty-state icon centers itself via its own `flex: 1` wrapper.
    body: {
      flex: 1,
      paddingHorizontal: 10,
      paddingVertical: 10,
      justifyContent: 'flex-start',
    },
    appointmentsList: {
      gap: 5,
    },
    aptRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    aptDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
    },
    aptTime: {
      fontFamily: font('700'),
      fontSize: 11.5,
      fontWeight: '700',
      color: c.label,
      letterSpacing: -0.1,
      minWidth: 36,
    },
    aptName: {
      flex: 1,
      fontFamily: font('500'),
      fontSize: 11.5,
      fontWeight: '500',
      color: c.labelSecondary,
    },
    aptNameStruck: {
      textDecorationLine: 'line-through',
      color: c.labelTertiary,
    },
    // Footer inherits the card surface too. A hairline rule + brand-colored
    // label is enough signal; no full-bleed fill needed.
    moreFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.separator as string,
    },
    moreText: {
      fontFamily: font('700'),
      fontSize: 11,
      fontWeight: '700',
      color: c.brand,
      letterSpacing: 0.1,
    },
    emptyBody: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.fillQuaternary,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
}
