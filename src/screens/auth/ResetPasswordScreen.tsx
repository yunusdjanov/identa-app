import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  StatusBar,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useMutation } from '@tanstack/react-query'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as Haptics from 'expo-haptics'

import Button from '../../components/ui/Button'
import InputCard from '../../components/ui/InputCard'
import PasswordInput from '../../components/ui/PasswordInput'
import Icon from '../../components/ui/Icon'
import LanguageSwitcher from '../../components/ui/LanguageSwitcher'
import { useToast } from '../../components/ui/Toast'

import { spacing, typography, radius } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { useI18n } from '../../i18n'
import { INPUT_LIMITS, validateEmail, validatePassword } from '../../lib/validation'
import { getAuthErrorMessage } from '../../lib/authErrorMessage'
import { resetPassword } from '../../api/auth'
import { isApiError } from '../../api/client'
import type { AuthStackParams } from '../../navigation'

type Route = RouteProp<AuthStackParams, 'ResetPassword'>
type Nav = NativeStackNavigationProp<AuthStackParams>

export default function ResetPasswordScreen() {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const toast = useToast()

  // token + email arrive from the password-reset deep link
  // (identa://reset-password?token=…&email=…).
  const token = route.params?.token ?? ''
  const linkValid = token.trim().length > 0

  const [email, setEmail] = useState(route.params?.email ?? '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const emailKey = submitted ? validateEmail(email, { required: true }) : null
  const emailError = emailKey ? t(`login.errors.${emailKey}`) : null
  const pwKey = submitted ? validatePassword(password, { required: true }) : null
  const pwError = pwKey
    ? pwKey === 'passwordRequired'
      ? t('login.errors.passwordRequired')
      : t(`register.errors.${pwKey}`)
    : null
  const confirmError =
    submitted && !confirm
      ? t('register.errors.passwordConfirmRequired')
      : submitted && confirm !== password
        ? t('resetPassword.mismatch')
        : null

  const goToLogin = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Login', params: { initialEmail: email.trim() } }] })
  }

  const mutation = useMutation({
    mutationFn: () => resetPassword(token, email.trim(), password, confirm),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      toast.success(t('resetPassword.success'))
      goToLogin()
    },
    onError: (err) => {
      // Surface the backend's field error (e.g. invalid/expired token) when
      // present; otherwise a generic message.
      const fieldMsg =
        isApiError(err) && err.fieldErrors
          ? Object.values(err.fieldErrors)[0]?.[0]
          : undefined
      toast.error(fieldMsg ?? getAuthErrorMessage(err, t, 'resetPassword.failed'))
    },
  })

  const handleSubmit = () => {
    Keyboard.dismiss()
    setSubmitted(true)
    if (!linkValid) {
      toast.error(t('resetPassword.invalidLink'))
      return
    }
    if (
      validateEmail(email, { required: true }) ||
      validatePassword(password, { required: true }) ||
      !confirm ||
      confirm !== password
    ) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      return
    }
    mutation.mutate()
  }

  const onBack = () => {
    Haptics.selectionAsync()
    goToLogin()
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[c.brandSurface, c.background, c.background]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" />

        <View style={styles.navBar}>
          <Pressable
            onPress={onBack}
            hitSlop={12}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Icon name="chevron-back" size={26} color={c.brand as string} />
            <Text style={styles.backText}>{t('common.back')}</Text>
          </Pressable>
          <LanguageSwitcher variant="minimal" />
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.hero}>
                <View style={styles.iconBubble}>
                  <Icon name="lock-closed-outline" size={32} color={c.brand as string} />
                </View>
                <Text style={styles.title}>{t('resetPassword.title')}</Text>
                <Text style={styles.subtitle}>
                  {linkValid ? t('resetPassword.subtitle') : t('resetPassword.invalidLink')}
                </Text>
              </View>

              {linkValid ? (
                <View style={styles.formBlock}>
                  <InputCard
                    iconName="mail-outline"
                    placeholder={t('login.emailPlaceholder')}
                    value={email}
                    onChangeText={setEmail}
                    accessibilityLabel={t('login.email')}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    textContentType="emailAddress"
                    maxLength={INPUT_LIMITS.email}
                    error={Boolean(emailError)}
                    errorMessage={emailError}
                  />
                  {emailError ? (
                    <Text style={styles.errorText} accessibilityRole="alert">
                      {emailError}
                    </Text>
                  ) : null}
                  <PasswordInput
                    label={t('resetPassword.newPassword')}
                    placeholder={t('resetPassword.newPassword')}
                    value={password}
                    onChangeText={setPassword}
                    error={pwError}
                    accessibilityLabel={t('resetPassword.newPassword')}
                    showLabel={t('login.show')}
                    hideLabel={t('login.hide')}
                    returnKeyType="next"
                    maxLength={INPUT_LIMITS.password}
                  />
                  <PasswordInput
                    label={t('resetPassword.confirmPassword')}
                    placeholder={t('resetPassword.confirmPassword')}
                    value={confirm}
                    onChangeText={setConfirm}
                    error={confirmError}
                    accessibilityLabel={t('resetPassword.confirmPassword')}
                    showLabel={t('login.show')}
                    hideLabel={t('login.hide')}
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                    maxLength={INPUT_LIMITS.password}
                  />

                  <Button
                    title={
                      mutation.isPending
                        ? t('resetPassword.submitting')
                        : t('resetPassword.submit')
                    }
                    onPress={handleSubmit}
                    loading={mutation.isPending}
                    fullWidth
                    size="lg"
                    style={{ marginTop: spacing.lg }}
                  />
                </View>
              ) : null}
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    flex: { flex: 1 },
    navBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.sm,
      paddingTop: spacing.sm,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: 8,
      marginLeft: 4,
    },
    backText: { ...typography.body, color: c.brand, marginLeft: 2 },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xl,
      paddingBottom: spacing.xxxl,
    },
    hero: {
      alignItems: 'center',
      marginBottom: spacing.xxxl,
    },
    iconBubble: {
      width: 72,
      height: 72,
      borderRadius: radius.xxl,
      backgroundColor: c.brandLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    title: {
      ...typography.title1,
      color: c.brandDeep,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    subtitle: {
      ...typography.callout,
      color: c.labelSecondary,
      textAlign: 'center',
      paddingHorizontal: spacing.lg,
    },
    formBlock: {
      gap: spacing.md,
    },
    errorText: {
      ...typography.footnote,
      color: c.danger,
      marginLeft: spacing.lg,
      marginTop: -spacing.xs,
    },
  })
}
