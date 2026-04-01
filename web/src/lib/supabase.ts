import { createBrowserClient, createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

// Browser client (client components)
// 제네릭 타입 제거 — Supabase SSR v0.9 + JS v2 호환 이슈로 인해
// insert/update에서 never 추론 발생. 서비스 레이어에서 결과 타입만 캐스팅.
export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Server client (server components — 쿠키 기반 세션 읽기)
// next/headers의 cookies()를 통해 Supabase 세션 JWT를 전달하여
// RLS 정책이 auth.jwt()를 올바르게 참조할 수 있도록 한다.
// ⚠️ next/headers는 dynamic import — top-level로 두면 client component 번들에 포함되어 에러
export async function createServerSupabaseClient() {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component에서는 set 불가 — 무시
            // middleware에서 세션 갱신 처리
          }
        },
      },
    }
  )
}

// Admin client (Edge Functions, service role — RLS 우회)
export function createAdminSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
