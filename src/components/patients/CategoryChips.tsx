import React, { useMemo } from 'react'
import { ScrollView, Pressable, Text, View, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import Icon, { type IconName } from '../ui/Icon'
import { radius, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { useI18n } from '../../i18n'
import type { ApiPatientCategory } from '../../types'

interface Props {
  categories: ApiPatientCategory[]
  activeId: string  // 'all' or category id
  onSelect: (id: string) => void
  showReset?: boolean
  onReset?: () => void
}

export default function CategoryChips({ categories, activeId, onSelect, showReset, onReset }: Props) {
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
      {showReset && onReset ? (
        <Chip
          label={t('patients.resetFilters')}
          iconName="close-circle-outline"
          active={false}
          onPress={() => {
            Haptics.selectionAsync()
            onReset()
          }}
        />
      ) : null}
      <Chip
        label={t('patients.archived')}
        active={activeId === 'archived'}
        onPress={() => handleSelect('archived')}
      />
      <Chip
        label={t('patients.inactive6m')}
        active={activeId === 'inactive'}
        onPress={() => handleSelect('inactive')}
      />
      <Chip
        label={t('patients.inactive1y')}
        active={activeId === 'inactive_1y'}
        onPress={() => handleSelect('inactive_1y')}
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
  iconName?: IconName
  active: boolean
  onPress: () => void
}

function Chip({ label, color, iconName, active, onPress }: ChipProps) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  return (
    <View style={styles.chipTouchSlot}>
      <Pressable
        onPress={onPress}
        hitSlop={{ top: 6, bottom: 6 }}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={label}
        style={({ pressed }) => [
          styles.chip,
          active && styles.chipActive,
          !active && pressed && styles.chipPressed,
        ]}
      >
        {iconName ? <Icon name={iconName} size={14} color={c.labelSecondary as string} /> : null}
        {color ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
        <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      </Pressable>
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    gap: 6,
  },
  chipTouchSlot: {
    height: 44,
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: c.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.separator as string,
  },
  chipPressed: { opacity: 0.6 },
  chipActive: {
    backgroundColor: c.brand,
    borderColor: c.brand,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipText: {
    fontFamily: font('600'),
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    color: c.labelSecondary,
    letterSpacing: -0.1,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  })
}
