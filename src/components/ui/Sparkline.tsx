import React from 'react'
import { View, ViewStyle, StyleProp } from 'react-native'
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg'

interface Props {
  data: number[]
  width?: number
  height?: number
  strokeColor?: string
  // When provided, draws a soft gradient fill under the curve.
  fillColor?: string
  strokeWidth?: number
  style?: StyleProp<ViewStyle>
}

// Tiny inline trend chart. No labels, no axes — just a smooth path that
// reads as "direction over time" at a glance. Used in finance cards to
// show the recent 7-day trend.
export default function Sparkline({
  data,
  width = 60,
  height = 18,
  strokeColor = '#14B8A6',
  fillColor,
  strokeWidth = 1.5,
  style,
}: Props) {
  if (data.length < 2) {
    return <View style={[{ width, height }, style]} />
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  // Flat lines get a tiny epsilon so the path renders mid-height instead of
  // dividing by zero.
  const range = max - min || 1
  const padY = strokeWidth + 1
  const usableH = height - padY * 2

  const stepX = data.length > 1 ? width / (data.length - 1) : width

  const points = data.map((v, i) => {
    const x = i * stepX
    const y = padY + usableH - ((v - min) / range) * usableH
    return { x, y }
  })

  // Build a smooth Catmull-Rom-ish path using simple Bezier handles between
  // adjacent points. Cheap and visually close to a curve fit.
  const path = points.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x.toFixed(2)} ${p.y.toFixed(2)}`
    const prev = points[i - 1]!
    const midX = (prev.x + p.x) / 2
    return `${acc} Q ${midX.toFixed(2)} ${prev.y.toFixed(2)}, ${midX.toFixed(2)} ${((prev.y + p.y) / 2).toFixed(2)} T ${p.x.toFixed(2)} ${p.y.toFixed(2)}`
  }, '')

  const fillPath = fillColor
    ? `${path} L ${(width).toFixed(2)} ${height} L 0 ${height} Z`
    : null

  return (
    <View style={[{ width, height }, style]}>
      <Svg width={width} height={height}>
        {fillColor ? (
          <Defs>
            <LinearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={fillColor} stopOpacity={0.25} />
              <Stop offset="1" stopColor={fillColor} stopOpacity={0} />
            </LinearGradient>
          </Defs>
        ) : null}
        {fillPath ? <Path d={fillPath} fill="url(#sparkFill)" /> : null}
        <Path
          d={path}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  )
}
