import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import BottomSheet from '../ui/BottomSheet'
import InputCard from '../ui/InputCard'
import Button from '../ui/Button'
import { useToast } from '../ui/Toast'
import { getProfile, updateProfile } from '../../api/profile'
import { useI18n } from '../../i18n'
import { radius, spacing, font, typography } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { isOfflineError } from '../../lib/offlineGuard'

interface Props {
  visible: boolean
  onClose: () => void
}

const DURATION_OPTIONS = [15, 30, 45, 60]

export default function WorkingHoursSheet({ visible, onClose }: Props) {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const toast = useToast()
  const queryClient = useQueryClient()

  const profileQuery = useQuery({
    queryKey: ['settings', 'profile'],
    queryFn: getProfile,
    enabled: visible,
    staleTime: 60_000,
  })

  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('18:00')
  const [duration, setDuration] = useState(30)

  useEffect(() => {
    if (profileQuery.data) {
      setStart(profileQuery.data.working_hours.start ?? '09:00')
      setEnd(profileQuery.data.working_hours.end ?? '18:00')
      setDuration(profileQuery.data.default_appointment_duration ?? 30)
    }
  }, [profileQuery.data])

  const mutation = useMutation({
    mutationFn: () =>
      updateProfile({
        working_hours_start: start,
        working_hours_end: end,
        default_appointment_duration: duration,
      }),
    onSuccess: () => {
      toast.success(t('settings.hoursSheet.saved'))
      queryClient.invalidateQueries({ queryKey: ['settings', 'profile'] })
      onClose()
    },
    onError: (err) => {
      if (isOfflineError(err)) return
      toast.error(t('settings.hoursSheet.failed'))
    },
  })

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('settings.rows.workingHours')}>
      <View style={styles.scheduleNote}>
        <Text style={styles.scheduleText}>
          {t('settings.hoursSheet.currentSchedule', { start, end })}
        </Text>
      </View>

      <View style={styles.timeRow}>
        <Field label={t('settings.hoursSheet.startLabel')} style={{ flex: 1 }}>
          <InputCard
            iconName="time-outline"
            value={start}
            onChangeText={(v) => setStart(sanitizeTime(v))}
            placeholder="09:00"
            keyboardType="numeric"
            maxLength={5}
          />
        </Field>
        <Field label={t('settings.hoursSheet.endLabel')} style={{ flex: 1 }}>
          <InputCard
            iconName="time-outline"
            value={end}
            onChangeText={(v) => setEnd(sanitizeTime(v))}
            placeholder="18:00"
            keyboardType="numeric"
            maxLength={5}
          />
        </Field>
      </View>

      <Field label={t('settings.hoursSheet.durationLabel')}>
        <View style={styles.durationRow}>
          {DURATION_OPTIONS.map((d) => {
            const active = d === duration
            return (
              <Pressable
                key={d}
                onPress={() => {
                  Haptics.selectionAsync()
                  setDuration(d)
                }}
                style={[styles.durationChip, active && styles.durationChipActive]}
              >
                <Text style={[styles.durationText, active && styles.durationTextActive]}>
                  {t('appointments.durationShort', { n: d })}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </Field>

      <Button
        title={t('settings.hoursSheet.save')}
        onPress={() => mutation.mutate()}
        loading={mutation.isPending}
        fullWidth
        size="lg"
        style={{ marginTop: spacing.xs }}
      />
    </BottomSheet>
  )
}

function Field({
  label,
  children,
  style,
}: {
  label: string
  children: React.ReactNode
  style?: any
}) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

function sanitizeTime(input: string): string {
  let out = input.replace(/[^\d:]/g, '')
  if (out.length === 2 && !out.includes(':')) out = out + ':'
  if (out.length > 5) out = out.slice(0, 5)
  return out
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    field: { gap: 6 },
    fieldLabel: {
      fontFamily: font('700'),
      fontSize: 12,
      fontWeight: '700',
      color: c.labelSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginLeft: 4,
    },
    scheduleNote: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: c.brandLight,
      borderRadius: radius.lg,
    },
    scheduleText: {
      ...typography.subhead,
      fontFamily: font('600'),
      fontWeight: '600',
      color: c.brandDeep,
    },
    timeRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    durationRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    durationChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radius.pill,
      backgroundColor: c.fillQuaternary,
    },
    durationChipActive: { backgroundColor: c.brand },
    durationText: {
      fontFamily: font('600'),
      fontSize: 13,
      fontWeight: '600',
      color: c.label,
    },
    durationTextActive: { color: '#FFFFFF' },
  })
}
