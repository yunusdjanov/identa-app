import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { useI18n } from '../../i18n'

// Apple Calendar–style "now" indicator: dot on the left + thin red line
// across the row, with a "Now / Сейчас / Hozir" label.
// Refreshes its label every minute so the time stays accurate while open.
export default function NowLine() {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')

  return (
    <View style={styles.row}>
      <View style={styles.timeColumn}>
        <Text style={styles.time}>{`${hh}:${mm}`}</Text>
        <Text style={styles.label}>{t('appointments.now')}</Text>
      </View>
      <View style={styles.lineWrap}>
        <View style={styles.dot} />
        <View style={styles.line} />
      </View>
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  timeColumn: {
    width: 52,
  },
  time: {
    fontFamily: font('700'),
    fontSize: 13,
    fontWeight: '700',
    color: c.danger,
    letterSpacing: -0.1,
  },
  label: {
    fontFamily: font('600'),
    fontSize: 9,
    fontWeight: '600',
    color: c.danger,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  lineWrap: {
    flex: 1,
    marginLeft: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.danger,
  },
  line: {
    flex: 1,
    height: 1.5,
    backgroundColor: c.danger,
    borderRadius: 1,
  },
  })
}
