// Sanity check — verifies the test runner + jest-expo preset are wired.
// If this fails, no other test in the suite can run.

describe('test runner', () => {
  it('arithmetic still works', () => {
    expect(1 + 1).toBe(2)
  })

  it('expo-constants mock returns a default version', () => {
    const Constants = require('expo-constants').default
    expect(Constants.expoConfig?.version).toBe('1.0.0')
  })
})
