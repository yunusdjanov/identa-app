import React, { useEffect } from 'react'
import { Platform } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { NavigationContainer, type LinkingOptions } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useAuthStore } from '../stores/auth'
import { useUIStore } from '../stores/ui'
import { useI18n } from '../i18n'
import CustomTabBar from '../components/navigation/CustomTabBar'
import AppointmentCreateSheet from '../components/appointments/AppointmentCreateSheet'
import PatientFormSheet from '../components/patients/PatientFormSheet'
import { fromLocalDateKey } from '../lib/format'
import { getExpoPushToken } from '../lib/notifications'
import { registerDeviceToken } from '../api/devices'

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen'
import RegisterScreen from '../screens/auth/RegisterScreen'
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen'
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen'

// Main screens
import DashboardScreen from '../screens/dashboard/DashboardScreen'
import PatientListScreen from '../screens/patients/PatientListScreen'
import PatientDetailScreen from '../screens/patients/PatientDetailScreen'
import OdontogramScreen from '../screens/patients/OdontogramScreen'
import AppointmentsScreen from '../screens/appointments/AppointmentsScreen'
import PaymentsScreen from '../screens/payments/PaymentsScreen'
import SettingsScreen from '../screens/settings/SettingsScreen'
import AnalyticsScreen from '../screens/analytics/AnalyticsScreen'

export type AuthStackParams = {
  Login: undefined
  Register: undefined
  ForgotPassword: undefined
  // Reached via the password-reset deep link (token + email in query string).
  ResetPassword: { token?: string; email?: string }
}

export type MainTabParams = {
  Dashboard: undefined
  Patients: undefined
  Appointments: undefined
  Payments: undefined
}

export type MainStackParams = {
  Tabs: undefined
  Settings: undefined
  Analytics: undefined
  PatientDetail: { id: string }
  PatientOdontogram: { patientId: string; patientName?: string }
}

const AuthStack = createNativeStackNavigator<AuthStackParams>()
const Tab = createBottomTabNavigator<MainTabParams>()
const MainStack = createNativeStackNavigator<MainStackParams>()

function MainTabs() {
  const { t } = useI18n()

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: t('tabs.dashboard') }}
      />
      <Tab.Screen
        name="Patients"
        component={PatientListScreen}
        options={{ title: t('tabs.patients') }}
      />
      <Tab.Screen
        name="Appointments"
        component={AppointmentsScreen}
        options={{ title: t('tabs.appointments') }}
      />
      <Tab.Screen
        name="Payments"
        component={PaymentsScreen}
        options={{ title: t('tabs.payments') }}
      />
    </Tab.Navigator>
  )
}

function MainNavigator() {
  const queryClient = useQueryClient()

  // Register this device's Expo push token once after the user is signed in.
  // Token never changes for a given install/user combo, so the mock backend
  // dedupes by token. The token also stays valid across app relaunches.
  useEffect(() => {
    let cancelled = false
    getExpoPushToken().then((token) => {
      if (cancelled || !token) return
      registerDeviceToken({
        expo_push_token: token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        app_version: '1.0.0',
      }).catch(() => {
        // Silent — push registration failure shouldn't block the user.
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  const createApptOpen = useUIStore((s) => s.createAppointmentOpen)
  const createApptDate = useUIStore((s) => s.createAppointmentDate)
  const createApptPatient = useUIStore((s) => s.createAppointmentPatient)
  const closeCreateAppt = useUIStore((s) => s.closeCreateAppointment)

  const patientFormOpen = useUIStore((s) => s.patientFormOpen)
  const patientFormId = useUIStore((s) => s.patientFormId)
  const closePatientForm = useUIStore((s) => s.closePatientForm)

  return (
    <>
      <MainStack.Navigator screenOptions={{ headerShown: false }}>
        <MainStack.Screen name="Tabs" component={MainTabs} />
        <MainStack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ presentation: 'modal' }}
        />
        <MainStack.Screen name="PatientDetail" component={PatientDetailScreen} />
        <MainStack.Screen name="PatientOdontogram" component={OdontogramScreen} />
        <MainStack.Screen name="Analytics" component={AnalyticsScreen} />
      </MainStack.Navigator>

      <AppointmentCreateSheet
        visible={createApptOpen}
        defaultDate={createApptDate ? fromLocalDateKey(createApptDate) : undefined}
        defaultPatient={createApptPatient ?? undefined}
        onClose={closeCreateAppt}
        onCreated={(created) => {
          queryClient.invalidateQueries({ queryKey: ['appointments'] })
          queryClient.invalidateQueries({ queryKey: ['dashboard'] })
          // Ask AppointmentsScreen to focus the new appointment's date. This
          // prevents the common confusion where a user creates for tomorrow
          // while viewing this week and assumes the create silently failed —
          // AppointmentsScreen jumps to the matching week on next mount /
          // immediately if already mounted.
          useUIStore.getState().requestAppointmentsViewDate(created.appointment_date)
        }}
      />

      <PatientFormSheet
        visible={patientFormOpen}
        patientId={patientFormId}
        onClose={closePatientForm}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['patients'] })
        }}
      />
    </>
  )
}

// Deep link map. URLs like `identa://patient/123` will open the matching
// in-app screen. Useful for chat/email links, push notifications, and any
// QR codes printed by the clinic.
const linking: LinkingOptions<MainStackParams & AuthStackParams> = {
  prefixes: ['identa://', 'https://identa.uz'],
  config: {
    screens: {
      Tabs: {
        screens: {
          Dashboard: 'home',
          Patients: 'patients',
          Appointments: 'appointments',
          Payments: 'payments',
        },
      },
      Settings: 'settings',
      PatientDetail: 'patient/:id',
      PatientOdontogram: 'patient/:patientId/odontogram',
      // Resolves while logged out (ResetPassword lives in AuthStack). Query
      // params `?token=…&email=…` map onto the screen's route params.
      ResetPassword: 'reset-password',
    },
  },
}

export default function Navigation() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return (
    <NavigationContainer linking={linking}>
      {isAuthenticated ? (
        <MainNavigator />
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="Register" component={RegisterScreen} />
          <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <AuthStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  )
}
