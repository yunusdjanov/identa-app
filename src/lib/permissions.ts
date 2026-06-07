import type { ApiUser } from '../types'

export type PermissionModule = 'patients' | 'appointments' | 'payments'
export type PermissionAction = 'view' | 'manage'

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

// Analytics aggregates patients/appointments/payments — visible if ANY of those
// view permissions is granted (dentist/admin always pass). Mirrors web.
export function canViewAnalytics(user: ApiUser | null): boolean {
  return canView(user, 'patients') || canView(user, 'appointments') || canView(user, 'payments')
}
