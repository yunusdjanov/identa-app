import React, { useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Pressable,
  Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'
import { useQueryClient } from '@tanstack/react-query'
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
import NotificationsSheet from '../../components/settings/NotificationsSheet'
import BillingSheet from '../../components/settings/BillingSheet'
import HelpSheet from '../../components/settings/HelpSheet'
import AppearanceSheet from '../../components/settings/AppearanceSheet'
import SessionsSheet from '../../components/settings/SessionsSheet'
import Icon from '../../components/ui/Icon'
import { useToast } from '../../components/ui/Toast'
import { useDialog } from '../../components/ui/Dialog'

import { useI18n } from '../../i18n'
import { useAuthStore } from '../../stores/auth'
import { useThemeStore } from '../../stores/theme'
import { logout as logoutApi } from '../../api/auth'
import { spacing, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

const LANGUAGE_LABEL: Record<string, string> = {
  uz: "O'zbek",
  ru: 'Русский',
  en: 'English',
}

export default function SettingsScreen() {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const effective = useThemeStore((s) => s.effective)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigation = useNavigation()
  const toast = useToast()
  const { confirm } = useDialog()
  const queryClient = useQueryClient()

  const isDentist = user?.role === 'dentist'

  type ActiveSheet = 'profile' | 'password' | 'hours' | 'practice' | 'language' | 'appearance' | 'team' | 'notifications' | 'billing' | 'help' | 'sessions' | null
  const [activeSheet, setActiveSheet] = React.useState<ActiveSheet>(null)
  const closeSheet = () => setActiveSheet(null)

  const onClose = () => {
    Haptics.selectionAsync()
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
    queryClient.clear()
    logout()
  }

  const version = '1.0.0'

  // Dark mode gets a deeper background gradient; light mode keeps the
  // original brandSurface → white wash.
  const gradientColors: [string, string, string] =
    effective === 'dark'
      ? [c.background, c.background, c.background]
      : [c.brandSurface, '#FFFFFF', '#FFFFFF']

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={gradientColors}
        locations={[0, 0.2, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <StatusBar barStyle={effective === 'dark' ? 'light-content' : 'dark-content'} />

        {/* Top bar with title + close */}
        <View style={styles.topBar}>
          <View style={{ width: 32 }} />
          <Text style={styles.title}>{t('settings.title')}</Text>
          <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
            <Icon name="close" size={20} color={c.labelSecondary as string} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {user ? (
            <>
              <ProfileCard user={user} />
              <SubscriptionBanner subscription={user.subscription} />
            </>
          ) : null}

          {/* Account section */}
          <SettingsSection title={t('settings.sections.account')}>
            <SettingsRow
              iconName="person-outline"
              label={t('settings.rows.profile')}
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
                onPress={() => setActiveSheet('hours')}
              />
            ) : null}
          </SettingsSection>

          {/* Practice section (dentist only) */}
          {isDentist ? (
            <SettingsSection title={t('settings.sections.practice')}>
              <SettingsRow
                iconName="business-outline"
                iconColor="#7C3AED"
                iconBg="#EDE9FE"
                label={t('settings.rows.practiceInfo')}
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
                iconName="card-outline"
                iconColor="#16A34A"
                iconBg="#DCFCE7"
                label={t('settings.rows.billing')}
                onPress={() => setActiveSheet('billing')}
              />
            </SettingsSection>
          ) : null}

          {/* App section */}
          <SettingsSection title={t('settings.sections.app')}>
            <SettingsRow
              iconName="globe-outline"
              iconColor="#2563EB"
              iconBg="#DBEAFE"
              label={t('settings.rows.language')}
              value={LANGUAGE_LABEL[locale]}
              onPress={() => setActiveSheet('language')}
            />
            <SettingsRow
              iconName="contrast-outline"
              iconColor="#5856D6"
              iconBg="#EDE9FE"
              label={t('settings.rows.appearance')}
              onPress={() => setActiveSheet('appearance')}
            />
            <SettingsRow
              iconName="notifications-outline"
              iconColor="#D97706"
              iconBg="#FEF3C7"
              label={t('settings.rows.notifications')}
              onPress={() => setActiveSheet('notifications')}
            />
            <SettingsRow
              iconName="shield-half-outline"
              iconColor="#0E7490"
              iconBg="#CFFAFE"
              label={t('settings.rows.sessions')}
              onPress={() => setActiveSheet('sessions')}
            />
          </SettingsSection>

          {/* Support section */}
          <SettingsSection title={t('settings.sections.support')}>
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
          </SettingsSection>

          {/* Logout */}
          <SettingsSection>
            <SettingsRow
              iconName="log-out-outline"
              label={t('settings.logout')}
              destructive
              onPress={onLogout}
            />
          </SettingsSection>

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
      <NotificationsSheet
        visible={activeSheet === 'notifications'}
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
      <AppearanceSheet
        visible={activeSheet === 'appearance'}
        onClose={closeSheet}
      />
      <SessionsSheet
        visible={activeSheet === 'sessions'}
        onClose={closeSheet}
      />
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    flex: { flex: 1 },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xs,
      paddingBottom: spacing.md,
    },
    title: {
      ...typography.headline,
      color: c.brandDeep,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.fillQuaternary,
      alignItems: 'center',
      justifyContent: 'center',
    },
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
  })
}
