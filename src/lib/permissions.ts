import type { ApiUser } from '../types'

export type PermissionModule = 'patients' | 'appointments' | 'payments'
export type PermissionAction = 'view' | 'manage'

// Mirrors web `lib/auth/permissions.ts`.
// - Dentist & admin: full access (subject to subscription).
// - Assistant: granular `assistant_permissions` array like ['patients.view', ...].
// - Subscription `read_only` access mode forbids manage actions even for dentists.

export function isSubscriptionReadOnly(user: ApiUser | null): boolean {
  return user?.subscription?.access_mode === 'read_only'
}

function hasAssistantPermission(user: ApiUser, module: PermissionModule, action: PermissionAction): boolean {
  const perms = user.assistant_permissions ?? []
  if (perms.includes(`${module}.${action}`)) return true
  // Manage implies view
  if (action === 'view' && perms.includes(`${module}.manage`)) return true
  return false
}

export function canView(user: ApiUser | null, module: PermissionModule): boolean {
  if (!user) return false
  if (user.role === 'admin' || user.role === 'dentist') return true
  if (user.role === 'assistant') return hasAssistantPermission(user, module, 'view')
  return false
}

export function canManage(user: ApiUser | null, module: PermissionModule): boolean {
  if (!user) return false
  if (isSubscriptionReadOnly(user)) return false
  if (user.role === 'admin' || user.role === 'dentist') return true
  if (user.role === 'assistant') return hasAssistantPermission(user, module, 'manage')
  return false
}
