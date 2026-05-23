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
import * as Haptics from 'expo-haptics'

import Button from '../../components/ui/Button'
import InputCard from '../../components/ui/InputCard'
import Icon from '../../components/ui/Icon'
import { useToast } from '../../components/ui/Toast'

import { spacing, typography, radius } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { useI18n } from '../../i18n'
import { requestPasswordReset } from '../../api/auth'

export default function ForgotPasswordScreen() {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const navigation = useNavigation()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const emailError = submitted
    ? validateEmail(email, {
        required: t('login.errors.emailRequired'),
        invalid: t('login.errors.emailInvalid'),
      })
    : null

  const mutation = useMutation({
    mutationFn: () => requestPasswordReset(email.trim()),
    onSuccess: () => {
      toast.success(t('forgotPassword.success'))
      setTimeout(() => navigation.goBack(), 800)
    },
    onError: () => {
      toast.error(t('forgotPassword.failed'))
    },
  })

  const handleSubmit = () => {
    Keyboard.dismiss()
    setSubmitted(true)
    const eErr = validateEmail(email, {
      required: t('login.errors.emailRequired'),
      invalid: t('login.errors.emailInvalid'),
    })
    if (eErr) {
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
          <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
            <Icon name="chevron-back" size={26} color={c.brand as string} />
            <Text style={styles.backText}>{t('common.back')}</Text>
          </Pressable>
          <View />
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
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  textContentType="emailAddress"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  maxLength={255}
                  error={Boolean(emailError)}
                />

                {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

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
