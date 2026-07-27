import type { ApiUser } from '../types'

export type PermissionModule = 'patients' | 'appointments' | 'payments'
export type PermissionAction = 'view' | 'manage'

export const STAFF_PERMISSION_CODES = [
  'patients.view',
  'patients.manage',
  'appointments.view',
  'appointments.manage',
  'payments.view',
  'payments.manage',
] as const

export type StaffPermission = (typeof STAFF_PERMISSION_CODES)[number]
export const DEFAULT_ASSISTANT_PERMISSIONS: StaffPermission[] = []

const MANAGE_TO_VIEW: Partial<Record<StaffPermission, StaffPermission>> = {
  'patients.manage': 'patients.view',
  'appointments.manage': 'appointments.view',
  'payments.manage': 'payments.view',
}

const VIEW_TO_MANAGE: Partial<Record<StaffPermission, StaffPermission>> = {
  'patients.view': 'patients.manage',
  'appointments.view': 'appointments.manage',
  'payments.view': 'payments.manage',
}

// Mirrors web `lib/auth/permissions.ts`.
// - Dentist & admin: full access (subject to subscription + account status).
// - Assistant: granular `assistant_permissions` array like ['patients.view', ...].
// - Subscription read-only forbids manage actions even for dentists; ADMINS are
//   exempt (they never have a billable subscription) — matches web.
// - A non-active account (blocked / soft-deleted) shows NO affordances.

export function isSubscriptionReadOnly(user: ApiUser | null): boolean {
  // Admins are never read-only (web parity). Check both the explicit
  // `is_read_only` flag and the `access_mode` enum so editing locks correctly
  // regardless of which one the backend populates for the mobile payload.
  if (user?.role === 'admin') return false
  const sub = user?.subscription
  return sub?.is_read_only === true || sub?.access_mode === 'read_only'
}

// A blocked/soft-deleted account (e.g. an assistant whose owner was blocked, or
// a stale cached session) must not advertise view/manage actions. Backend
// mutations stay guarded regardless; this keeps the UI honest. Matches web's
// `hasPermission` account-status gate.
function isAccountUsable(user: ApiUser): boolean {
  return user.account_status === 'active'
}

function hasAssistantPermission(user: ApiUser, module: PermissionModule, action: PermissionAction): boolean {
  const perms = user.assistant_permissions ?? []
  if (perms.includes(`${module}.${action}`)) return true
  // Manage implies view
  if (action === 'view' && perms.includes(`${module}.manage`)) return true
  return false
}

export function canView(user: ApiUser | null, module: PermissionModule): boolean {
  if (!user || !isAccountUsable(user)) return false
  if (user.role === 'admin' || user.role === 'dentist') return true
  if (user.role === 'assistant') return hasAssistantPermission(user, module, 'view')
  return false
}

export function canManage(user: ApiUser | null, module: PermissionModule): boolean {
  if (!user || !isAccountUsable(user)) return false
  if (isSubscriptionReadOnly(user)) return false
  if (user.role === 'admin' || user.role === 'dentist') return true
  if (user.role === 'assistant') return hasAssistantPermission(user, module, 'manage')
  return false
}

/** Mirrors the web shell's forced password-rotation navigation lock. */
export function mustRotatePassword(user: ApiUser | null): boolean {
  return user?.account_status === 'active' && user.must_change_password === true
}

/** Keeps assistant view/manage dependencies identical to the web form. */
export function toggleAssistantPermission(
  current: readonly string[],
  permission: StaffPermission
): StaffPermission[] {
  const selected = new Set<StaffPermission>(
    current.filter((value): value is StaffPermission =>
      (STAFF_PERMISSION_CODES as readonly string[]).includes(value)
    )
  )

  if (selected.has(permission)) {
    selected.delete(permission)
    const dependentManage = VIEW_TO_MANAGE[permission]
    if (dependentManage) selected.delete(dependentManage)
  } else {
    selected.add(permission)
    const requiredView = MANAGE_TO_VIEW[permission]
    if (requiredView) selected.add(requiredView)
  }

  return STAFF_PERMISSION_CODES.filter((code) => selected.has(code))
}

/**
 * Export is generated entirely on-device, so it must fail closed when the
 * server subscription summary does not explicitly grant the feature.
 */
export function canExportData(user: ApiUser | null): boolean {
  if (!user || !isAccountUsable(user)) return false
  if (user.role === 'admin') return true
  return user.subscription?.can_export === true
}

// Analytics aggregates patients/appointments/payments — visible if ANY of those
// view permissions is granted (dentist/admin always pass). Mirrors web.
export function canViewAnalytics(user: ApiUser | null): boolean {
  return canView(user, 'patients') || canView(user, 'appointments') || canView(user, 'payments')
}
