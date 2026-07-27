/**
 * setupFilesAfterEach — runs after every test file's environment is built.
 * Adds the testing-library matchers to expect() and resets the global
 * mocks between tests.
 */
require('@testing-library/jest-native/extend-expect')

// React Query batches observer notifications on a timer. Route those
// callbacks through React Native Testing Library's act() so screen tests
// observe the same committed state without leaking act warnings.
const { act } = require('@testing-library/react-native')
const { notifyManager, timeoutManager } = require('@tanstack/react-query')
notifyManager.setNotifyFunction((callback) => {
  act(callback)
})

// Query cache GC uses five-minute timers by default. In Node those timers
// keep Jest alive after the rendered tree has already been cleaned up. Keep
// their runtime behavior, but unref native Node timers so a clean suite can
// exit naturally without forceExit.
const unrefTimer = (timer) => {
  if (timer && typeof timer.unref === 'function') timer.unref()
  return timer
}
timeoutManager.setTimeoutProvider({
  setTimeout: (callback, delay) => unrefTimer(setTimeout(callback, delay)),
  clearTimeout: (timer) => clearTimeout(timer),
  setInterval: (callback, delay) => unrefTimer(setInterval(callback, delay)),
  clearInterval: (timer) => clearInterval(timer),
})
