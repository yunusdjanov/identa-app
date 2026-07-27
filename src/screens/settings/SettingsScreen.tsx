import React, { useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { LinearGradient } from 'expo-linear-gradient'
import Constants from 'expo-constants'
import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'

import ProfileCard from '../../components/settings/ProfileCard'
import SubscriptionBanner from '../../components/settings/SubscriptionBanner'
import SettingsSection from '../../components/settings/SettingsSection'
import SettingsRow from '../../components/settings/SettingsRow'
import ProfileEditSheet from '../../components/settings/ProfileEditSheet'
import PasswordChangeSheet from '../../components/settings/PasswordChangeSheet'
import WorkingHoursSheet from '../../components/settings/WorkingHoursSheet'
import PracticeInfoSheet from '../../components/settings/PracticeInfoSheet'
import LanguageSheet from '../../components/settings/LanguageSheet'
import TeamManagementSheet from '../../components/settings/TeamManagementSheet'
import BillingSheet from '../../components/settings/BillingSheet'
import HelpSheet from '../../components/settings/HelpSheet'
import AuditLogsSheet from '../../components/settings/AuditLogsSheet'
import Icon from '../../components/ui/Icon'
import { useToast } from '../../components/ui/Toast'
import { useDialog } from '../../components/ui/Dialog'
import AppHeader, { HeaderIconButton } from '../../components/navigation/AppHeader'

import { useI18n } from '../../i18n'
import { useAuthStore } from '../../stores/auth'
import { logout as logoutApi } from '../../api/auth'
import { getCurrentSubscription } from '../../api/billing'
import {
  canViewAnalytics,
  isSubscriptionReadOnly,
  mustRotatePassword,
} from '../../lib/permissions'
import { spacing, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import type { MainStackParams } from '../../navigation'

const LANGUAGE_LABEL: Record<string, string> = {
  uz: "O'zbek",
  ru: 'Русский',
  en: 'English',
}

export default function SettingsScreen() {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const logout = useAuthStore((s) => s.logout)
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParams>>()
  const toast = useToast()
  const { confirm } = useDialog()

  const isDentist = user?.role === 'dentist'
  const forcePasswordChange = mustRotatePassword(user)
  const showAnalytics = canViewAnalytics(user)
  const isReadOnly = isSubscriptionReadOnly(user)
  const subscriptionQuery = useQuery({
    queryKey: ['billing', 'current-subscription'],
    queryFn: getCurrentSubscription,
    enabled: isDentist && !forcePasswordChange,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  React.useEffect(() => {
    if (subscriptionQuery.data === undefined) return

    const currentUser = useAuthStore.getState().user
    if (currentUser) {
      setUser({ ...currentUser, subscription: subscriptionQuery.data })
    }
  }, [setUser, subscriptionQuery.data])

  type ActiveSheet = 'profile' | 'password' | 'hours' | 'practice' | 'language' | 'team' | 'audit' | 'billing' | 'help' | null
  const [activeSheet, setActiveSheet] = React.useState<ActiveSheet>(null)
  const closeSheet = () => setActiveSheet(null)

  React.useEffect(() => {
    if (forcePasswordChange) setActiveSheet('password')
  }, [forcePasswordChange])

  const onClose = () => {
    navigation.goBack()
  }

  const openExternal = (url: string) => {
    Haptics.selectionAsync()
    Linking.openURL(url).catch(() => {
      toast.error(t('common.retry'))
    })
  }

  const onLogout = async () => {
    const ok = await confirm({
      title: t('settings.logoutConfirm'),
      message: t('settings.logoutConfirmSub'),
      confirmLabel: t('settings.logout'),
      destructive: true,
    })
    if (!ok) return
    try {
      await logoutApi()
    } catch {
      // ignore
    }
    logout()
  }

  const version = Constants.expoConfig?.version ?? '1.0.0'

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[c.brandSurface, '#FFFFFF', '#FFFFFF']}
        locations={[0, 0.2, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" />

        <AppHeader
          title={t('settings.title')}
          actions={
            forcePasswordChange ? undefined : (
              <HeaderIconButton
                icon="close"
                label={t('common.done')}
                onPress={onClose}
                variant="neutral"
              />
            )
          }
        />

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {forcePasswordChange ? (
            <>
              <View style={styles.forcePasswordCard} accessibilityRole="alert">
                <View style={styles.forcePasswordIcon}>
                  <Icon name="shield-checkmark-outline" size={22} color="#92400E" />
                </View>
                <View style={styles.forcePasswordCopy}>
                  <Text style={styles.forcePasswordTitle}>
                    {t('settings.passwordSheet.forcedTitle')}
                  </Text>
                  <Text style={styles.forcePasswordText}>
                    {t('settings.passwordSheet.forcedDescription')}
                  </Text>
                </View>
              </View>

              <SettingsSection title={t('settings.sections.account')}>
                <SettingsRow
                  iconName="lock-closed-outline"
                  iconColor="#92400E"
                  iconBg="#FEF3C7"
                  label={t('settings.rows.password')}
                  onPress={() => setActiveSheet('password')}
                />
              </SettingsSection>

              <SettingsSection>
                <SettingsRow
                  iconName="log-out-outline"
                  label={t('settings.logout')}
                  destructive
                  onPress={onLogout}
                />
              </SettingsSection>
            </>
          ) : user ? (
            <>
              <ProfileCard user={user} />
              <SubscriptionBanner subscription={user.subscription} />
            </>
          ) : null}

          {/* Account section */}
          {!forcePasswordChange ? <SettingsSection title={t('settings.sections.account')}>
            <SettingsRow
              iconName="person-outline"
              label={t('settings.rows.profile')}
              disabled={isReadOnly}
              onPress={() => setActiveSheet('profile')}
            />
            <SettingsRow
              iconName="lock-closed-outline"
              iconColor="#92400E"
              iconBg="#FEF3C7"
              label={t('settings.rows.password')}
              onPress={() => setActiveSheet('password')}
            />
            {isDentist ? (
              <SettingsRow
                iconName="time-outline"
                iconColor="#1D4ED8"
                iconBg="#DBEAFE"
                label={t('settings.rows.workingHours')}
                disabled={isReadOnly}
                onPress={() => setActiveSheet('hours')}
              />
            ) : null}
          </SettingsSection> : null}

          {/* Practice section (dentist only) */}
          {isDentist && !forcePasswordChange ? (
            <SettingsSection title={t('settings.sections.practice')}>
              <SettingsRow
                iconName="business-outline"
                iconColor="#7C3AED"
                iconBg="#EDE9FE"
                label={t('settings.rows.practiceInfo')}
                disabled={isReadOnly}
                onPress={() => setActiveSheet('practice')}
              />
              <SettingsRow
                iconName="people-outline"
                iconColor="#0E7490"
                iconBg="#CFFAFE"
                label={t('settings.rows.team')}
                onPress={() => setActiveSheet('team')}
              />
              <SettingsRow
                iconName="document-text-outline"
                iconColor="#7C3AED"
                iconBg="#EDE9FE"
                label={t('settings.rows.actionLogs')}
                onPress={() => setActiveSheet('audit')}
              />
              <SettingsRow
                iconName="card-outline"
                iconColor="#16A34A"
                iconBg="#DCFCE7"
                label={t('settings.rows.billing')}
                onPress={() => setActiveSheet('billing')}
              />
            </SettingsSection>
          ) : null}

          {/* App section */}
          {!forcePasswordChange ? <SettingsSection title={t('settings.sections.app')}>
            {showAnalytics ? (
              <SettingsRow
                iconName="stats-chart-outline"
                iconColor="#0F766E"
                iconBg="#CCFBF1"
                label={t('analytics.title')}
                onPress={() => navigation.navigate('Analytics')}
              />
            ) : null}
            <SettingsRow
              iconName="globe-outline"
              iconColor="#2563EB"
              iconBg="#DBEAFE"
              label={t('settings.rows.language')}
              value={LANGUAGE_LABEL[locale]}
              onPress={() => setActiveSheet('language')}
            />
          </SettingsSection> : null}

          {/* Support section */}
          {!forcePasswordChange ? <SettingsSection title={t('settings.sections.support')}>
            <SettingsRow
              iconName="help-circle-outline"
              iconColor="#0369A1"
              iconBg="#F0F9FF"
              label={t('settings.rows.help')}
              onPress={() => setActiveSheet('help')}
            />
            <SettingsRow
              iconName="shield-checkmark-outline"
              iconColor="#15803D"
              iconBg="#E8F8EE"
              label={t('settings.rows.privacy')}
              onPress={() => openExternal('https://identa.uz/privacy')}
            />
            <SettingsRow
              iconName="document-text-outline"
              iconColor="#6B7280"
              iconBg={c.fillQuaternary}
              label={t('settings.rows.terms')}
              onPress={() => openExternal('https://identa.uz/terms')}
            />
          </SettingsSection> : null}

          {/* Logout */}
          {!forcePasswordChange ? <SettingsSection>
            <SettingsRow
              iconName="log-out-outline"
              label={t('settings.logout')}
              destructive
              onPress={onLogout}
            />
          </SettingsSection> : null}

          <Text style={styles.version}>{t('settings.version', { v: version })}</Text>
        </ScrollView>
      </SafeAreaView>

      <ProfileEditSheet
        visible={activeSheet === 'profile'}
        onClose={closeSheet}
      />
      <PasswordChangeSheet
        visible={activeSheet === 'password'}
        onClose={closeSheet}
      />
      <WorkingHoursSheet
        visible={activeSheet === 'hours'}
        onClose={closeSheet}
      />
      <PracticeInfoSheet
        visible={activeSheet === 'practice'}
        onClose={closeSheet}
      />
      <LanguageSheet
        visible={activeSheet === 'language'}
        onClose={closeSheet}
      />
      <TeamManagementSheet
        visible={activeSheet === 'team'}
        onClose={closeSheet}
      />
      <BillingSheet
        visible={activeSheet === 'billing'}
        onClose={closeSheet}
      />
      <HelpSheet
        visible={activeSheet === 'help'}
        onClose={closeSheet}
      />
      <AuditLogsSheet
        visible={activeSheet === 'audit'}
        onClose={closeSheet}
      />
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    flex: { flex: 1 },
    scroll: {
      paddingBottom: 60,
      gap: spacing.lg,
    },
    version: {
      fontFamily: font('500'),
      fontSize: 12,
      fontWeight: '500',
      color: c.labelTertiary,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    forcePasswordCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      marginHorizontal: spacing.lg,
      padding: spacing.md,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: '#FCD34D',
      backgroundColor: '#FFFBEB',
    },
    forcePasswordIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FEF3C7',
    },
    forcePasswordCopy: { flex: 1, gap: 3 },
    forcePasswordTitle: {
      fontFamily: font('700'),
      fontSize: 15,
      fontWeight: '700',
      color: '#78350F',
    },
    forcePasswordText: {
      ...typography.subhead,
      color: '#92400E',
    },
  })
}
