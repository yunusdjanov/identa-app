import { shouldUseMockApi } from '../mockApi'

describe('shouldUseMockApi', () => {
  it('uses the real API when flags are absent', () => {
    expect(shouldUseMockApi(undefined, undefined)).toBe(false)
  })

  it('enables all mocks only when the master flag is explicitly true', () => {
    expect(shouldUseMockApi(undefined, 'true')).toBe(true)
  })

  it('allows a resource to opt in while the master flag is off', () => {
    expect(shouldUseMockApi('true', 'false')).toBe(true)
  })

  it('allows a resource to opt out while the master flag is on', () => {
    expect(shouldUseMockApi('false', 'true')).toBe(false)
  })
})
