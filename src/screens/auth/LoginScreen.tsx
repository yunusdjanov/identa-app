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
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useMutation } from '@tanstack/react-query'
import { useNavigation } from '@react-navigation/native'
import { useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as Haptics from 'expo-haptics'

import Brand from '../../components/ui/Brand'
import Button from '../../components/ui/Button'
import Checkbox from '../../components/ui/Checkbox'
import InputCard from '../../components/ui/InputCard'
import LanguageSwitcher from '../../components/ui/LanguageSwitcher'
import Icon from '../../components/ui/Icon'
import { useToast } from '../../components/ui/Toast'

import { spacing, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { useI18n } from '../../i18n'
import { useAuthStore } from '../../stores/auth'
import { login as loginApi } from '../../api/auth'
import { getAuthErrorMessage } from '../../lib/authErrorMessage'
import type { AuthStackParams } from '../../navigation'

type Nav = NativeStackNavigationProp<AuthStackParams, 'Login'>
type LoginRoute = RouteProp<AuthStackParams, 'Login'>

export default function LoginScreen() {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const navigation = useNavigation<Nav>()
  const route = useRoute<LoginRoute>()
  const setSession = useAuthStore((s) => s.setSession)
  const toast = useToast()

  const [email, setEmail] = useState(route.params?.initialEmail ?? '')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPwd, setShowPwd] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const passwordRef = React.useRef<TextInput>(null)

  const emailError = submitted
    ? validateEmail(email, {
        required: t('login.errors.emailRequired'),
        invalid: t('login.errors.emailInvalid'),
      })
    : null
  const passwordError = submitted && !password ? t('login.errors.passwordRequired') : null

  const loginMutation = useMutation({
    mutationFn: () => loginApi(email.trim(), password),
    onSuccess: ({ user, tokens }) => {
      // Token must land in the store BEFORE any other request fires so
      // the axios interceptor attaches it. setSession is synchronous.
      setSession(user, tokens, remember)
      toast.success(t('login.success'))
    },
    onError: (err) => {
      // Keep credential failures generic so blocked, missing, and
      // wrong-password accounts cannot be enumerated.
      toast.error(getAuthErrorMessage(err, t, 'login.errors.loginFailed'))
    },
  })

  const handleSubmit = () => {
    Keyboard.dismiss()
    setSubmitted(true)
    const eErr = validateEmail(email, {
      required: t('login.errors.emailRequired'),
      invalid: t('login.errors.emailInvalid'),
    })
    if (eErr || !password) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      return
    }
    loginMutation.mutate()
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
          <View />
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
                <Brand variant="text" size={150} style={{ marginBottom: spacing.xxl }} />
                <Text style={styles.title}>{t('login.welcome')}</Text>
                <Text style={styles.subtitle}>{t('login.subtitle')}</Text>
              </View>

              <View style={styles.formBlock}>
                <View>
                  <InputCard
                    iconName="mail-outline"
                    placeholder={t('login.emailPlaceholder')}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    textContentType="emailAddress"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    maxLength={255}
                    error={Boolean(emailError)}
                    errorMessage={emailError}
                    accessibilityLabel={t('login.email')}
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
                    placeholder={t('login.passwordPlaceholder')}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPwd}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="current-password"
                    textContentType="password"
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                    maxLength={255}
                    error={Boolean(passwordError)}
                    errorMessage={passwordError}
                    accessibilityLabel={t('login.password')}
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

                <View style={styles.row}>
                  <Checkbox checked={remember} onChange={setRemember} label={t('login.rememberMe')} />
                  <Pressable
                    onPress={() => navigation.navigate('ForgotPassword')}
                    hitSlop={10}
                    accessibilityRole="link"
                  >
                    <Text style={styles.link}>{t('login.forgotPassword')}</Text>
                  </Pressable>
                </View>

                <Button
                  title={loginMutation.isPending ? t('login.signingIn') : t('login.signIn')}
                  onPress={handleSubmit}
                  loading={loginMutation.isPending}
                  fullWidth
                  size="lg"
                  style={{ marginTop: spacing.lg }}
                  rightIcon={
                    loginMutation.isPending ? null : (
                      <Icon name="arrow-forward" size={18} color="#FFFFFF" />
                    )
                  }
                />

              </View>

              <View style={styles.footer}>
                <Text style={styles.footerText}>{t('login.noAccount')} </Text>
                <Pressable
                  onPress={() => navigation.navigate('Register')}
                  hitSlop={8}
                  accessibilityRole="link"
                >
                  <Text style={styles.link}>{t('login.createAccount')}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

function validateEmail(value: string, messages: { required: string; invalid: string }): string | null {
  const v = value.trim()
  if (!v) return messages.required
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!pattern.test(v)) return messages.invalid
  return null
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    flex: { flex: 1 },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
    },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xxl,
      paddingBottom: spacing.xxxl,
    },
    heroBlock: {
      alignItems: 'center',
      marginBottom: spacing.xxxl,
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
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    link: {
      ...typography.subheadBold,
      color: c.brand,
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
  })
}
