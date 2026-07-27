import React, { useMemo } from 'react'
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { useI18n } from '../../i18n'
import { formatTime, formatWeekdayShort, isSameDay } from '../../lib/format'
import { font, radius } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import type { ApiAppointment } from '../../types'

interface Props {
  date: Date
  appointments: ApiAppointment[]
  onPress: () => void
  side: 'left' | 'right'
}

export const PLANNER_PAPER_LINE_COUNT = 10
const PLANNER_ROW_HORIZONTAL_INSET = 10
const PLANNER_PAGE_SHADOW = {
  shadowColor: '#000000',
  shadowOpacity: 0.055,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
} as const
export const PLANNER_DATE_RAIL_HEIGHT = 112
export const PLANNER_DATE_RAIL_WIDTH = 28
const PLANNER_DATE_RAIL_OUTER_GUTTER = 2
export const PLANNER_CARD_HEIGHT = 212
const PLANNER_PAGE_VERTICAL_MARGIN = 3
export const PLANNER_APPOINTMENT_ROW_HEIGHT =
  (PLANNER_CARD_HEIGHT -
    PLANNER_PAGE_VERTICAL_MARGIN * 2 -
    StyleSheet.hairlineWidth * 2) /
  PLANNER_PAPER_LINE_COUNT

export default function DayMiniCard({ date, appointments, onPress, side }: Props) {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const isToday = isSameDay(date, new Date())

  const sorted = useMemo(
    () => [...appointments].sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [appointments]
  )
  const scale = React.useRef(new Animated.Value(1)).current

  const month = new Intl.DateTimeFormat(
    locale === 'uz' ? 'uz-UZ' : locale === 'ru' ? 'ru-RU' : 'en-US',
    { month: 'short' }
  )
    .format(date)
    .replace('.', '')

  const handlePress = () => {
    onPress()
  }

  return (
    <Animated.View style={[styles.flex, { transform: [{ scale }] }]}>
      <Pressable
        onPress={handlePress}
        onPressIn={() => {
          Animated.spring(scale, {
            toValue: 0.985,
            useNativeDriver: true,
            speed: 50,
            bounciness: 0,
          }).start()
        }}
        onPressOut={() => {
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
          }).start()
        }}
        style={styles.card}
        accessibilityRole="button"
        accessibilityLabel={`${formatWeekdayShort(date, locale)} ${date.getDate()}, ${t(
          'appointments.planner.count',
          { n: appointments.length }
        )}`}
      >
        <View style={[styles.cardSurface, side === 'right' && styles.cardRight]}>
          <View
            testID="planner-date-rail"
            style={[
              styles.dateRail,
              isToday && styles.dateRailToday,
              side === 'left' ? styles.dateRailLeft : styles.dateRailRight,
            ]}
          >
            <Text
              maxFontSizeMultiplier={1.25}
              style={[styles.weekday, isToday && styles.dateRailMetaToday]}
            >
              {formatWeekdayShort(date, locale).slice(0, 3)}
            </Text>
            <View style={styles.dayNumberBadge}>
              <Text
                maxFontSizeMultiplier={1.25}
                style={[styles.dayNumber, isToday && styles.dayNumberToday]}
              >
                {date.getDate()}
              </Text>
            </View>
            <Text
              maxFontSizeMultiplier={1.25}
              style={[styles.month, isToday && styles.dateRailMetaToday]}
            >
              {month}
            </Text>
          </View>

          <View style={[styles.page, PLANNER_PAGE_SHADOW]}>
            <View
              style={styles.paperLines}
              pointerEvents="none"
              testID="planner-paper-lines"
            >
              {Array.from({ length: PLANNER_PAPER_LINE_COUNT }).map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.paperLine,
                    index === PLANNER_PAPER_LINE_COUNT - 1 && styles.paperLineLast,
                  ]}
                  testID="planner-paper-line"
                />
              ))}
            </View>
            {sorted.length > 0 && (
              <ScrollView
                testID="planner-appointment-scroll"
                style={styles.appointmentScroll}
                contentContainerStyle={styles.appointmentContent}
                scrollEnabled={sorted.length > PLANNER_PAPER_LINE_COUNT}
                nestedScrollEnabled
                showsVerticalScrollIndicator={sorted.length > PLANNER_PAPER_LINE_COUNT}
              >
                {sorted.map((appointment) => (
                  <View
                    key={appointment.id}
                    testID="planner-appointment-row"
                    style={[
                      styles.appointmentRow,
                      (appointment.status === 'cancelled' ||
                        appointment.status === 'no_show') &&
                        styles.appointmentRowMuted,
                    ]}
                  >
                    <Text maxFontSizeMultiplier={1.25} style={styles.appointmentTime}>
                      {formatTime(appointment.start_time)}
                    </Text>
                    <View
                      style={styles.appointmentDivider}
                      pointerEvents="none"
                      testID="planner-appointment-divider"
                    />
                    <Text
                      maxFontSizeMultiplier={1.25}
                      style={styles.patientName}
                      numberOfLines={1}
                    >
                      {appointment.patient_name || appointment.guest_name || '—'}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    flex: {
      flex: 1,
      minWidth: 0,
    },
    card: {
      height: PLANNER_CARD_HEIGHT,
      overflow: 'visible',
      borderRadius: radius.xxl,
      backgroundColor: 'transparent',
    },
    cardSurface: {
      flex: 1,
      flexDirection: 'row',
      overflow: 'visible',
      backgroundColor: 'transparent',
    },
    cardRight: {
      flexDirection: 'row-reverse',
    },
    dateRail: {
      width: PLANNER_DATE_RAIL_WIDTH,
      height: PLANNER_DATE_RAIL_HEIGHT,
      alignSelf: 'center',
      alignItems: 'center',
      backgroundColor: c.brandSurface,
      justifyContent: 'center',
      gap: 1,
      borderWidth: 1,
      borderColor: c.brandSoft,
      zIndex: 3,
    },
    dateRailLeft: {
      marginLeft: PLANNER_DATE_RAIL_OUTER_GUTTER,
      marginRight: -StyleSheet.hairlineWidth,
      borderRightWidth: 1,
      borderRightColor: c.brandSoft,
      borderTopLeftRadius: radius.md,
      borderBottomLeftRadius: radius.md,
    },
    dateRailRight: {
      marginLeft: -StyleSheet.hairlineWidth,
      marginRight: PLANNER_DATE_RAIL_OUTER_GUTTER,
      borderLeftWidth: 1,
      borderLeftColor: c.brandSoft,
      borderTopRightRadius: radius.md,
      borderBottomRightRadius: radius.md,
    },
    dateRailToday: {
      backgroundColor: c.brand,
      borderColor: c.brand,
    },
    weekday: {
      fontFamily: font('700'),
      fontSize: 9,
      lineHeight: 11,
      fontWeight: '700',
      color: c.brand,
      textTransform: 'uppercase',
      letterSpacing: 0.45,
    },
    dayNumber: {
      fontFamily: font('800'),
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '800',
      color: c.brandDeep,
    },
    dayNumberBadge: {
      width: 22,
      height: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
    },
    dayNumberToday: {
      color: '#FFFFFF',
    },
    month: {
      fontFamily: font('500'),
      fontSize: 9,
      lineHeight: 11,
      fontWeight: '500',
      color: c.brand,
      textTransform: 'capitalize',
    },
    dateRailMetaToday: {
      color: 'rgba(255, 255, 255, 0.84)',
    },
    page: {
      flex: 1,
      minWidth: 0,
      padding: 0,
      marginVertical: PLANNER_PAGE_VERTICAL_MARGIN,
      marginHorizontal: 0,
      overflow: 'hidden',
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.fillTertiary as string,
      backgroundColor: c.backgroundTertiary,
      zIndex: 2,
    },
    paperLines: {
      ...StyleSheet.absoluteFillObject,
      top: 0,
      bottom: 0,
      paddingHorizontal: PLANNER_ROW_HORIZONTAL_INSET,
      opacity: 0.34,
    },
    paperLine: {
      flex: 1,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator as string,
    },
    paperLineLast: {
      // The page border already closes the final slot. A second line here
      // makes the bottom row look optically shorter than the other nine.
      borderBottomWidth: 0,
    },
    appointmentScroll: {
      flex: 1,
      zIndex: 1,
    },
    appointmentContent: {
      flexGrow: 1,
    },
    appointmentRow: {
      height: PLANNER_APPOINTMENT_ROW_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: PLANNER_ROW_HORIZONTAL_INSET,
    },
    appointmentRowMuted: {
      opacity: 0.5,
    },
    appointmentTime: {
      fontFamily: font('700'),
      fontSize: 9,
      fontWeight: '700',
      color: c.brand,
      width: 30,
      textAlign: 'right',
    },
    appointmentDivider: {
      width: 1,
      height: 12,
      borderRadius: 1,
      backgroundColor: c.brand,
      opacity: 0.34,
    },
    patientName: {
      flex: 1,
      minWidth: 0,
      fontFamily: font('700'),
      fontSize: 9,
      lineHeight: 12,
      fontWeight: '700',
      color: c.label,
    },
  })
}
