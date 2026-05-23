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
import GoogleMark from '../../components/ui/GoogleMark'
import Icon from '../../components/ui/Icon'
import Checkbox from '../../components/ui/Checkbox'
import PasswordStrengthMeter from '../../components/ui/PasswordStrengthMeter'
import { useToast } from '../../components/ui/Toast'

import { spacing, typography, radius, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { useI18n } from '../../i18n'
import { useAuthStore } from '../../stores/auth'
import { register as registerApi, login as loginApi } from '../../api/auth'
import { validateEmail, validatePassword, INPUT_LIMITS } from '../../lib/validation'
import type { AuthStackParams } from '../../navigation'

type Nav = NativeStackNavigationProp<AuthStackParams, 'Register'>

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

  const emailRef = React.useRef<TextInput>(null)
  const passwordRef = React.useRef<TextInput>(null)
  const confirmRef = React.useRef<TextInput>(null)

  const nameError = submitted && !name.trim() ? t('register.errors.nameRequired') : null

  const emailKey = submitted ? validateEmail(email, { required: true }) : null
  const emailError = emailKey
    ? emailKey === 'emailRequired'
      ? t('login.errors.emailRequired')
      : t('login.errors.emailInvalid')
    : null

  const passwordKey = submitted ? validatePassword(password, { required: true }) : null
  const passwordError = passwordKey
    ? passwordKey === 'passwordRequired'
      ? t('login.errors.passwordRequired')
      : t(`register.errors.${passwordKey}`)
    : null

  // Live mismatch check: as soon as the user has typed both passwords, show
  // a hint without waiting for submit. Pre-submit, missing-field errors are
  // still gated on `submitted` so the user isn't yelled at on first paint.
  const confirmError = submitted
    ? !confirm
      ? t('register.errors.passwordConfirmRequired')
      : password !== confirm
        ? t('register.errors.passwordMismatch')
        : null
    : password && confirm && password !== confirm
      ? t('register.errors.passwordMismatch')
      : null

  const termsError = submitted && !acceptedTerms ? t('register.termsError') : null

  const mutation = useMutation({
    // The Laravel register endpoint does not issue mobile tokens on its
    // own — it just creates the account. Chain a login call so the user
    // lands in the app with a valid session instead of bouncing back to
    // the login screen.
    mutationFn: async () => {
      await registerApi({
        name: name.trim(),
        email: email.trim(),
        password,
        password_confirmation: confirm,
      })
      return loginApi(email.trim(), password)
    },
    onSuccess: ({ user, tokens }) => {
      toast.success(t('register.success'))
      setTimeout(() => setSession(user, tokens), 500)
    },
    onError: () => {
      toast.error(t('register.errors.registerFailed'))
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
                    onChangeText={setName}
                    autoCapitalize="words"
                    autoComplete="name"
                    textContentType="name"
                    returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()}
                    maxLength={INPUT_LIMITS.personName}
                    error={Boolean(nameError)}
                  />
                  {nameError ? <Text style={styles.fieldError}>{nameError}</Text> : null}
                </View>

                <View>
                  <InputCard
                    ref={emailRef}
                    iconName="mail-outline"
                    placeholder={t('register.emailPlaceholder')}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    textContentType="emailAddress"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    maxLength={INPUT_LIMITS.email}
                    error={Boolean(emailError)}
                  />
                  {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}
                </View>

                <View>
                  <InputCard
                    ref={passwordRef}
                    iconName="lock-closed-outline"
                    placeholder={t('register.passwordPlaceholder')}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPwd}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    returnKeyType="next"
                    onSubmitEditing={() => confirmRef.current?.focus()}
                    maxLength={INPUT_LIMITS.password}
                    error={Boolean(passwordError)}
                    rightAccessory={
                      <Pressable onPress={() => setShowPwd((v) => !v)} hitSlop={12}>
                        <Icon
                          name={showPwd ? 'eye-off-outline' : 'eye-outline'}
                          size={20}
                          color={c.labelSecondary as string}
                        />
                      </Pressable>
                    }
                  />
                  {passwordError ? (
                    <Text style={styles.fieldError}>{passwordError}</Text>
                  ) : null}
                </View>

                <PasswordStrengthMeter value={password} />

                <View>
                  <InputCard
                    ref={confirmRef}
                    iconName="shield-checkmark-outline"
                    placeholder={t('register.confirmPasswordPlaceholder')}
                    value={confirm}
                    onChangeText={setConfirm}
                    secureTextEntry={!showConfirm}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                    maxLength={INPUT_LIMITS.password}
                    error={Boolean(confirmError)}
                    rightAccessory={
                      <Pressable onPress={() => setShowConfirm((v) => !v)} hitSlop={12}>
                        <Icon
                          name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                          size={20}
                          color={c.labelSecondary as string}
                        />
                      </Pressable>
                    }
                  />
                  {confirmError ? (
                    <Text style={styles.fieldError}>{confirmError}</Text>
                  ) : null}
                </View>

                <View style={styles.termsRow}>
                  <Checkbox checked={acceptedTerms} onChange={setAcceptedTerms} />
                  <Text style={styles.termsText}>
                    {t('register.termsPrefix')}
                    <Text style={styles.termsLink} onPress={() => openLink('terms')}>
                      {t('register.termsLink')}
                    </Text>
                    {t('register.termsAnd')}
                    <Text style={styles.termsLink} onPress={() => openLink('privacy')}>
                      {t('register.privacyLink')}
                    </Text>
                    {t('register.termsSuffix')}
                  </Text>
                </View>
                {termsError ? (
                  <Text style={[styles.fieldError, styles.termsError]}>{termsError}</Text>
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

                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>{t('register.orContinueWith')}</Text>
                  <View style={styles.dividerLine} />
                </View>

                <Button
                  title={t('register.googleSignUp')}
                  variant="secondary"
                  fullWidth
                  size="lg"
                  leftIcon={<GoogleMark size={20} />}
                  onPress={() => toast.info(t('settings.comingSoon'))}
                />
              </View>

              <View style={styles.footer}>
                <Text style={styles.footerText}>{t('register.haveAccount')} </Text>
                <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8}>
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
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginVertical: spacing.xl,
    },
    dividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.separator as string,
    },
    dividerText: {
      ...typography.caption1,
      fontFamily: font('600'),
      color: c.labelSecondary,
      letterSpacing: 1.5,
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
