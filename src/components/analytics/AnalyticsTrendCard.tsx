import React, { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import Icon, { type IconName } from '../ui/Icon'
import Sparkline from '../ui/Sparkline'
import { font, radius, shadows } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

interface Props {
  title: string
  rangeLabel: string
  data: number[]
  width: number
  color: string
  icon: IconName
  startValue: string
  endValue: string
}

export default function AnalyticsTrendCard({
  title,
  rangeLabel,
  data,
  width,
  color,
  icon,
  startValue,
  endValue,
}: Props) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <View style={styles.iconBadge}>
            <Icon name={icon} size={17} color={color} />
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={styles.rangeBadge}>
          <Text style={styles.rangeText} numberOfLines={1}>
            {rangeLabel}
          </Text>
        </View>
      </View>

      <View
        style={styles.chart}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${title}. ${rangeLabel}. ${startValue} — ${endValue}`}
      >
        <Sparkline
          data={data}
          width={width}
          height={72}
          strokeColor={color}
          fillColor={color}
          strokeWidth={2.25}
        />
      </View>

      <View style={styles.summary}>
        <Text style={styles.edgeValue} numberOfLines={1} adjustsFontSizeToFit>
          {startValue}
        </Text>
        <View style={styles.summaryLine} />
        <Icon name="arrow-forward" size={12} color={c.labelTertiary as string} />
        <View style={styles.summaryLine} />
        <Text
          style={[styles.edgeValue, styles.edgeValueEnd]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {endValue}
        </Text>
      </View>
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    card: {
      overflow: 'hidden',
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.brandSoft,
      backgroundColor: c.background,
      ...shadows.sm,
    },
    header: {
      minHeight: 46,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingHorizontal: 12,
      paddingTop: 7,
    },
    titleWrap: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    iconBadge: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
      backgroundColor: c.brandSurface,
    },
    title: {
      flex: 1,
      minWidth: 0,
      fontFamily: font('700'),
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '700',
      color: c.label,
    },
    rangeBadge: {
      flexShrink: 0,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.pill,
      backgroundColor: c.fillQuaternary,
    },
    rangeText: {
      fontFamily: font('600'),
      fontSize: 9.5,
      lineHeight: 12,
      fontWeight: '600',
      color: c.labelSecondary,
    },
    chart: {
      minHeight: 80,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 4,
    },
    summary: {
      minHeight: 27,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingBottom: 5,
    },
    summaryLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      marginHorizontal: 5,
      backgroundColor: c.separator,
    },
    edgeValue: {
      maxWidth: '38%',
      fontFamily: font('600'),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: '600',
      color: c.labelSecondary,
    },
    edgeValueEnd: {
      color: c.label,
      textAlign: 'right',
    },
  })
}
