import {
  canView,
  canManage,
  canExportData,
  isSubscriptionReadOnly,
  mustRotatePassword,
  toggleAssistantPermission,
  DEFAULT_ASSISTANT_PERMISSIONS,
} from '../permissions'
import type { ApiUser } from '../../types'

const dentist: ApiUser = {
  id: '1',
  name: 'Dr Demo',
  email: 'dentist@test',
  role: 'dentist',
  account_status: 'active',
}
const admin: ApiUser = { ...dentist, id: '2', role: 'admin' }
const assistant = (perms: string[]): ApiUser => ({
  ...dentist,
  id: '3',
  role: 'assistant',
  assistant_permissions: perms,
})

const readOnly = (base: ApiUser): ApiUser => ({
  ...base,
  subscription: {
    is_configured: true,
    plan: 'trial',
    status: 'read_only',
    access_mode: 'read_only',
    days_remaining: 0,
    staff_limit: 1,
    active_staff_count: 1,
  },
})

const blocked = (base: ApiUser): ApiUser => ({ ...base, account_status: 'blocked' })

describe('canView', () => {
  it('returns false for null user', () => {
    expect(canView(null, 'patients')).toBe(false)
  })

  it('grants every module to dentists', () => {
    expect(canView(dentist, 'patients')).toBe(true)
    expect(canView(dentist, 'appointments')).toBe(true)
    expect(canView(dentist, 'payments')).toBe(true)
  })

  it('grants every module to admins', () => {
    expect(canView(admin, 'patients')).toBe(true)
  })

  it('requires explicit assistant permission', () => {
    const a = assistant(['patients.view'])
    expect(canView(a, 'patients')).toBe(true)
    expect(canView(a, 'appointments')).toBe(false)
  })

  it('treats manage as implying view (permission ladder)', () => {
    const a = assistant(['patients.manage'])
    expect(canView(a, 'patients')).toBe(true)
  })
})

describe('canManage', () => {
  it('grants management to dentists', () => {
    expect(canManage(dentist, 'patients')).toBe(true)
  })

  it('denies management when subscription is read-only — even to dentists', () => {
    expect(canManage(readOnly(dentist), 'patients')).toBe(false)
  })

  it('requires .manage on the specific module for assistants', () => {
    const a = assistant(['patients.view', 'appointments.manage'])
    expect(canManage(a, 'patients')).toBe(false) // only view
    expect(canManage(a, 'appointments')).toBe(true)
    expect(canManage(a, 'payments')).toBe(false)
  })

  it('denies anyone (assistant) under read-only subscription', () => {
    const a = readOnly(assistant(['patients.manage']))
    expect(canManage(a, 'patients')).toBe(false)
  })

  it('exempts admins from read-only (admins can still manage)', () => {
    expect(canManage(readOnly(admin), 'patients')).toBe(true)
  })
})

describe('account status gate (web parity)', () => {
  it('denies view and manage for a non-active account', () => {
    expect(canView(blocked(dentist), 'patients')).toBe(false)
    expect(canManage(blocked(dentist), 'patients')).toBe(false)
    expect(canView(blocked(assistant(['patients.view'])), 'patients')).toBe(false)
  })
})

describe('isSubscriptionReadOnly', () => {
  it('returns false for no subscription', () => {
    expect(isSubscriptionReadOnly(dentist)).toBe(false)
  })
  it('returns true when access_mode is read_only', () => {
    expect(isSubscriptionReadOnly(readOnly(dentist))).toBe(true)
  })
  it('exempts admins (never read-only) — matches web', () => {
    expect(isSubscriptionReadOnly(readOnly(admin))).toBe(false)
  })
  it('honors the is_read_only flag even when access_mode is full', () => {
    const u: ApiUser = {
      ...dentist,
      subscription: {
        is_configured: true,
        plan: 'basic',
        status: 'active',
        access_mode: 'full',
        days_remaining: 5,
        staff_limit: 3,
        active_staff_count: 1,
        is_read_only: true,
      },
    }
    expect(isSubscriptionReadOnly(u)).toBe(true)
  })
})

describe('canExportData', () => {
  it('fails closed when the subscription feature flag is missing', () => {
    expect(canExportData(dentist)).toBe(false)
  })

  it('allows an explicit plan grant', () => {
    expect(canExportData({
      ...dentist,
      subscription: {
        is_configured: true,
        plan: 'pro',
        status: 'active',
        access_mode: 'full',
        days_remaining: 20,
        staff_limit: 5,
        active_staff_count: 1,
        can_export: true,
      },
    })).toBe(true)
  })

  it('keeps administrators exempt from subscription feature flags', () => {
    expect(canExportData(admin)).toBe(true)
  })
})

describe('mustRotatePassword', () => {
  it('locks an active account flagged by the backend', () => {
    expect(mustRotatePassword({ ...assistant([]), must_change_password: true })).toBe(true)
  })

  it('does not lock ordinary or inactive accounts', () => {
    expect(mustRotatePassword(dentist)).toBe(false)
    expect(mustRotatePassword({ ...blocked(dentist), must_change_password: true })).toBe(false)
    expect(mustRotatePassword(null)).toBe(false)
  })
})

describe('assistant permission form parity', () => {
  it('starts new assistants with no access until the owner grants it', () => {
    expect(DEFAULT_ASSISTANT_PERMISSIONS).toEqual([])
  })

  it('adds the required view permission when manage is enabled', () => {
    expect(toggleAssistantPermission([], 'patients.manage')).toEqual([
      'patients.view',
      'patients.manage',
    ])
  })

  it('removes manage when its view permission is disabled', () => {
    expect(toggleAssistantPermission(
      ['patients.view', 'patients.manage', 'payments.view'],
      'patients.view'
    )).toEqual(['payments.view'])
  })
})
