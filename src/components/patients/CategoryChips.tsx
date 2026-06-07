import React, { useMemo } from 'react'
import { ScrollView, Pressable, Text, View, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import { radius, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { useI18n } from '../../i18n'
import type { ApiPatientCategory } from '../../types'

interface Props {
  categories: ApiPatientCategory[]
  activeId: string  // 'all' or category id
  onSelect: (id: string) => void
}

export default function CategoryChips({ categories, activeId, onSelect }: Props) {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])

  const handleSelect = (id: string) => {
    Haptics.selectionAsync()
    onSelect(id)
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      <Chip
        label={t('patients.allCategories')}
        active={activeId === 'all'}
        onPress={() => handleSelect('all')}
      />
      <Chip
        label={t('patients.archived')}
        active={activeId === 'archived'}
        onPress={() => handleSelect('archived')}
      />
      <Chip
        label={t('patients.inactive')}
        active={activeId === 'inactive'}
        onPress={() => handleSelect('inactive')}
      />
      {categories.map((cat) => (
        <Chip
          key={cat.id}
          label={cat.name}
          color={cat.color}
          active={activeId === cat.id}
          onPress={() => handleSelect(cat.id)}
        />
      ))}
    </ScrollView>
  )
}

interface ChipProps {
  label: string
  color?: string
  active: boolean
  onPress: () => void
}

function Chip({ label, color, active, onPress }: ChipProps) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const accent = color ?? (c.brand as string)
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && { backgroundColor: accent, borderColor: accent },
        !active && pressed && styles.chipPressed,
      ]}
    >
      {color && !active ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.separator as string,
  },
  chipPressed: { opacity: 0.6 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    fontFamily: font('600'),
    fontSize: 13,
    fontWeight: '600',
    color: c.labelSecondary,
    letterSpacing: -0.1,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  })
}
