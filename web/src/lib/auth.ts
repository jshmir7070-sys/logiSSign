import { createServerSupabaseClient } from './supabase'
import { redirect } from 'next/navigation'

export type UserRole = 'provider_admin' | 'agency_admin' | 'driver'

interface SessionUser {
  id: string
  email: string
  role: UserRole
  agencyId?: string
}

/**
 * 서버 컴포넌트에서 현재 인증 계정 가져오기
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) return null

  const role = (user.app_metadata?.role as UserRole) ?? 'driver'
  const agencyId = user.app_metadata?.agency_id as string | undefined

  return {
    id: user.id,
    email: user.email ?? '',
    role,
    agencyId,
  }
}

/**
 * 관리자 전용 페이지 보호
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user || user.role !== 'provider_admin') {
    redirect('/login')
  }
  return user
}

/**
 * 대리점 관리자 전용 페이지 보호
 */
export async function requireAgencyAdmin(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user || user.role !== 'agency_admin') {
    redirect('/login')
  }
  return user
}
