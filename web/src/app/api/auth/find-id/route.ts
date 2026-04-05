/**
 * 아이디(이메일) 찾기 API
 *
 * Step 1 — SMS 인증번호 발송:
 *   POST { action: "send", name, phone }
 *   → agencies에서 owner_name + phone 매칭 → SMS 6자리 인증번호 발송
 *
 * Step 2 — 인증 확인 + 마스킹 이메일 반환:
 *   POST { action: "verify", name, phone, code }
 *   → 인증번호 검증 → 마스킹된 이메일 반환 (예: jsh***77@naver.com)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { rateLimitPublic } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/get-ip'
import { sendSms } from '@/services/sms.service'

/* ── 인증번호 저장소 (메모리 기반, 5분 TTL) ── */
interface VerifyEntry {
  code: string
  expiresAt: number
  attempts: number
  email: string        // 검증 성공 시 반환할 이메일
}

const verifyStore = new Map<string, VerifyEntry>()

// 만료 엔트리 정리 (5분마다)
setInterval(() => {
  const now = Date.now()
  Array.from(verifyStore.entries()).forEach(([key, entry]) => {
    if (entry.expiresAt <= now) verifyStore.delete(key)
  })
}, 5 * 60_000)

/** 이메일 마스킹: jshmir77@naver.com → jsh***77@naver.com */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain || local.length <= 3) return `${local[0]}***@${domain}`
  const prefix = local.slice(0, 3)
  const suffix = local.slice(-2)
  return `${prefix}***${suffix}@${domain}`
}

/** 전화번호 정규화 */
function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '')
}

export async function POST(request: NextRequest) {
  // Rate limit
  const ip = getClientIp(request)
  const limited = rateLimitPublic(ip, 'find-id')
  if (limited) return limited

  try {
    const body = await request.json()
    const { action, name, phone, code } = body as {
      action: 'send' | 'verify'
      name?: string
      phone?: string
      code?: string
    }

    if (!name?.trim() || !phone?.trim()) {
      return NextResponse.json({ error: '이름과 휴대폰 번호를 입력해주세요.' }, { status: 400 })
    }

    const normalizedPhone = normalizePhone(phone)
    const storeKey = `find-id:${name.trim()}:${normalizedPhone}`

    const supabase = createAdminSupabaseClient()

    // agencies 테이블에서 owner_name + phone 매칭 조회
    const { data: agency, error: dbErr } = await supabase
      .from('agencies')
      .select('id, email')
      .eq('owner_name', name.trim())
      .eq('phone', normalizedPhone)
      .maybeSingle()

    if (dbErr || !agency) {
      // ✅ 보안: 타이밍 공격 방지 — 사용자 미존재 시에도 일정 지연 후 응답
      await new Promise(r => setTimeout(r, 200 + Math.random() * 300))
      return NextResponse.json(
        { error: '입력한 정보와 일치하는 계정을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (action === 'send') {
      // ── Step 1: 인증번호 발송 ──
      const verifyCode = String(Math.floor(100000 + Math.random() * 900000)) // 6자리
      const TTL = 5 * 60_000 // 5분

      verifyStore.set(storeKey, {
        code: verifyCode,
        expiresAt: Date.now() + TTL,
        attempts: 0,
        email: agency.email,
      })

      // SMS 발송
      const smsResult = await sendSms({
        to: normalizedPhone,
        text: `[logiSSign] 아이디 찾기 인증번호: ${verifyCode} (5분 내 입력)`,
      })

      if (!smsResult.sent) {
        return NextResponse.json(
          { error: 'SMS 발송에 실패했습니다. 잠시 후 다시 시도해주세요.' },
          { status: 500 }
        )
      }

      return NextResponse.json({ sent: true, expiresIn: 300 })

    } else if (action === 'verify') {
      // ── Step 2: 인증번호 확인 ──
      if (!code?.trim()) {
        return NextResponse.json({ error: '인증번호를 입력해주세요.' }, { status: 400 })
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

      // 인증 성공 → 마스킹 이메일 반환
      const maskedEmail = maskEmail(entry.email)
      verifyStore.delete(storeKey)

      return NextResponse.json({ verified: true, email: maskedEmail })

    } else {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
