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
  TextInput,
  Keyboard,
  TouchableWithoutFeedback,
  Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useMutation } from '@tanstack/react-query'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as Haptics from 'expo-haptics'

import Brand from '../../components/ui/Brand'
import Button from '../../components/ui/Button'
import InputCard from '../../components/ui/InputCard'
import LanguageSwitcher from '../../components/ui/LanguageSwitcher'
import Icon from '../../components/ui/Icon'
import Checkbox from '../../components/ui/Checkbox'
import PasswordStrengthMeter from '../../components/ui/PasswordStrengthMeter'
import { useToast } from '../../components/ui/Toast'

import { spacing, typography, radius, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { useI18n } from '../../i18n'
import { useAuthStore } from '../../stores/auth'
import { register as registerApi, login as loginApi } from '../../api/auth'
import { isApiError } from '../../api/client'
import { validateEmail, validatePassword, INPUT_LIMITS } from '../../lib/validation'
import { getAuthErrorMessage } from '../../lib/authErrorMessage'
import type { AuthStackParams } from '../../navigation'

type Nav = NativeStackNavigationProp<AuthStackParams, 'Register'>
type ServerErrorField = 'name' | 'email' | 'password' | 'password_confirmation' | 'terms'

export default function RegisterScreen() {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const navigation = useNavigation<Nav>()
  const toast = useToast()
  const setSession = useAuthStore((s) => s.setSession)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [serverErrors, setServerErrors] = useState<Partial<Record<ServerErrorField, string>>>({})

  const emailRef = React.useRef<TextInput>(null)
  const passwordRef = React.useRef<TextInput>(null)
  const confirmRef = React.useRef<TextInput>(null)

  const nameError =
    serverErrors.name ?? (submitted && !name.trim() ? t('register.errors.nameRequired') : null)

  const emailKey = submitted ? validateEmail(email, { required: true }) : null
  const emailError =
    serverErrors.email ??
    (emailKey
      ? emailKey === 'emailRequired'
        ? t('login.errors.emailRequired')
        : t('login.errors.emailInvalid')
      : null)

  const passwordKey = submitted ? validatePassword(password, { required: true }) : null
  const passwordError =
    serverErrors.password ??
    (passwordKey
      ? passwordKey === 'passwordRequired'
        ? t('login.errors.passwordRequired')
        : t(`register.errors.${passwordKey}`)
      : null)

  // Live mismatch check: as soon as the user has typed both passwords, show
  // a hint without waiting for submit. Pre-submit, missing-field errors are
  // still gated on `submitted` so the user isn't yelled at on first paint.
  const confirmError =
    serverErrors.password_confirmation ??
    (submitted
      ? !confirm
        ? t('register.errors.passwordConfirmRequired')
        : password !== confirm
          ? t('register.errors.passwordMismatch')
          : null
      : password && confirm && password !== confirm
        ? t('register.errors.passwordMismatch')
        : null)

  const termsError =
    serverErrors.terms ?? (submitted && !acceptedTerms ? t('register.termsError') : null)

  const mutation = useMutation({
    // New backends return mobile tokens atomically with registration. The
    // login fallback keeps rollout compatible with an older deployed API.
    mutationFn: async () => {
      const registration = await registerApi({
        name: name.trim(),
        email: email.trim(),
        password,
        password_confirmation: confirm,
      })
      if (registration.tokens) {
        return {
          kind: 'authenticated' as const,
          session: { user: registration.user, tokens: registration.tokens },
        }
      }
      try {
        const session = await loginApi(email.trim(), password)
        return { kind: 'authenticated' as const, session }
      } catch {
        // Account creation is already committed. A network/CSRF/login failure
        // here must not be reported as a failed registration, otherwise the
        // user's retry collides with the email that was just created.
        return { kind: 'account-created' as const }
      }
    },
    onSuccess: (result) => {
      toast.success(t('register.success'))
      if (result.kind === 'account-created') {
        navigation.replace('Login', { initialEmail: email.trim() })
        return
      }
      setSession(result.session.user, result.session.tokens)
    },
    onError: (error) => {
      if (isApiError(error) && error.kind === 'validation' && error.fieldErrors) {
        setServerErrors({
          name: error.fieldErrors.name ? t('register.errors.nameRequired') : undefined,
          email: error.fieldErrors.email ? t('register.errors.emailUnavailable') : undefined,
          password: error.fieldErrors.password ? t('register.errors.passwordRejected') : undefined,
          password_confirmation: error.fieldErrors.password_confirmation
            ? t('register.errors.passwordMismatch')
            : undefined,
          terms:
            error.fieldErrors.terms_accepted || error.fieldErrors.privacy_accepted
              ? t('register.termsError')
              : undefined,
        })
        toast.error(t('register.errors.fixFields'))
        return
      }
      toast.error(getAuthErrorMessage(error, t, 'register.errors.registerFailed'))
    },
  })

  const handleSubmit = () => {
    Keyboard.dismiss()
    setSubmitted(true)

    const hasName = name.trim().length > 0
    const eErr = validateEmail(email, { required: true })
    const pErr = validatePassword(password, { required: true })
    const cErr = !confirm || password !== confirm

    if (!hasName || eErr || pErr || cErr || !acceptedTerms) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      return
    }

    setServerErrors({})
    mutation.mutate()
  }

  const openLink = (path: 'terms' | 'privacy') => {
    Haptics.selectionAsync()
    const url = path === 'terms' ? 'https://identa.uz/terms' : 'https://identa.uz/privacy'
    Linking.openURL(url).catch(() => toast.error(t('common.retry')))
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

        <View style={styles.topBar}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync()
              navigation.goBack()
            }}
            hitSlop={12}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Icon name="chevron-back" size={26} color={c.brand as string} />
            <Text style={styles.backText}>{t('common.back')}</Text>
          </Pressable>
          <LanguageSwitcher />
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.heroBlock}>
                <Brand variant="text" size={140} style={{ marginBottom: spacing.xl }} />

                <View style={styles.trialBadge}>
                  <Icon name="time-outline" size={14} color={c.brandDeep as string} />
                  <Text style={styles.trialText}>{t('register.trialBadge')}</Text>
                </View>

                <Text style={styles.title}>{t('register.title')}</Text>
                <Text style={styles.subtitle}>{t('register.subtitle')}</Text>
              </View>

              <View style={styles.formBlock}>
                <View>
                  <InputCard
                    iconName="person-outline"
                    placeholder={t('register.namePlaceholder')}
                    value={name}
                    onChangeText={(value) => {
                      setName(value)
                      setServerErrors((current) => ({ ...current, name: undefined }))
                    }}
                    autoCapitalize="words"
                    autoComplete="name"
                    textContentType="name"
                    returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()}
                    maxLength={INPUT_LIMITS.personName}
                    error={Boolean(nameError)}
                    errorMessage={nameError}
                    accessibilityLabel={t('register.name')}
                  />
                  {nameError ? (
                    <Text style={styles.fieldError} accessibilityRole="alert" aria-live="polite">
                      {nameError}
                    </Text>
                  ) : null}
                </View>

                <View>
                  <InputCard
                    ref={emailRef}
                    iconName="mail-outline"
                    placeholder={t('register.emailPlaceholder')}
                    value={email}
                    onChangeText={(value) => {
                      setEmail(value)
                      setServerErrors((current) => ({ ...current, email: undefined }))
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    textContentType="emailAddress"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    maxLength={INPUT_LIMITS.email}
                    error={Boolean(emailError)}
                    errorMessage={emailError}
                    accessibilityLabel={t('register.email')}
                  />
                  {emailError ? (
                    <Text style={styles.fieldError} accessibilityRole="alert" aria-live="polite">
                      {emailError}
                    </Text>
                  ) : null}
                </View>

                <View>
                  <InputCard
                    ref={passwordRef}
                    iconName="lock-closed-outline"
                    placeholder={t('register.passwordPlaceholder')}
                    value={password}
                    onChangeText={(value) => {
                      setPassword(value)
                      setServerErrors((current) => ({ ...current, password: undefined }))
                    }}
                    secureTextEntry={!showPwd}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    returnKeyType="next"
                    onSubmitEditing={() => confirmRef.current?.focus()}
                    maxLength={INPUT_LIMITS.password}
                    error={Boolean(passwordError)}
                    errorMessage={passwordError}
                    accessibilityLabel={t('register.password')}
                    rightAccessory={
                      <Pressable
                        onPress={() => setShowPwd((v) => !v)}
                        hitSlop={12}
                        accessibilityRole="button"
                        accessibilityLabel={t(showPwd ? 'login.hide' : 'login.show')}
                      >
                        <Icon
                          name={showPwd ? 'eye-off-outline' : 'eye-outline'}
                          size={20}
                          color={c.labelSecondary as string}
                        />
                      </Pressable>
                    }
                  />
                  {passwordError ? (
                    <Text style={styles.fieldError} accessibilityRole="alert" aria-live="polite">
                      {passwordError}
                    </Text>
                  ) : null}
                </View>

                <PasswordStrengthMeter value={password} />

                <View>
                  <InputCard
                    ref={confirmRef}
                    iconName="shield-checkmark-outline"
                    placeholder={t('register.confirmPasswordPlaceholder')}
                    value={confirm}
                    onChangeText={(value) => {
                      setConfirm(value)
                      setServerErrors((current) => ({
                        ...current,
                        password_confirmation: undefined,
                      }))
                    }}
                    secureTextEntry={!showConfirm}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                    maxLength={INPUT_LIMITS.password}
                    error={Boolean(confirmError)}
                    errorMessage={confirmError}
                    accessibilityLabel={t('register.confirmPassword')}
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
                  {confirmError ? (
                    <Text style={styles.fieldError} accessibilityRole="alert" aria-live="polite">
                      {confirmError}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.termsRow}>
                  <Checkbox
                    checked={acceptedTerms}
                    accessibilityLabel={`${t('register.termsPrefix')}${t('register.termsLink')}${t('register.termsAnd')}${t('register.privacyLink')}${t('register.termsSuffix')}`}
                    onChange={(value) => {
                      setAcceptedTerms(value)
                      setServerErrors((current) => ({ ...current, terms: undefined }))
                    }}
                  />
                  <Text style={styles.termsText}>
                    {t('register.termsPrefix')}
                    <Text
                      style={styles.termsLink}
                      onPress={() => openLink('terms')}
                      accessibilityRole="link"
                    >
                      {t('register.termsLink')}
                    </Text>
                    {t('register.termsAnd')}
                    <Text
                      style={styles.termsLink}
                      onPress={() => openLink('privacy')}
                      accessibilityRole="link"
                    >
                      {t('register.privacyLink')}
                    </Text>
                    {t('register.termsSuffix')}
                  </Text>
                </View>
                {termsError ? (
                  <Text
                    style={[styles.fieldError, styles.termsError]}
                    accessibilityRole="alert"
                    aria-live="polite"
                  >
                    {termsError}
                  </Text>
                ) : null}

                <Button
                  title={
                    mutation.isPending ? t('register.creatingAccount') : t('register.createAccount')
                  }
                  onPress={handleSubmit}
                  loading={mutation.isPending}
                  fullWidth
                  size="lg"
                  style={{ marginTop: spacing.lg }}
                  rightIcon={
                    mutation.isPending ? null : (
                      <Icon name="arrow-forward" size={18} color="#FFFFFF" />
                    )
                  }
                />

              </View>

              <View style={styles.footer}>
                <Text style={styles.footerText}>{t('register.haveAccount')} </Text>
                <Pressable
                  onPress={() => navigation.navigate('Login')}
                  hitSlop={8}
                  accessibilityRole="link"
                >
                  <Text style={styles.link}>{t('register.signIn')}</Text>
                </Pressable>
              </View>
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
    topBar: {
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
      paddingTop: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    heroBlock: {
      alignItems: 'center',
      marginBottom: spacing.xxl,
    },
    trialBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: radius.pill,
      backgroundColor: c.brandLight,
      marginBottom: spacing.lg,
    },
    trialText: {
      ...typography.caption1,
      fontFamily: font('700'),
      color: c.brandDeep,
      fontWeight: '700',
      letterSpacing: 1.2,
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
    fieldError: {
      ...typography.footnote,
      color: c.danger,
      marginLeft: spacing.lg,
      marginTop: 6,
    },
    termsError: {
      marginTop: 4,
      marginLeft: spacing.xs + 34,
    },
    termsRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingHorizontal: spacing.xs,
      marginTop: spacing.sm,
    },
    termsText: {
      flex: 1,
      ...typography.footnote,
      color: c.labelSecondary,
      lineHeight: 19,
    },
    termsLink: {
      fontFamily: font('600'),
      color: c.brand,
      fontWeight: '600',
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: spacing.xxl,
    },
    footerText: {
      ...typography.subhead,
      color: c.labelSecondary,
    },
    link: {
      ...typography.subheadBold,
      color: c.brand,
    },
  })
}
