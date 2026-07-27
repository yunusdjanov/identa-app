import { validatePassword } from '../validation'

describe('validatePassword', () => {
  it('validates the exact submitted value without trimming it', () => {
    expect(validatePassword('abcdefg1', { required: true })).toBeNull()
    expect(validatePassword(' abcdef1', { required: true })).toBeNull()
    expect(validatePassword('abcdef1 ', { required: true })).toBeNull()
  })

  it('does not treat whitespace-only input as a missing password', () => {
    expect(validatePassword('        ', { required: true })).toBe('passwordLetterNumber')
  })
})
