/**
 * setupFilesAfterEach — runs after every test file's environment is built.
 * Adds the testing-library matchers to expect() and resets the global
 * mocks between tests.
 */
require('@testing-library/jest-native/extend-expect')
