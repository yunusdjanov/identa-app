import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native'
import * as Haptics from 'expo-haptics'

import BottomSheet from './BottomSheet'
import Button from './Button'
import { useI18n } from '../../i18n'
import { toIntlLocale } from '../../lib/format'
import type { Locale } from '../../constants'
import { font, radius, spacing } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

const ITEM_HEIGHT = 44
const VISIBLE_ITEMS = 5
const PADDING_Y = ((VISIBLE_ITEMS - 1) / 2) * ITEM_HEIGHT

interface Props {
  visible: boolean
  value: string | null // 'YYYY-MM-DD' or null
  title?: string
  minYear?: number
  maxYear?: number
  onClose: () => void
  onConfirm: (date: string) => void
}

// iOS-style three-column wheel picker for picking a date.
// Year column spans minYear..maxYear, month column is locale-aware short
// names, and day column auto-clamps when the selected month changes.
export default function DateWheelPicker({
  visible,
  value,
  title,
  minYear = 1925,
  maxYear = new Date().getFullYear() + 1,
  onClose,
  onConfirm,
}: Props) {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])

  const [year, setYear] = useState<number>(() => parseInitial(value).year)
  const [month, setMonth] = useState<number>(() => parseInitial(value).month)
  const [day, setDay] = useState<number>(() => parseInitial(value).day)

  useEffect(() => {
    if (!visible) return
    const v = parseInitial(value)
    setYear(v.year)
    setMonth(v.month)
    setDay(v.day)
  }, [visible, value])

  const years = useMemo(() => {
    const arr: number[] = []
    for (let y = maxYear; y >= minYear; y--) arr.push(y)
    return arr
  }, [minYear, maxYear])
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), [])
  const monthLabels = useMemo(() => getMonthLabels(locale as Locale), [locale])
  const daysInMonth = getDaysInMonth(year, month)
  const days = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => i + 1),
    [daysInMonth]
  )

  // Clamp day when month or year changes to a shorter month
  useEffect(() => {
    if (day > daysInMonth) setDay(daysInMonth)
  }, [daysInMonth, day])

  const handleConfirm = () => {
    const dateStr = `${year}-${pad(month)}-${pad(day)}`
    onConfirm(dateStr)
    onClose()
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title ?? t('patients.form.dob')}
      scroll={false}
    >
      <View style={styles.pickerCard}>
        {/* Center selection bar */}
        <View style={[styles.selectionBar, { top: PADDING_Y }]} pointerEvents="none" />

        <Wheel items={days} value={day} onChange={setDay} formatItem={String} />
        <Wheel
          items={months}
          value={month}
          onChange={setMonth}
          formatItem={(m) => monthLabels[m - 1] ?? String(m)}
        />
        <Wheel items={years} value={year} onChange={setYear} formatItem={String} />
      </View>

      <Button title={t('common.done')} onPress={handleConfirm} fullWidth size="lg" />
    </BottomSheet>
  )
}

function Wheel<T extends number>({
  items,
  value,
  onChange,
  formatItem,
}: {
  items: T[]
  value: T
  onChange: (v: T) => void
  formatItem: (v: T) => string
}) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const ref = useRef<ScrollView>(null)
  const lastScrolled = useRef<T | null>(null)
  // Tracks the live scroll-derived index so items animate continuously
  // (size + color) as the user drags, not only at snap end.
  const [liveIndex, setLiveIndex] = useState<number>(() => items.indexOf(value))

  // Snap to value whenever it changes externally (initial mount, day clamp, etc.)
  useEffect(() => {
    if (lastScrolled.current === value) return
    const idx = items.indexOf(value)
    if (idx < 0) return
    setLiveIndex(idx)
    const id = setTimeout(() => {
      ref.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: false })
      lastScrolled.current = value
    }, 0)
    return () => clearTimeout(id)
  }, [items, value])

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT)
    const clamped = Math.max(0, Math.min(items.length - 1, idx))
    if (clamped !== liveIndex) setLiveIndex(clamped)
  }

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT)
    const clamped = Math.max(0, Math.min(items.length - 1, idx))
    const next = items[clamped]
    if (next === undefined) return
    lastScrolled.current = next
    if (next !== value) {
      Haptics.selectionAsync()
      onChange(next)
    }
  }

  return (
    <View style={styles.wheelCol}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: PADDING_Y }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onMomentumEnd}
        nestedScrollEnabled
      >
        {items.map((item, i) => {
          const distance = Math.abs(i - liveIndex)
          const isCenter = distance === 0
          return (
            <View key={String(item)} style={styles.item}>
              <Text
                style={[
                  styles.itemText,
                  isCenter && styles.itemTextCenter,
                  distance === 1 && styles.itemTextNear,
                  distance >= 2 && styles.itemTextFar,
                ]}
                numberOfLines={1}
              >
                {formatItem(item)}
              </Text>
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

function parseInitial(value: string | null): { year: number; month: number; day: number } {
  if (value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (m) {
      const y = parseInt(m[1]!, 10)
      const mo = parseInt(m[2]!, 10)
      const d = parseInt(m[3]!, 10)
      if (!Number.isNaN(y) && !Number.isNaN(mo) && !Number.isNaN(d)) {
        return { year: y, month: mo, day: d }
      }
    }
  }
  const today = new Date()
  return { year: today.getFullYear() - 30, month: 1, day: 1 }
}

function getDaysInMonth(year: number, month: number): number {
  // Month is 1-12 here; Date(year, month, 0) gives the last day of `month`.
  return new Date(year, month, 0).getDate()
}

function getMonthLabels(locale: Locale): string[] {
  const fmt = new Intl.DateTimeFormat(toIntlLocale(locale), { month: 'short' })
  return Array.from({ length: 12 }, (_, i) => {
    const label = fmt.format(new Date(2000, i, 1))
    // Capitalize first letter (some locales return lowercase, e.g. ru: "янв.")
    return label.charAt(0).toUpperCase() + label.slice(1).replace(/\.$/, '')
  })
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    pickerCard: {
      flexDirection: 'row',
      height: ITEM_HEIGHT * VISIBLE_ITEMS,
      backgroundColor: c.fillQuaternary,
      borderRadius: radius.xl,
      position: 'relative',
      overflow: 'hidden',
      marginBottom: spacing.lg,
    },
    selectionBar: {
      position: 'absolute',
      left: 12,
      right: 12,
      height: ITEM_HEIGHT,
      backgroundColor: c.brandLight,
      borderRadius: radius.md,
    },
    wheelCol: {
      flex: 1,
    },
    item: {
      height: ITEM_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemText: {
      fontFamily: font('600'),
      fontSize: 16,
      fontWeight: '600',
      color: c.labelTertiary,
    },
    itemTextCenter: {
      fontFamily: font('700'),
      fontSize: 20,
      fontWeight: '700',
      color: c.brandDeep,
    },
    itemTextNear: {
      fontFamily: font('600'),
      fontSize: 17,
      fontWeight: '600',
      color: c.labelSecondary,
    },
    itemTextFar: {
      fontFamily: font('500'),
      fontSize: 15,
      fontWeight: '500',
      color: c.labelTertiary,
      opacity: 0.5,
    },
  })
}
