import React, { useMemo } from 'react'
import { Pressable, View, Text, StyleSheet } from 'react-native'
import { radius, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

interface Props {
  checked: boolean
  onChange: (value: boolean) => void
  label?: string
}

export default function Checkbox({ checked, onChange, label }: Props) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  return (
    <Pressable
      style={styles.row}
      onPress={() => onChange(!checked)}
      hitSlop={8}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Text style={styles.tick}>✓</Text> : null}
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </Pressable>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  box: {
    width: 22,
    height: 22,
    borderRadius: radius.xs,
    borderWidth: 1.5,
    borderColor: c.systemGray3,
    backgroundColor: c.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: c.brand, borderColor: c.brand },
  tick: { fontFamily: font('800'), color: '#FFFFFF', fontSize: 14, fontWeight: '800', lineHeight: 15 },
  label: { ...typography.subhead, color: c.label },
  })
}
