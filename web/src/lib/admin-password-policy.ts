type AdminLikeUser = {
  app_metadata?: Record<string, unknown> | null
  user_metadata?: Record<string, unknown> | null
}

export const DEFAULT_ADMIN_PASSWORD = '123456'

export function isDefaultAdminPassword(password: string): boolean {
  return password.trim() === DEFAULT_ADMIN_PASSWORD
}

export function requiresAdminPasswordSetup(user: AdminLikeUser | null | undefined): boolean {
  if (!user) return false

  const role = typeof user.app_metadata?.role === 'string' ? user.app_metadata.role : ''
  if (role !== 'provider_admin') return false

  const mustChangePassword = user.user_metadata?.must_change_password === true
  const passwordChangedAt = user.user_metadata?.password_changed_at

  return mustChangePassword || !passwordChangedAt
}
