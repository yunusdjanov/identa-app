import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useI18n } from '../../i18n'
import { spacing, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import ToothChip, { type ToothChipState } from './ToothChip'

// Universal tooth numbering (1–32) split into 4 quadrants, the same shape the
// web app's TreatmentHistoryCard renders:
//   ┌─ Yuqori o'ng ──┐ ┌─ Yuqori chap ─┐
//   │ 8 7 6 5 4 3 2 1│ │ 9 10 ... 16   │
//   └────────────────┘ └───────────────┘
//   ┌─ Pastki o'ng ──┐ ┌─ Pastki chap ─┐
//   │ 32 31 ... 25   │ │ 17 18 ... 24  │
//   └────────────────┘ └───────────────┘
//
// We render the four quadrants on four separate rows of 8 on mobile (instead
// of the web's two rows of 16) because chips would shrink below the 32dp tap
// target on a narrow phone otherwise.
const UPPER_RIGHT = [8, 7, 6, 5, 4, 3, 2, 1]
const UPPER_LEFT = [9, 10, 11, 12, 13, 14, 15, 16]
const LOWER_RIGHT = [32, 31, 30, 29, 28, 27, 26, 25]
const LOWER_LEFT = [17, 18, 19, 20, 21, 22, 23, 24]

// Shape consumers pass for view mode: per-tooth condition + an optional
// treatment count badge. We use plain numeric keys here (1–32) because that's
// what the ApiTreatment.teeth array and ApiOdontogramEntry.tooth_number both
// speak.
export type ToothConditionMap = Partial<Record<number, ToothChipState>>
export type ToothBadgeMap = Partial<Record<number, number>>

type CommonProps = {
  showHeader?: boolean
  showQuadrantLabels?: boolean
  size?: 'compact' | 'default'
}

type PickerProps = CommonProps & {
  mode: 'picker'
  selectedTeeth: number[]
  onToggleTooth: (tooth: number) => void
}

type ViewProps = CommonProps & {
  mode: 'view'
  conditions?: ToothConditionMap
  badges?: ToothBadgeMap
  onPressTooth?: (tooth: number) => void
}

type Props = PickerProps | ViewProps

export default function Odontogram(props: Props) {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])

  const { showHeader = true, showQuadrantLabels = true, size = 'default', mode } = props

  // Pre-resolve per-tooth state once so the inner map call stays cheap. In
  // picker mode the state is just selected/neutral; in view mode it's the
  // stored condition (falling back to neutral when there's no entry yet).
  const resolveState = (tooth: number): ToothChipState => {
    if (mode === 'picker') {
      return props.selectedTeeth.includes(tooth) ? 'selected' : 'neutral'
    }
    return props.conditions?.[tooth] ?? 'neutral'
  }

  const handlePress = (tooth: number) => {
    if (mode === 'picker') {
      props.onToggleTooth(tooth)
    } else if (props.onPressTooth) {
      props.onPressTooth(tooth)
    }
  }

  const renderRow = (teeth: number[], quadrantLabel: string) => (
    <View>
      {showQuadrantLabels ? (
        <Text style={styles.quadrantLabel}>{quadrantLabel}</Text>
      ) : null}
      <View style={styles.row}>
        {teeth.map((n) => (
          <ToothChip
            key={n}
            number={n}
            state={resolveState(n)}
            badge={mode === 'view' ? props.badges?.[n] : undefined}
            onPress={mode === 'picker' || props.onPressTooth ? handlePress : undefined}
            size={size}
          />
        ))}
      </View>
    </View>
  )

  return (
    <View style={styles.wrap}>
      {showHeader ? <Text style={styles.title}>{t('odontogram.title')}</Text> : null}

      <View style={styles.jaw}>
        <Text style={styles.jawLabel}>{t('odontogram.upperJaw')}</Text>
        {renderRow(UPPER_RIGHT, t('odontogram.upperRight'))}
        {renderRow(UPPER_LEFT, t('odontogram.upperLeft'))}
      </View>

      <View style={styles.jaw}>
        <Text style={styles.jawLabel}>{t('odontogram.lowerJaw')}</Text>
        {renderRow(LOWER_RIGHT, t('odontogram.lowerRight'))}
        {renderRow(LOWER_LEFT, t('odontogram.lowerLeft'))}
      </View>

      {mode === 'picker' ? (
        <Text style={styles.hint}>{t('odontogram.pickerHint')}</Text>
      ) : null}
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    wrap: {
      gap: spacing.md,
    },
    title: {
      ...typography.headline,
      fontFamily: font('600'),
      color: c.label,
    },
    jaw: {
      gap: spacing.sm,
    },
    jawLabel: {
      ...typography.footnoteBold,
      fontFamily: font('600'),
      color: c.labelSecondary as string,
      // Match the web app's all-caps quadrant headers — visually anchors the
      // chips below as a group without dominating the section.
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    quadrantLabel: {
      ...typography.caption1,
      color: c.labelTertiary as string,
      marginBottom: 4,
    },
    row: {
      flexDirection: 'row',
      gap: 6,
      alignItems: 'center',
    },
    hint: {
      ...typography.caption1,
      color: c.labelSecondary as string,
      marginTop: spacing.xs,
    },
  })
}
