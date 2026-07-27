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
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as Haptics from 'expo-haptics'

import Button from '../../components/ui/Button'
import InputCard from '../../components/ui/InputCard'
import Icon from '../../components/ui/Icon'
import LanguageSwitcher from '../../components/ui/LanguageSwitcher'
import { useToast } from '../../components/ui/Toast'

import { spacing, typography, radius } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { useI18n } from '../../i18n'
import { requestPasswordReset } from '../../api/auth'
import { getAuthErrorMessage } from '../../lib/authErrorMessage'
import { INPUT_LIMITS, validateEmail } from '../../lib/validation'
import type { AuthStackParams } from '../../navigation'

type Nav = NativeStackNavigationProp<AuthStackParams>

export default function ForgotPasswordScreen() {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const navigation = useNavigation<Nav>()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [sent, setSent] = useState(false)

  const emailErrorKey = submitted ? validateEmail(email, { required: true }) : null
  const emailError = emailErrorKey ? t(`login.errors.${emailErrorKey}`) : null

  const mutation = useMutation({
    mutationFn: () => requestPasswordReset(email.trim()),
    onSuccess: () => {
      setSent(true)
      toast.success(t('forgotPassword.success'))
    },
    onError: (error) => {
      toast.error(getAuthErrorMessage(error, t, 'forgotPassword.failed'))
    },
  })

  const handleSubmit = () => {
    Keyboard.dismiss()
    setSubmitted(true)
    if (validateEmail(email, { required: true })) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      return
    }
    mutation.mutate()
  }

  const onBack = () => {
    Haptics.selectionAsync()
    navigation.goBack()
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
                  <Icon name="key-outline" size={32} color={c.brand as string} />
                </View>
                <Text style={styles.title}>{t('forgotPassword.title')}</Text>
                <Text style={styles.subtitle}>{t('forgotPassword.subtitle')}</Text>
              </View>

              <View style={styles.formBlock}>
                <InputCard
                  iconName="mail-outline"
                  placeholder={t('login.emailPlaceholder')}
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value)
                    setSent(false)
                  }}
                  accessibilityLabel={t('login.email')}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  textContentType="emailAddress"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  maxLength={INPUT_LIMITS.email}
                  error={Boolean(emailError)}
                  errorMessage={emailError}
                />

                {emailError ? (
                  <Text style={styles.errorText} accessibilityRole="alert">
                    {emailError}
                  </Text>
                ) : null}

                {sent ? (
                  <View style={styles.sentCard} accessibilityRole="alert">
                    <Icon name="checkmark-circle" size={22} color={c.success as string} />
                    <View style={styles.sentCopy}>
                      <Text style={styles.sentTitle}>{t('forgotPassword.success')}</Text>
                      <Text style={styles.sentHelp}>{t('forgotPassword.sentHelp')}</Text>
                    </View>
                  </View>
                ) : null}

                <Button
                  title={mutation.isPending ? t('forgotPassword.submitting') : t('forgotPassword.submit')}
                  onPress={handleSubmit}
                  loading={mutation.isPending}
                  fullWidth
                  size="lg"
                  style={{ marginTop: spacing.lg }}
                />
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
    sentCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: c.brandLight,
    },
    sentCopy: { flex: 1, gap: spacing.xs },
    sentTitle: { ...typography.footnoteBold, color: c.success },
    sentHelp: { ...typography.footnote, color: c.labelSecondary },
  })
}
