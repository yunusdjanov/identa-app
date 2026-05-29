import React, { useMemo, useState } from 'react'
import { View, Pressable, Text, StyleSheet, Platform } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import Icon, { IconName } from '../ui/Icon'
import CreateActionSheet from './CreateActionSheet'
import { useToast } from '../ui/Toast'
import { useI18n } from '../../i18n'
import { useUIStore } from '../../stores/ui'
import { useThemeStore } from '../../stores/theme'
import { useAuthStore } from '../../stores/auth'
import { canManage } from '../../lib/permissions'
import { radius, shadows, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

const TAB_ICONS: Record<string, { active: IconName; inactive: IconName }> = {
  Dashboard:    { active: 'home',     inactive: 'home-outline' },
  Patients:     { active: 'people',   inactive: 'people-outline' },
  Appointments: { active: 'calendar', inactive: 'calendar-outline' },
  Payments:     { active: 'card',     inactive: 'card-outline' },
}

const FAB_SIZE = 58
const LEFT_TABS = ['Dashboard', 'Patients']
const RIGHT_TABS = ['Appointments', 'Payments']

export default function CustomTabBar({ state, navigation, descriptors }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const { t } = useI18n()
  const toast = useToast()
  const c = useColors()
  const effective = useThemeStore((s) => s.effective)
  const styles = useMemo(() => makeStyles(c, effective), [c, effective])
  const [sheetOpen, setSheetOpen] = useState(false)

  // Gate the create FAB by permission + subscription. `canManage` already
  // returns false for view-only assistants and for any user whose
  // subscription is read_only, so this covers both dimensions.
  const user = useAuthStore((s) => s.user)
  const canAddPatient = canManage(user, 'patients')
  const canNewAppointment = canManage(user, 'appointments')
  const canCreate = canAddPatient || canNewAppointment

  const openTab = (name: string) => {
    Haptics.selectionAsync()
    const target = state.routes.find((r) => r.name === name)
    if (!target) return
    const isFocused = state.routes[state.index]?.name === name
    if (!isFocused) {
      navigation.navigate(target.name)
    }
  }

  const openFab = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setSheetOpen(true)
  }

  const onNewAppointment = () => {
    useUIStore.getState().openCreateAppointment()
  }

  const onAddPatient = () => {
    useUIStore.getState().openPatientForm(null)
  }

  const bottomPad = Math.max(insets.bottom, 16)

  return (
    <>
      <View
        pointerEvents="box-none"
        style={[styles.wrap, { paddingBottom: bottomPad }]}
      >
        <View style={[styles.bar, shadows.lg]}>
          {/* Left tabs */}
          <View style={styles.side}>
            {LEFT_TABS.map((name) => (
              <TabButton
                key={name}
                routeName={name}
                state={state}
                descriptors={descriptors}
                onPress={() => openTab(name)}
              />
            ))}
          </View>

          {/* Spacer for FAB */}
          <View style={{ width: FAB_SIZE + 12 }} />

          {/* Right tabs */}
          <View style={styles.side}>
            {RIGHT_TABS.map((name) => (
              <TabButton
                key={name}
                routeName={name}
                state={state}
                descriptors={descriptors}
                onPress={() => openTab(name)}
              />
            ))}
          </View>
        </View>

        {/* FAB — hidden entirely when the user can create neither patients
            nor appointments (view-only assistant or read_only subscription). */}
        {canCreate ? (
          <Pressable
            onPress={openFab}
            style={({ pressed }) => [
              styles.fabWrap,
              { bottom: bottomPad + 18 },
              pressed && { opacity: 0.92, transform: [{ scale: 0.96 }] },
            ]}
          >
            <LinearGradient
              colors={[c.brand, effective === 'dark' ? '#15B5A3' : '#0E9C8E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.fab, shadows.lg]}
            >
              <Icon name="add" size={30} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
        ) : null}
      </View>

      <CreateActionSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onAddPatient={onAddPatient}
        onNewAppointment={onNewAppointment}
        canAddPatient={canAddPatient}
        canNewAppointment={canNewAppointment}
      />
    </>
  )
}

interface TabButtonProps {
  routeName: string
  state: BottomTabBarProps['state']
  descriptors: BottomTabBarProps['descriptors']
  onPress: () => void
}

function TabButton({ routeName, state, descriptors, onPress }: TabButtonProps) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c, 'light'), [c]) // styles don't change w/ scheme here
  const route = state.routes.find((r) => r.name === routeName)
  if (!route) return null
  const focused = state.routes[state.index]?.name === routeName
  const options = descriptors[route.key]?.options
  const label =
    typeof options?.tabBarLabel === 'string'
      ? options.tabBarLabel
      : (options?.title ?? routeName)
  const iconConfig = TAB_ICONS[routeName]
  const iconName = focused ? iconConfig.active : iconConfig.inactive
  const color = focused ? (c.brand as string) : (c.labelSecondary as string)

  return (
    <Pressable onPress={onPress} style={styles.tabBtn} hitSlop={6}>
      <Icon name={iconName} size={22} color={color} />
      <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

function makeStyles(c: Colors, effective: 'light' | 'dark') {
  return StyleSheet.create({
    wrap: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      // Dark mode: solid backgroundSecondary so the floating pill reads as a
      // surface above the deep root. Light mode keeps the translucent white
      // overlay so the gradient above shows through.
      backgroundColor:
        effective === 'dark'
          ? c.backgroundSecondary
          : Platform.OS === 'ios'
            ? 'rgba(255,255,255,0.94)'
            : '#FFFFFF',
      borderRadius: radius.pill,
      marginHorizontal: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
      width: '92%',
      minHeight: 64,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: effective === 'dark' ? c.separator as string : 'rgba(0,0,0,0.06)',
    },
    side: {
      flexDirection: 'row',
      flex: 1,
      justifyContent: 'space-around',
    },
    tabBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      paddingVertical: 4,
    },
    tabLabel: {
      fontFamily: font('600'),
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 0.1,
    },
    fabWrap: {
      position: 'absolute',
      alignSelf: 'center',
    },
    fab: {
      width: FAB_SIZE,
      height: FAB_SIZE,
      borderRadius: FAB_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: c.brand,
      shadowOpacity: 0.5,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
  })
}
