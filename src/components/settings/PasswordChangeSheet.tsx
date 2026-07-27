import React, { useState, useEffect, useMemo } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import BottomSheet from '../ui/BottomSheet'
import InputCard from '../ui/InputCard'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import { useToast } from '../ui/Toast'
import { changeCurrentPassword } from '../../api/auth'
import { useI18n } from '../../i18n'
import { useAuthStore } from '../../stores/auth'
import { spacing, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { isOfflineError } from '../../lib/offlineGuard'
import { validatePassword } from '../../lib/validation'
import { getAuthErrorMessage } from '../../lib/authErrorMessage'

interface Props {
  visible: boolean
  onClose: () => void
}

export default function PasswordChangeSheet({ visible, onClose }: Props) {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const toast = useToast()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const hasPassword = user?.has_password !== false && !user?.must_change_password

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (visible) {
      setCurrent('')
      setNext('')
      setConfirm('')
      setShowCurrent(false)
      setShowNext(false)
      setShowConfirm(false)
      setSubmitted(false)
    }
  }, [visible])

  const passwordErrorKey = submitted ? validatePassword(next, { required: true }) : null
  const passwordError = passwordErrorKey
    ? passwordErrorKey === 'passwordRequired'
      ? t('login.errors.passwordRequired')
      : t(`register.errors.${passwordErrorKey}`)
    : null
  const confirmError = submitted
    ? !confirm
      ? t('register.errors.passwordConfirmRequired')
      : next !== confirm
        ? t('settings.passwordSheet.mismatch')
        : null
    : null
  const currentError = submitted && hasPassword && !current
    ? t('settings.passwordSheet.currentRequired')
    : null

  const mutation = useMutation({
    mutationFn: () =>
      changeCurrentPassword({
        current_password: hasPassword ? current : undefined,
        new_password: next,
        new_password_confirmation: confirm,
      }),
    onSuccess: (updatedUser) => {
      if (user) {
        setUser(updatedUser ?? {
          ...user,
          has_password: true,
          must_change_password: false,
        })
      }
      toast.success(t('settings.passwordSheet.changed'))
      onClose()
    },
    onError: (err) => {
      if (isOfflineError(err)) return
      toast.error(getAuthErrorMessage(err, t, 'settings.passwordSheet.failed'))
    },
  })

  const handleSubmit = () => {
    setSubmitted(true)
    if (validatePassword(next, { required: true }) || next !== confirm || !confirm) return
    if (hasPassword && !current) return
    mutation.mutate()
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onBeforeClose={() => !mutation.isPending}
      title={t('settings.rows.password')}
      closeAccessibilityLabel={t('common.close')}
    >
      {hasPassword ? (
        <Field label={t('settings.passwordSheet.currentLabel')}>
          <InputCard
            iconName="lock-closed-outline"
            value={current}
            onChangeText={setCurrent}
            placeholder={t('settings.passwordSheet.currentPlaceholder')}
            secureTextEntry={!showCurrent}
            autoCapitalize="none"
            error={Boolean(currentError)}
            errorMessage={currentError ?? undefined}
            rightAccessory={
              <Pressable
                onPress={() => setShowCurrent((v) => !v)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={t(showCurrent ? 'login.hide' : 'login.show')}
              >
                <Icon
                  name={showCurrent ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={c.labelSecondary as string}
                />
              </Pressable>
            }
          />
        </Field>
      ) : null}

      <Field label={t('settings.passwordSheet.newLabel')}>
        <InputCard
          iconName="key-outline"
          value={next}
          onChangeText={setNext}
          placeholder={t('settings.passwordSheet.newPlaceholder')}
          secureTextEntry={!showNext}
          autoCapitalize="none"
          error={Boolean(passwordError)}
          errorMessage={passwordError ?? undefined}
          rightAccessory={
            <Pressable
              onPress={() => setShowNext((v) => !v)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t(showNext ? 'login.hide' : 'login.show')}
            >
              <Icon
                name={showNext ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={c.labelSecondary as string}
              />
            </Pressable>
          }
        />
      </Field>

      <Field label={t('settings.passwordSheet.confirmLabel')}>
        <InputCard
          iconName="shield-checkmark-outline"
          value={confirm}
          onChangeText={setConfirm}
          placeholder={t('settings.passwordSheet.confirmPlaceholder')}
          secureTextEntry={!showConfirm}
          autoCapitalize="none"
          error={Boolean(confirmError)}
          errorMessage={confirmError ?? undefined}
          rightAccessory={
            <Pressable
              onPress={() => setShowConfirm((v) => !v)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t(showConfirm ? 'login.hide' : 'login.show')}
            >
              <Icon
                name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={c.labelSecondary as string}
              />
            </Pressable>
          }
        />
      </Field>

      <Button
        title={
          mutation.isPending
            ? t('settings.passwordSheet.changing')
            : t('settings.passwordSheet.change')
        }
        onPress={handleSubmit}
        loading={mutation.isPending}
        fullWidth
        size="lg"
        style={{ marginTop: spacing.xs }}
      />
    </BottomSheet>
  )
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
      fontSize: 12,
      fontWeight: '700',
      color: c.labelSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginLeft: 4,
    },
  })
}
