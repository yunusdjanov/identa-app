/**
 * setupFiles — runs BEFORE the test framework is installed. Use for global
 * mocks of native modules so any test file (or module under test) that
 * imports them at the top gets the mock automatically.
 */

// Force the "real backend" code path in every API slice that has a mock
// fork. Tests intercept axios with MockAdapter, so the actual network
// requests never escape — but the slice has to reach axios in the first
// place. Setting these here (before module load) wins over per-test
// `process.env` overrides which would otherwise lose the race.
process.env.EXPO_PUBLIC_USE_MOCK_API = 'false'
process.env.EXPO_PUBLIC_MOCK_AUTH = 'false'
process.env.EXPO_PUBLIC_MOCK_PATIENTS = 'false'
process.env.EXPO_PUBLIC_MOCK_APPOINTMENTS = 'false'
process.env.EXPO_PUBLIC_MOCK_DASHBOARD = 'false'
process.env.EXPO_PUBLIC_MOCK_TREATMENTS = 'false'
process.env.EXPO_PUBLIC_MOCK_PROFILE = 'false'
process.env.EXPO_PUBLIC_MOCK_TEAM = 'false'

/**
 * Native module mocks below.
 *
 * Why mock these:
 *   - expo-secure-store / async-storage: backed by native modules; tests
 *     run in pure-JS and would throw "Cannot find native module" on import.
 *   - expo-haptics: noop in tests so we don't trigger phantom feedback.
 *   - expo-constants: returns minimal config so code that reads release
 *     channel / runtime version doesn't blow up.
 *   - expo-image-picker / file-system: surface-level mocks so callers
 *     don't crash; integration tests can override these per-test.
 *   - sentry: pass-through so capture/breadcrumb calls don't error.
 */

// SecureStore — back with an in-memory map so test code that round-trips
// via getItem/setItem behaves like a real store.
jest.mock('expo-secure-store', () => {
  const store = new Map()
  return {
    getItemAsync: jest.fn((k) => Promise.resolve(store.get(k) ?? null)),
    setItemAsync: jest.fn((k, v) => {
      store.set(k, v)
      return Promise.resolve()
    }),
    deleteItemAsync: jest.fn((k) => {
      store.delete(k)
      return Promise.resolve()
    }),
  }
})

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}))

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}))

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      version: '1.0.0',
      runtimeVersion: '1.0.0',
    },
  },
  expoConfig: {
    version: '1.0.0',
    runtimeVersion: '1.0.0',
  },
}))

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  launchCameraAsync: jest.fn(() => Promise.resolve({ canceled: true })),
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ canceled: true })),
}))

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: false })),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ granted: false })),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('id')),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ data: 'mock-token' })),
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
}))

jest.mock('expo-device', () => ({
  isDevice: true,
  deviceName: 'Test Device',
  osName: 'iOS',
  osVersion: '17.0',
}))

jest.mock('expo-updates', () => ({
  isEnabled: false,
  checkForUpdateAsync: jest.fn(() => Promise.resolve({ isAvailable: false })),
  fetchUpdateAsync: jest.fn(() => Promise.resolve({ isNew: false })),
  reloadAsync: jest.fn(),
}))

// @sentry/react-native — bare passthrough so logging code doesn't throw
// in tests. wrap() returns the component identity.
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: (Component) => Component,
  setUser: jest.fn(),
  setTag: jest.fn(),
  setExtra: jest.fn(),
  setContext: jest.fn(),
  withScope: jest.fn((cb) => cb({ setExtra: jest.fn(), setTag: jest.fn() })),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
}))

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => () => {}),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
}))

// @expo/vector-icons pulls in expo-font → expo-asset (not present in tests).
// Provide a simple Text-rendering substitute so components that show icons
// still render predictably. Tests that care about an icon's name can match
// the accessibilityLabel set on the icon.
jest.mock('@expo/vector-icons/Ionicons', () => {
  const React = require('react')
  const { Text } = require('react-native')
  function MockIonicons(props) {
    return React.createElement(Text, { accessibilityLabel: `icon-${props.name}` }, '')
  }
  MockIonicons.displayName = 'Ionicons'
  return MockIonicons
})

// expo-linear-gradient renders a fixed-size view; React Native's Animated +
// the native renderer aren't available in JSDOM, so substitute a plain View.
jest.mock('expo-linear-gradient', () => {
  const React = require('react')
  const { View } = require('react-native')
  function MockLinearGradient(props) {
    return React.createElement(View, props, props.children)
  }
  return { LinearGradient: MockLinearGradient }
})

// Silence the noisy "Animated: useNativeDriver is not supported" warnings
// that appear when components animate during render tests.
const realConsoleWarn = console.warn
console.warn = (...args) => {
  const msg = typeof args[0] === 'string' ? args[0] : ''
  if (msg.includes('useNativeDriver')) return
  if (msg.includes('VirtualizedLists should never be nested')) return
  realConsoleWarn(...args)
}
