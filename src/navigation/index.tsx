import React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  NavigationContainer,
  type LinkingOptions,
  type NavigatorScreenParams,
} from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useAuthStore } from '../stores/auth'
import { useUIStore } from '../stores/ui'
import { useI18n } from '../i18n'
import CustomTabBar from '../components/navigation/CustomTabBar'
import AppointmentCreateSheet from '../components/appointments/AppointmentCreateSheet'
import PatientFormSheet from '../components/patients/PatientFormSheet'
import { fromLocalDateKey } from '../lib/format'
import { mustRotatePassword } from '../lib/permissions'
import { getCurrentUser } from '../api/auth'

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen'
import RegisterScreen from '../screens/auth/RegisterScreen'
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen'
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen'

// Main screens
import PatientListScreen from '../screens/patients/PatientListScreen'
import PatientDetailScreen from '../screens/patients/PatientDetailScreen'
import AppointmentsScreen from '../screens/appointments/AppointmentsScreen'
import PaymentsScreen from '../screens/payments/PaymentsScreen'
import PaymentPatientDetailScreen from '../screens/payments/PaymentPatientDetailScreen'
import SettingsScreen from '../screens/settings/SettingsScreen'
import AnalyticsScreen from '../screens/analytics/AnalyticsScreen'

export type AuthStackParams = {
  Login: { initialEmail?: string } | undefined
  Register: undefined
  ForgotPassword: undefined
  // Reached via the password-reset deep link (token + email in query string).
  ResetPassword: { token?: string; email?: string }
}

export type MainTabParams = {
  Dashboard: undefined
  Patients: undefined
  Analytics: undefined
  Payments: { outstandingOnly?: boolean; requestId?: number } | undefined
}

export type MainStackParams = {
  Tabs: NavigatorScreenParams<MainTabParams> | undefined
  Settings: undefined
  Analytics: undefined
  PatientDetail: { id: string }
  PaymentPatientDetail: { id: string }
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
        component={AppointmentsScreen}
        options={{ title: t('tabs.dashboard') }}
      />
      <Tab.Screen
        name="Patients"
        component={PatientListScreen}
        options={{ title: t('tabs.patients') }}
      />
      <Tab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{ title: t('analytics.title') }}
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
        <MainStack.Screen
          name="PaymentPatientDetail"
          component={PaymentPatientDetailScreen}
        />
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

function PasswordRotationNavigator() {
  return (
    <MainStack.Navigator screenOptions={{ headerShown: false }}>
      <MainStack.Screen name="Settings" component={SettingsScreen} />
    </MainStack.Navigator>
  )
}

// Deep link map. URLs like `identa://patient/123` will open the matching
// in-app screen. Useful for chat/email links and QR codes printed by the clinic.
const linking: LinkingOptions<MainStackParams & AuthStackParams> = {
  prefixes: ['identa://', 'https://identa.uz', 'https://app.identa.uz'],
  config: {
    screens: {
      Tabs: {
        screens: {
          Dashboard: 'home',
          Patients: 'patients',
          Analytics: 'tab-analytics',
          Payments: 'payments',
        },
      },
      Settings: 'settings',
      Analytics: 'analytics',
      PatientDetail: 'patient/:id',
      PaymentPatientDetail: 'payments/patient/:id',
      // Resolves while logged out (ResetPassword lives in AuthStack). Query
      // params `?token=…&email=…` map onto the screen's route params.
      ResetPassword: 'reset-password',
    },
  },
}

export default function Navigation() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const currentUserQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getCurrentUser,
    enabled: isAuthenticated,
    retry: false,
    staleTime: 60_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  })

  React.useEffect(() => {
    if (isAuthenticated && currentUserQuery.data) {
      setUser(currentUserQuery.data)
    }
  }, [currentUserQuery.data, isAuthenticated, setUser])

  return (
    <NavigationContainer linking={linking}>
      {isAuthenticated ? (
        mustRotatePassword(user) ? <PasswordRotationNavigator /> : <MainNavigator />
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
