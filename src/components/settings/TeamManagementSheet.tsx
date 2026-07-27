import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, View, Text, StyleSheet, Pressable } from 'react-native'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'

import BottomSheet from '../ui/BottomSheet'
import InputCard from '../ui/InputCard'
import PasswordInput from '../ui/PasswordInput'
import Button from '../ui/Button'
import Icon, { type IconName } from '../ui/Icon'
import PatientAvatar from '../ui/PatientAvatar'
import EmptyState from '../ui/EmptyState'
import { useToast } from '../ui/Toast'
import { useDialog } from '../ui/Dialog'

import {
  listAssistants,
  createAssistant,
  updateAssistant,
  updateAssistantStatus,
  resetAssistantPassword,
  deleteAssistant,
} from '../../api/team'
import { INPUT_LIMITS, validateEmail, validatePassword } from '../../lib/validation'
import { useI18n } from '../../i18n'
import type { TFunction } from '../../i18n/helpers'
import { radius, spacing, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { isOfflineError } from '../../lib/offlineGuard'
import { getRelativeDateBucket } from '../../lib/format'
import { applyPhoneInput, formatStoredPhone, isValidUzbekPhone } from '../../lib/phoneFormat'
import {
  DEFAULT_ASSISTANT_PERMISSIONS,
  isSubscriptionReadOnly,
  STAFF_PERMISSION_CODES,
  toggleAssistantPermission,
  type StaffPermission,
} from '../../lib/permissions'
import { useAuthStore } from '../../stores/auth'
import type { ApiAssistant } from '../../types'
import { useSettingsFormDismiss } from './useSettingsFormDismiss'

const TEAM_PAGE_SIZE = 20

interface Props {
  visible: boolean
  onClose: () => void
}

type Mode =
  | { type: 'list' }
  | { type: 'form'; editingId: string | null }
  | { type: 'resetPassword'; id: string; name: string }

export default function TeamManagementSheet({ visible, onClose }: Props) {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const toast = useToast()
  const { confirm } = useDialog()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const isReadOnly = isSubscriptionReadOnly(user)
  const staffLimit = user?.subscription?.staff_limit ?? null
  const activeStaffCount = user?.subscription?.active_staff_count ?? 0
  const isAtStaffLimit = staffLimit !== null && activeStaffCount >= staffLimit

  const [mode, setMode] = useState<Mode>({ type: 'list' })

  // Form state
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [permissions, setPermissions] = useState<string[]>(DEFAULT_ASSISTANT_PERMISSIONS)
  const [formSubmitted, setFormSubmitted] = useState(false)
  const initialFormValues = useRef('')

  // Reset-password form state (separate `resetPassword` mode).
  const [resetPw, setResetPw] = useState('')
  const [resetPwConfirm, setResetPwConfirm] = useState('')
  const [resetSubmitted, setResetSubmitted] = useState(false)

  const listQuery = useInfiniteQuery({
    queryKey: ['team', 'list'],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => listAssistants(pageParam, TEAM_PAGE_SIZE),
    getNextPageParam: (lastPage) => {
      const pagination = lastPage.meta.pagination
      const currentPage = pagination.page ?? pagination.current_page ?? 1
      const totalPages = pagination.total_pages ?? pagination.last_page ?? 1
      return currentPage < totalPages ? currentPage + 1 : undefined
    },
    enabled: visible,
    staleTime: 30_000,
  })
  const members = useMemo(
    () => (listQuery.data?.pages.flatMap((page) => page.data) ?? [])
      .filter((member) => member.account_status !== 'deleted'),
    [listQuery.data]
  )

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
    setPermissions([...DEFAULT_ASSISTANT_PERMISSIONS])
    setFormSubmitted(false)
    initialFormValues.current = ''
  }

  const openCreate = () => {
    if (isReadOnly || isAtStaffLimit) return
    Haptics.selectionAsync()
    const nextPermissions = [...DEFAULT_ASSISTANT_PERMISSIONS]
    setName('')
    setEmail('')
    setPhone('')
    setPassword('')
    setPermissions(nextPermissions)
    setFormSubmitted(false)
    initialFormValues.current = JSON.stringify({
      name: '',
      email: '',
      phone: '',
      password: '',
      permissions: nextPermissions,
    })
    setMode({ type: 'form', editingId: null })
  }

  const openEdit = (m: ApiAssistant) => {
    if (isReadOnly) return
    Haptics.selectionAsync()
    setName(m.name)
    setEmail(m.email)
    setPhone(formatStoredPhone(m.phone))
    setPassword('')
    const nextPermissions = m.assistant_permissions ?? []
    setPermissions(nextPermissions)
    setFormSubmitted(false)
    initialFormValues.current = JSON.stringify({
      name: m.name,
      email: m.email,
      phone: formatStoredPhone(m.phone),
      password: '',
      permissions: nextPermissions,
    })
    setMode({ type: 'form', editingId: m.id })
  }

  const togglePerm = (p: StaffPermission) => {
    Haptics.selectionAsync()
    setPermissions((prev) => toggleAssistantPermission(prev, p))
  }

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ['team'] })
    queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createAssistant({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() ? applyPhoneInput(phone).raw : null,
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

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'blocked' }) =>
      updateAssistantStatus(id, status),
    onSuccess: (_data, { status }) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      toast.success(
        t(status === 'blocked' ? 'settings.teamSheet.blocked' : 'settings.teamSheet.unblocked')
      )
      refetch()
    },
    onError: (err) => {
      if (isOfflineError(err)) return
      toast.error(t('settings.teamSheet.failed'))
    },
  })

  const onToggleStatus = async (m: ApiAssistant): Promise<boolean> => {
    const next = m.account_status === 'blocked' ? 'active' : 'blocked'
    if (isReadOnly || statusMutation.isPending) return false
    if (next === 'active' && isAtStaffLimit) return false
    if (next === 'blocked') {
      const ok = await confirm({
        title: t('settings.teamSheet.blockConfirm'),
        message: t('settings.teamSheet.blockConfirmSub', { name: m.name }),
        confirmLabel: t('settings.teamSheet.block'),
        destructive: true,
      })
      if (!ok) return false
    }
    statusMutation.mutate({ id: m.id, status: next })
    return true
  }

  const openResetPassword = (m: ApiAssistant) => {
    if (isReadOnly) return
    Haptics.selectionAsync()
    setResetPw('')
    setResetPwConfirm('')
    setResetSubmitted(false)
    setMode({ type: 'resetPassword', id: m.id, name: m.name })
  }

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      resetAssistantPassword(id, newPassword),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      toast.success(t('settings.teamSheet.resetPasswordDone'))
      setMode({ type: 'list' })
      setResetPw('')
      setResetPwConfirm('')
    },
    onError: (err) => {
      if (isOfflineError(err)) return
      toast.error(t('settings.teamSheet.failed'))
    },
  })

  const resetPwError =
    resetSubmitted && validatePassword(resetPw, { required: true })
      ? t(`register.errors.${validatePassword(resetPw, { required: true })}`)
      : null
  const resetPwMismatch =
    resetSubmitted && resetPwConfirm !== resetPw ? t('settings.passwordSheet.mismatch') : null

  const handleResetSubmit = () => {
    setResetSubmitted(true)
    if (validatePassword(resetPw, { required: true }) || resetPwConfirm !== resetPw) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      return
    }
    if (mode.type === 'resetPassword') {
      resetPasswordMutation.mutate({ id: mode.id, newPassword: resetPw })
    }
  }

  const onDelete = async (m: ApiAssistant): Promise<boolean> => {
    if (isReadOnly || deleteMutation.isPending) return false
    const ok = await confirm({
      title: t('settings.teamSheet.deleteConfirm'),
      message: t('settings.teamSheet.deleteConfirmSub'),
      confirmLabel: t('settings.teamSheet.delete'),
      destructive: true,
    })
    if (!ok) return false
    deleteMutation.mutate(m.id)
    return true
  }

  const isEditing = mode.type === 'form' && mode.editingId !== null
  const isFormMode = mode.type === 'form'
  const isResetMode = mode.type === 'resetPassword'

  const nameError = formSubmitted && (name.trim().length < 3 || name.trim().length > INPUT_LIMITS.personName)
    ? t('register.errors.nameMin')
    : null
  const emailErrorKey = formSubmitted ? validateEmail(email, { required: true }) : null
  const emailError = emailErrorKey ? t(`login.errors.${emailErrorKey}`) : null
  const phoneError = formSubmitted && phone.trim() && !isValidUzbekPhone(phone)
    ? t('settings.teamSheet.phoneInvalid')
    : null
  const passwordErrorKey = !isEditing && formSubmitted
    ? validatePassword(password, { required: true })
    : null
  const passwordError = passwordErrorKey
    ? passwordErrorKey === 'passwordRequired'
      ? t('login.errors.passwordRequired')
      : t(`register.errors.${passwordErrorKey}`)
    : null
  const handleSubmit = () => {
    if (isReadOnly || (!isEditing && isAtStaffLimit)) return
    setFormSubmitted(true)
    const invalidName = name.trim().length < 3 || name.trim().length > INPUT_LIMITS.personName
    const invalidEmail = validateEmail(email, { required: true }) !== null
    const invalidPhone = Boolean(phone.trim()) && !isValidUzbekPhone(phone)
    const invalidPassword = !isEditing && validatePassword(password, { required: true }) !== null
    if (invalidName || invalidEmail || invalidPhone || invalidPassword) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      toast.error(t('settings.teamSheet.fixErrors'))
      return
    }
    if (isEditing) updateMutation.mutate()
    else createMutation.mutate()
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const anyMutationPending =
    isPending ||
    resetPasswordMutation.isPending ||
    deleteMutation.isPending ||
    statusMutation.isPending
  const isFormDirty =
    isFormMode &&
    initialFormValues.current !== JSON.stringify({
      name,
      email,
      phone,
      password,
      permissions,
    })
  const canDismiss = useSettingsFormDismiss({
    isDirty: isFormDirty,
    isPending: anyMutationPending,
  })
  const sheetTitle =
    mode.type === 'resetPassword'
      ? t('settings.teamSheet.resetPasswordTitle')
      : mode.type === 'form'
        ? mode.editingId
          ? t('settings.teamSheet.editTitle')
          : t('settings.teamSheet.createTitle')
        : t('settings.teamSheet.title')

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onBeforeClose={canDismiss}
      closeAccessibilityLabel={t('common.close')}
      title={sheetTitle}
    >
      {isResetMode ? (
        <>
          <Text style={styles.resetSubtitle}>
            {mode.type === 'resetPassword' ? mode.name : ''}
          </Text>
          <Field label={t('settings.passwordSheet.newLabel')}>
            <PasswordInput
              value={resetPw}
              onChangeText={setResetPw}
              placeholder={t('settings.passwordSheet.newPlaceholder')}
              error={resetPwError}
            />
          </Field>
          <Field label={t('settings.passwordSheet.confirmLabel')}>
            <PasswordInput
              value={resetPwConfirm}
              onChangeText={setResetPwConfirm}
              placeholder={t('settings.passwordSheet.confirmPlaceholder')}
              error={resetPwMismatch}
            />
          </Field>
          <View style={styles.formActions}>
            <Button
              title={t('common.cancel')}
              variant="secondary"
              size="md"
              fullWidth
              onPress={() => setMode({ type: 'list' })}
              style={{ flex: 1 }}
            />
            <Button
              title={
                resetPasswordMutation.isPending
                  ? t('settings.teamSheet.saving')
                  : t('settings.teamSheet.resetPassword')
              }
              size="md"
              fullWidth
              loading={resetPasswordMutation.isPending}
              onPress={handleResetSubmit}
              style={{ flex: 1 }}
            />
          </View>
        </>
      ) : isFormMode ? (
        <>
          <Field label={t('settings.teamSheet.name')}>
            <>
              <InputCard
                iconName="person-outline"
                value={name}
                onChangeText={setName}
                placeholder={t('settings.teamSheet.namePlaceholder')}
                autoCapitalize="words"
                maxLength={INPUT_LIMITS.personName}
                error={Boolean(nameError)}
              />
              {nameError ? <Text style={styles.fieldError}>{nameError}</Text> : null}
            </>
          </Field>

          <Field label={t('settings.teamSheet.email')}>
            <>
              <InputCard
                iconName="mail-outline"
                value={email}
                onChangeText={setEmail}
                placeholder={t('settings.teamSheet.emailPlaceholder')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={INPUT_LIMITS.email}
                error={Boolean(emailError)}
              />
              {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}
            </>
          </Field>

          <Field label={t('settings.teamSheet.phone')}>
            <InputCard
              iconName="call-outline"
              value={phone}
              onChangeText={(v) => setPhone(applyPhoneInput(v).display)}
              placeholder={t('settings.teamSheet.phonePlaceholder')}
              keyboardType="phone-pad"
              maxLength={17}
              error={Boolean(phoneError)}
            />
            {phoneError ? <Text style={styles.fieldError}>{phoneError}</Text> : null}
          </Field>

          {!isEditing ? (
            <Field label={t('settings.teamSheet.password')}>
              <PasswordInput
                value={password}
                onChangeText={setPassword}
                placeholder={t('settings.teamSheet.passwordPlaceholder')}
                error={passwordError}
              />
            </Field>
          ) : null}

          <View style={styles.permsSection}>
            <Text style={styles.fieldLabel}>{t('settings.teamSheet.permissions')}</Text>
            <Text style={styles.permsHint}>{t('settings.teamSheet.permissionsHint')}</Text>
            <View style={styles.permsList}>
              {STAFF_PERMISSION_CODES.map((p, idx) => {
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
                    {idx < STAFF_PERMISSION_CODES.length - 1 ? <View style={styles.permSep} /> : null}
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
              disabled={isReadOnly || (!isEditing && isAtStaffLimit)}
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
            disabled={isReadOnly || isAtStaffLimit}
          />

          {listQuery.isLoading && !listQuery.data ? (
            <View style={styles.loader}>
              <ActivityIndicator
                color={c.brand as string}
                accessibilityLabel={t('common.loading')}
              />
            </View>
          ) : listQuery.isError && !listQuery.data ? (
            <EmptyState
              iconName="cloud-offline-outline"
              title={t('settings.teamSheet.loadFailed')}
              subtitle={t('settings.teamSheet.loadFailedSub')}
              tone="danger"
              action={
                <Button
                  title={t('common.retry')}
                  variant="secondary"
                  size="md"
                  onPress={() => listQuery.refetch()}
                />
              }
            />
          ) : members.length === 0 ? (
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
                    onResetPassword={() => openResetPassword(m)}
                    onToggleStatus={() => {
                      void onToggleStatus(m)
                    }}
                    onDelete={() => {
                      void onDelete(m)
                    }}
                    isReadOnly={isReadOnly}
                    isAtStaffLimit={isAtStaffLimit}
                    isPending={anyMutationPending}
                    t={t}
                  />
                  {idx < members.length - 1 ? <View style={styles.separator} /> : null}
                </React.Fragment>
              ))}
            </View>
          )}
          {members.length > 0 && (listQuery.hasNextPage || listQuery.isFetchNextPageError) ? (
            <Button
              title={listQuery.isFetchNextPageError
                ? t('common.retry')
                : t('settings.teamSheet.loadMore')}
              variant="secondary"
              size="md"
              fullWidth
              loading={listQuery.isFetchingNextPage}
              onPress={() => listQuery.fetchNextPage()}
            />
          ) : null}
        </>
      )}
    </BottomSheet>
  )
}

function MemberRow({
  member,
  onEdit,
  onResetPassword,
  onToggleStatus,
  onDelete,
  isReadOnly,
  isAtStaffLimit,
  isPending,
  t,
}: {
  member: ApiAssistant
  onEdit: () => void
  onResetPassword: () => void
  onToggleStatus: () => void
  onDelete: () => void
  isReadOnly: boolean
  isAtStaffLimit: boolean
  isPending: boolean
  t: TFunction
}) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const lastLoginLabel = member.last_login_at
    ? formatLastLogin(new Date(member.last_login_at), t)
    : t('settings.teamSheet.lastLoginNever')
  const isBlocked = member.account_status === 'blocked'
  const writesDisabled = isReadOnly || isPending

  return (
    <View style={styles.memberRow} testID={`team-member-${member.id}`}>
      <View
        style={styles.memberSummary}
        testID={`team-member-summary-${member.id}`}
      >
        <PatientAvatar name={member.name} size={42} />
        <View style={styles.memberBody}>
          <View style={styles.memberNameRow}>
            <Text style={styles.memberName} numberOfLines={1}>
              {member.name}
            </Text>
            {isBlocked ? (
              <View style={styles.blockedBadge}>
                <Text style={styles.blockedBadgeText}>
                  {t('settings.teamSheet.status.blocked')}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.memberEmail} numberOfLines={1}>
            {member.email}
          </Text>
          <Text style={styles.memberMeta} numberOfLines={1}>
            {lastLoginLabel} · {member.assistant_permissions.length}{' '}
            {t('settings.teamSheet.permissions').toLowerCase()}
          </Text>
        </View>
      </View>

      <View
        style={styles.memberActions}
        testID={`team-member-actions-${member.id}`}
      >
        <MemberActionButton
          iconName="create-outline"
          iconColor={c.brand as string}
          label={t('settings.teamSheet.editTitle')}
          onPress={onEdit}
          disabled={writesDisabled}
        />
        <MemberActionButton
          iconName="key-outline"
          iconColor={c.labelSecondary as string}
          label={t('settings.teamSheet.resetPassword')}
          onPress={onResetPassword}
          disabled={writesDisabled}
        />
        <MemberActionButton
          iconName={isBlocked ? 'lock-open-outline' : 'ban-outline'}
          iconColor={isBlocked ? (c.success as string) : (c.warning as string)}
          label={t(isBlocked ? 'settings.teamSheet.unblock' : 'settings.teamSheet.block')}
          onPress={onToggleStatus}
          disabled={writesDisabled || (isBlocked && isAtStaffLimit)}
        />
        <MemberActionButton
          iconName="trash-outline"
          iconColor={c.danger as string}
          label={t('settings.teamSheet.delete')}
          onPress={onDelete}
          disabled={writesDisabled}
        />
      </View>
    </View>
  )
}

function MemberActionButton({
  iconName,
  iconColor,
  label,
  onPress,
  disabled,
}: {
  iconName: IconName
  iconColor: string
  label: string
  onPress: () => void
  disabled: boolean
}) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        Haptics.selectionAsync()
        onPress()
      }}
      style={({ pressed }) => [
        styles.memberActionButton,
        pressed && !disabled && styles.memberActionButtonPressed,
        disabled && styles.memberActionButtonDisabled,
      ]}
    >
      <Icon name={iconName} size={18} color={iconColor} />
    </Pressable>
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
    resetSubtitle: {
      ...typography.footnote,
      color: c.labelSecondary,
      marginBottom: spacing.sm,
      marginLeft: 4,
    },
    fieldLabel: {
      fontFamily: font('700'),
      fontSize: 11,
      fontWeight: '700',
      color: c.labelSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginLeft: 4,
    },
    fieldError: {
      ...typography.footnote,
      color: c.danger,
      marginHorizontal: 4,
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
    loader: {
      minHeight: 180,
      alignItems: 'center',
      justifyContent: 'center',
    },
    memberRow: {
      paddingVertical: 12,
      paddingHorizontal: 14,
      gap: 10,
    },
    memberSummary: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    memberBody: { flex: 1, gap: 2 },
    memberNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    memberName: {
      ...typography.bodyEmphasized,
      color: c.label,
      flexShrink: 1,
    },
    blockedBadge: {
      backgroundColor: c.danger as string,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    blockedBadgeText: {
      fontFamily: font('700'),
      fontSize: 9,
      fontWeight: '700',
      color: '#FFFFFF',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
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
      alignItems: 'center',
      gap: spacing.sm,
      marginLeft: 42 + 12,
      paddingTop: 9,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.separator as string,
    },
    memberActionButton: {
      flex: 1,
      minWidth: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.fillQuaternary,
      borderRadius: radius.lg,
    },
    memberActionButtonPressed: {
      opacity: 0.7,
      transform: [{ scale: 0.96 }],
    },
    memberActionButtonDisabled: { opacity: 0.4 },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.separator as string,
      marginLeft: 14 + 42 + 12,
    },
  })
}
