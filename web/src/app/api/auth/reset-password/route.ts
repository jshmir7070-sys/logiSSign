/**
 * 비밀번호 초기화 API
 *
 * Step 1 — SMS 인증번호 발송:
 *   POST { action: "send", email, name, phone }
 *   → agencies에서 email + owner_name + phone 매칭 → SMS 6자리 인증번호 발송
 *
 * Step 2 — 인증 확인 + 비밀번호 변경:
 *   POST { action: "reset", email, name, phone, code, newPassword }
 *   → 인증번호 검증 → Supabase Admin API로 비밀번호 변경
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { rateLimitPublic } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/get-ip'
import { sendSms } from '@/services/sms.service'

/* ── 인증번호 저장소 ── */
interface VerifyEntry {
  code: string
  expiresAt: number
  attempts: number
  userId: string       // Supabase Auth user ID
}

const verifyStore = new Map<string, VerifyEntry>()

setInterval(() => {
  const now = Date.now()
  Array.from(verifyStore.entries()).forEach(([key, entry]) => {
    if (entry.expiresAt <= now) verifyStore.delete(key)
  })
}, 5 * 60_000)

function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '')
}

/** 비밀번호 유효성 검사: 8자 이상, 대소문자+숫자+특수문자 */
function validatePassword(pw: string): string | null {
  if (pw.length < 8) return '비밀번호는 8자 이상이어야 합니다.'
  if (!/[a-z]/.test(pw)) return '소문자를 포함해야 합니다.'
  if (!/[A-Z]/.test(pw)) return '대문자를 포함해야 합니다.'
  if (!/[0-9]/.test(pw)) return '숫자를 포함해야 합니다.'
  if (!/[^a-zA-Z0-9]/.test(pw)) return '특수문자를 포함해야 합니다.'
  return null
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = rateLimitPublic(ip, 'reset-password')
  if (limited) return limited

  try {
    const body = await request.json()
    const { action, email, name, phone, code, newPassword } = body as {
      action: 'send' | 'reset'
      email?: string
      name?: string
      phone?: string
      code?: string
      newPassword?: string
    }

    if (!email?.trim() || !name?.trim() || !phone?.trim()) {
      return NextResponse.json({ error: '이메일, 이름, 휴대폰 번호를 모두 입력해주세요.' }, { status: 400 })
    }

    const normalizedPhone = normalizePhone(phone)
    const storeKey = `reset-pw:${email.trim().toLowerCase()}:${normalizedPhone}`

    const supabase = createAdminSupabaseClient()

    // agencies에서 email + owner_name + phone 매칭 조회
    const { data: agency, error: dbErr } = await supabase
      .from('agencies')
      .select('id, email')
      .eq('email', email.trim().toLowerCase())
      .eq('owner_name', name.trim())
      .eq('phone', normalizedPhone)
      .maybeSingle()

    if (dbErr || !agency) {
      return NextResponse.json(
        { error: '입력한 정보와 일치하는 계정을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // agency_id로 auth user 조회
    const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    const authUser = authUsers?.users.find(
      (u) => u.app_metadata?.agency_id === agency.id && u.email === email.trim().toLowerCase()
    )

    if (!authUser) {
      return NextResponse.json(
        { error: '인증 계정을 찾을 수 없습니다. 관리자에게 문의하세요.' },
        { status: 404 }
      )
    }

    if (action === 'send') {
      // ── Step 1: 인증번호 발송 ──
      const verifyCode = String(Math.floor(100000 + Math.random() * 900000))
      const TTL = 5 * 60_000

      verifyStore.set(storeKey, {
        code: verifyCode,
        expiresAt: Date.now() + TTL,
        attempts: 0,
        userId: authUser.id,
      })

      const smsResult = await sendSms({
        to: normalizedPhone,
        text: `[logiSSign] 비밀번호 초기화 인증번호: ${verifyCode} (5분 내 입력)`,
      })

      if (!smsResult.sent) {
        return NextResponse.json(
          { error: 'SMS 발송에 실패했습니다. 잠시 후 다시 시도해주세요.' },
          { status: 500 }
        )
      }

      return NextResponse.json({ sent: true, expiresIn: 300 })

    } else if (action === 'reset') {
      // ── Step 2: 인증 확인 + 비밀번호 변경 ──
      if (!code?.trim()) {
        return NextResponse.json({ error: '인증번호를 입력해주세요.' }, { status: 400 })
      }
      if (!newPassword) {
        return NextResponse.json({ error: '새 비밀번호를 입력해주세요.' }, { status: 400 })
      }

      const pwError = validatePassword(newPassword)
      if (pwError) {
        return NextResponse.json({ error: pwError }, { status: 400 })
      }

      const entry = verifyStore.get(storeKey)
      if (!entry) {
        return NextResponse.json({ error: '인증번호가 만료되었습니다. 다시 요청해주세요.' }, { status: 400 })
      }

      if (entry.expiresAt <= Date.now()) {
        verifyStore.delete(storeKey)
        return NextResponse.json({ error: '인증번호가 만료되었습니다. 다시 요청해주세요.' }, { status: 400 })
      }

      entry.attempts++
      if (entry.attempts > 5) {
        verifyStore.delete(storeKey)
        return NextResponse.json({ error: '인증 시도 횟수를 초과했습니다. 다시 요청해주세요.' }, { status: 429 })
      }

      if (entry.code !== code.trim()) {
        return NextResponse.json(
          { error: `인증번호가 일치하지 않습니다. (${5 - entry.attempts}회 남음)` },
          { status: 400 }
        )
      }

      // 인증 성공 → 비밀번호 변경
      const { error: updateErr } = await supabase.auth.admin.updateUserById(entry.userId, {
        password: newPassword,
      })

      verifyStore.delete(storeKey)

      if (updateErr) {
        return NextResponse.json(
          { error: '비밀번호 변경에 실패했습니다. 관리자에게 문의하세요.' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true })

    } else {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
