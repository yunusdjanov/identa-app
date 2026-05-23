import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'

import BottomSheet from '../ui/BottomSheet'
import InputCard from '../ui/InputCard'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import PatientAvatar from '../ui/PatientAvatar'
import EmptyState from '../ui/EmptyState'
import { useToast } from '../ui/Toast'

import {
  listAssistants,
  createAssistant,
  updateAssistant,
  deleteAssistant,
} from '../../api/team'
import { useI18n } from '../../i18n'
import type { TFunction } from '../../i18n/helpers'
import { radius, spacing, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { isOfflineError } from '../../lib/offlineGuard'
import { getRelativeDateBucket } from '../../lib/format'
import { applyPhoneInput, formatStoredPhone } from '../../lib/phoneFormat'
import type { ApiAssistant } from '../../types'

interface Props {
  visible: boolean
  onClose: () => void
}

const ALL_PERMISSIONS = [
  'patients.view',
  'patients.manage',
  'appointments.view',
  'appointments.manage',
  'payments.view',
  'payments.manage',
] as const

type Mode = { type: 'list' } | { type: 'form'; editingId: string | null }

export default function TeamManagementSheet({ visible, onClose }: Props) {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const toast = useToast()
  const queryClient = useQueryClient()

  const [mode, setMode] = useState<Mode>({ type: 'list' })

  // Form state
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [permissions, setPermissions] = useState<string[]>([])

  const listQuery = useQuery({
    queryKey: ['team', 'list'],
    queryFn: listAssistants,
    enabled: visible,
    staleTime: 30_000,
  })
  const members = listQuery.data?.data ?? []

  // Reset to list when sheet closes
  useEffect(() => {
    if (!visible) {
      setMode({ type: 'list' })
      resetForm()
    }
  }, [visible])

  const resetForm = () => {
    setName('')
    setEmail('')
    setPhone('')
    setPassword('')
    setPermissions([])
  }

  const openCreate = () => {
    Haptics.selectionAsync()
    resetForm()
    setMode({ type: 'form', editingId: null })
  }

  const openEdit = (m: ApiAssistant) => {
    Haptics.selectionAsync()
    setName(m.name)
    setEmail(m.email)
    setPhone(formatStoredPhone(m.phone))
    setPassword('')
    setPermissions(m.assistant_permissions ?? [])
    setMode({ type: 'form', editingId: m.id })
  }

  const togglePerm = (p: string) => {
    Haptics.selectionAsync()
    setPermissions((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    )
  }

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ['team'] })
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createAssistant({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() ? applyPhoneInput(phone).raw : undefined,
        password,
        permissions,
      }),
    onSuccess: () => {
      toast.success(t('settings.teamSheet.savedCreate'))
      refetch()
      setMode({ type: 'list' })
      resetForm()
    },
    onError: (err) => {
      if (isOfflineError(err)) return
      toast.error(t('settings.teamSheet.failed'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => {
      const editingId = mode.type === 'form' ? mode.editingId : null
      if (!editingId) throw new Error('No id')
      return updateAssistant(editingId, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() ? applyPhoneInput(phone).raw : undefined,
        permissions,
      })
    },
    onSuccess: () => {
      toast.success(t('settings.teamSheet.savedEdit'))
      refetch()
      setMode({ type: 'list' })
      resetForm()
    },
    onError: (err) => {
      if (isOfflineError(err)) return
      toast.error(t('settings.teamSheet.failed'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAssistant(id),
    onSuccess: () => {
      toast.success(t('settings.teamSheet.deleted'))
      refetch()
    },
    onError: (err) => {
      if (isOfflineError(err)) return
      toast.error(t('settings.teamSheet.failed'))
    },
  })

  const onDelete = (m: ApiAssistant) => {
    Alert.alert(t('settings.teamSheet.deleteConfirm'), t('settings.teamSheet.deleteConfirmSub'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.teamSheet.delete'),
        style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          deleteMutation.mutate(m.id)
        },
      },
    ])
  }

  const isEditing = mode.type === 'form' && mode.editingId !== null
  const isFormMode = mode.type === 'form'

  const canSubmit =
    name.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    (isEditing || password.length >= 8)

  const handleSubmit = () => {
    if (!canSubmit) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      return
    }
    if (isEditing) updateMutation.mutate()
    else createMutation.mutate()
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={
        isFormMode
          ? isEditing
            ? t('settings.teamSheet.editTitle')
            : t('settings.teamSheet.createTitle')
          : t('settings.teamSheet.title')
      }
    >
      {isFormMode ? (
        <>
          <Field label={t('settings.teamSheet.name')}>
            <InputCard
              iconName="person-outline"
              value={name}
              onChangeText={setName}
              placeholder={t('settings.teamSheet.namePlaceholder')}
              autoCapitalize="words"
            />
          </Field>

          <Field label={t('settings.teamSheet.email')}>
            <InputCard
              iconName="mail-outline"
              value={email}
              onChangeText={setEmail}
              placeholder={t('settings.teamSheet.emailPlaceholder')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>

          <Field label={t('settings.teamSheet.phone')}>
            <InputCard
              iconName="call-outline"
              value={phone}
              onChangeText={(v) => setPhone(applyPhoneInput(v).display)}
              placeholder={t('settings.teamSheet.phonePlaceholder')}
              keyboardType="phone-pad"
              maxLength={17}
            />
          </Field>

          {!isEditing ? (
            <Field label={t('settings.teamSheet.password')}>
              <InputCard
                iconName="key-outline"
                value={password}
                onChangeText={setPassword}
                placeholder={t('settings.teamSheet.passwordPlaceholder')}
                secureTextEntry
                autoCapitalize="none"
              />
            </Field>
          ) : null}

          <View style={styles.permsSection}>
            <Text style={styles.fieldLabel}>{t('settings.teamSheet.permissions')}</Text>
            <Text style={styles.permsHint}>{t('settings.teamSheet.permissionsHint')}</Text>
            <View style={styles.permsList}>
              {ALL_PERMISSIONS.map((p, idx) => {
                const checked = permissions.includes(p)
                return (
                  <React.Fragment key={p}>
                    <Pressable
                      onPress={() => togglePerm(p)}
                      style={({ pressed }) => [styles.permRow, pressed && styles.permRowPressed]}
                    >
                      <Text style={styles.permLabel}>{t(`settings.teamSheet.perms.${p}`)}</Text>
                      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                        {checked ? (
                          <Icon name="checkmark" size={14} color="#FFFFFF" />
                        ) : null}
                      </View>
                    </Pressable>
                    {idx < ALL_PERMISSIONS.length - 1 ? <View style={styles.permSep} /> : null}
                  </React.Fragment>
                )
              })}
            </View>
          </View>

          <View style={styles.formActions}>
            <Button
              title={t('common.cancel')}
              variant="secondary"
              size="md"
              fullWidth
              onPress={() => {
                setMode({ type: 'list' })
                resetForm()
              }}
              style={{ flex: 1 }}
            />
            <Button
              title={
                isPending
                  ? isEditing
                    ? t('settings.teamSheet.saving')
                    : t('settings.teamSheet.creating')
                  : isEditing
                    ? t('settings.teamSheet.save')
                    : t('settings.teamSheet.create')
              }
              size="md"
              fullWidth
              loading={isPending}
              disabled={!canSubmit}
              onPress={handleSubmit}
              style={{ flex: 1 }}
            />
          </View>
        </>
      ) : (
        <>
          <Button
            title={t('settings.teamSheet.addNew')}
            variant="tinted"
            size="lg"
            fullWidth
            leftIcon={<Icon name="person-add-outline" size={18} color={c.brandDeep as string} />}
            onPress={openCreate}
          />

          {members.length === 0 ? (
            <EmptyState
              iconName="people-outline"
              title={t('settings.teamSheet.empty')}
              subtitle={t('settings.teamSheet.emptySub')}
            />
          ) : (
            <View style={styles.list}>
              {members.map((m, idx) => (
                <React.Fragment key={m.id}>
                  <MemberRow
                    member={m}
                    onEdit={() => openEdit(m)}
                    onDelete={() => onDelete(m)}
                    t={t}
                  />
                  {idx < members.length - 1 ? <View style={styles.separator} /> : null}
                </React.Fragment>
              ))}
            </View>
          )}
        </>
      )}
    </BottomSheet>
  )
}

function MemberRow({
  member,
  onEdit,
  onDelete,
  t,
}: {
  member: ApiAssistant
  onEdit: () => void
  onDelete: () => void
  t: TFunction
}) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const lastLoginLabel = member.last_login_at
    ? formatLastLogin(new Date(member.last_login_at), t)
    : t('settings.teamSheet.lastLoginNever')

  return (
    <View style={styles.memberRow}>
      <PatientAvatar name={member.name} size={42} />
      <View style={styles.memberBody}>
        <Text style={styles.memberName} numberOfLines={1}>
          {member.name}
        </Text>
        <Text style={styles.memberEmail} numberOfLines={1}>
          {member.email}
        </Text>
        <Text style={styles.memberMeta} numberOfLines={1}>
          {lastLoginLabel} · {member.assistant_permissions.length} {t('settings.teamSheet.permissions').toLowerCase()}
        </Text>
      </View>
      <View style={styles.memberActions}>
        <Pressable onPress={onEdit} hitSlop={8} style={styles.iconBtn}>
          <Icon name="create-outline" size={18} color={c.brand as string} />
        </Pressable>
        <Pressable onPress={onDelete} hitSlop={8} style={styles.iconBtn}>
          <Icon name="trash-outline" size={18} color={c.danger as string} />
        </Pressable>
      </View>
    </View>
  )
}

function formatLastLogin(date: Date, t: (k: string, v?: any) => string): string {
  const bucket = getRelativeDateBucket(date)
  let when: string
  switch (bucket.bucket) {
    case 'today':
      when = t('patients.time.today')
      break
    case 'yesterday':
      when = t('patients.time.yesterday')
      break
    case 'daysAgo':
      when = t('patients.time.daysAgo', { n: bucket.value })
      break
    case 'weeksAgo':
      when = t('patients.time.weeksAgo', { n: bucket.value })
      break
    case 'monthsAgo':
      when = t('patients.time.monthsAgo', { n: bucket.value })
      break
    case 'yearsAgo':
      when = t('patients.time.yearsAgo', { n: bucket.value })
      break
  }
  return t('settings.teamSheet.lastLogin', { date: when })
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    field: { gap: 6 },
    fieldLabel: {
      fontFamily: font('700'),
      fontSize: 11,
      fontWeight: '700',
      color: c.labelSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginLeft: 4,
    },
    permsSection: { gap: 6 },
    permsHint: {
      ...typography.footnote,
      color: c.labelTertiary,
      marginLeft: 4,
      marginBottom: 4,
    },
    permsList: {
      backgroundColor: c.background,
      borderRadius: radius.xl,
      overflow: 'hidden',
    },
    permRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 12,
    },
    permRowPressed: { backgroundColor: c.fillQuaternary },
    permLabel: {
      flex: 1,
      ...typography.body,
      color: c.label,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: c.systemGray3,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: {
      backgroundColor: c.brand,
      borderColor: c.brand,
    },
    permSep: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.separator as string,
      marginLeft: 14,
    },
    formActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    list: {
      backgroundColor: c.background,
      borderRadius: radius.xl,
      overflow: 'hidden',
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 14,
      gap: 12,
    },
    memberBody: { flex: 1, gap: 2 },
    memberName: {
      ...typography.bodyEmphasized,
      color: c.label,
    },
    memberEmail: {
      ...typography.footnote,
      color: c.labelSecondary,
    },
    memberMeta: {
      ...typography.caption1,
      color: c.labelTertiary,
    },
    memberActions: {
      flexDirection: 'row',
      gap: 6,
    },
    iconBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.fillQuaternary,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.separator as string,
      marginLeft: 14 + 42 + 12,
    },
  })
}
