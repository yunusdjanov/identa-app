/**
 * Jest configuration for the Identa mobile app.
 *
 * We use the `jest-expo` preset which understands Expo SDK 54's bundling
 * quirks (Hermes, Metro transformer paths, native module shims) and the
 * react-native testing library matchers via setupFilesAfterEach.
 *
 * The transformIgnorePatterns whitelist is the *only* place tests reach into
 * node_modules — Expo + React Native ship ES modules that need transpilation
 * (Jest can't `require()` them as-is). Anything new added here should mirror
 * the import graph: if a test fails with "Unexpected token 'export'", the
 * culprit module needs to be added.
 */
module.exports = {
  preset: 'jest-expo',
  // setupFiles runs BEFORE the test framework is installed (good for mocking
  // native modules that the modules under test import at the top).
  setupFiles: ['<rootDir>/jest.setup-mocks.js'],
  // setupFilesAfterEnv runs AFTER the framework is installed (so expect()
  // exists and we can extend it with the testing-library matchers).
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/.maestro/', '/android/', '/ios/'],
  // RN modules with ESM exports — must be transformed instead of bypassed.
  // Order matters: more-specific paths first so they aren't eaten by the
  // broader wildcards below.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo|expo-.*|@expo/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/.*|sentry-expo|native-base|react-native-svg|react-native-worklets|@tanstack/.*|zustand|axios)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
    // Mock-only modules ship dev fixtures, not production logic.
    '!src/**/mock*.ts',
    // Screens are covered by Maestro E2E (.maestro/flows/*.yaml), not Jest.
    // They're 200-500 line composition layers around the underlying lib /
    // store / component code that IS unit-tested; running them through
    // Jest's renderer would require mocking React Navigation + React Query +
    // every connected native module for marginal incremental confidence.
    '!src/screens/**',
    '!src/navigation/**',
    // Test scaffolding doesn't need to be self-covered.
    '!src/test-utils/**',
    // Type-only files emit no runtime code.
    '!src/types/**',
  ],
  // v1 coverage strategy:
  //   - Global floors are intentionally low because screens + ~30 untested
  //     components still drag the average down. We DO want to see those
  //     un-covered files in the report (no exclusion), so we can prioritise
  //     them as the suite matures, but they shouldn't fail CI today.
  //   - Per-directory floors guard the LAYERS we already unit-test
  //     thoroughly — drops there indicate a regression.
  //   - Maestro E2E (.maestro/flows/) covers the screen+navigation surface
  //     that Jest doesn't.
  // Bump these incrementally as new tests land.
  coverageThreshold: {
    global: {
      branches: 8,
      functions: 8,
      lines: 9,
      statements: 9,
    },
    './src/stores/': {
      branches: 85,
      functions: 80,
      lines: 95,
      statements: 95,
    },
    './src/api/client.ts': {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  // Jest can hang on lingering setTimeout/setInterval from RN polyfills if we
  // don't force-exit. Keeps CI from running over.
  forceExit: true,
}
