import { getClientIp } from '@/lib/get-ip'
import { rateLimitPublic } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { validateInput } from '@/lib/api-schemas'
import { apiError } from '@/lib/api-error'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/** 6자리 영문대문자+숫자 초대코드 생성 (예: A3X7K9) */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 혼동 문자 제외 (0/O, 1/I)
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

const signupSchema = z.object({
  email: z.email(),
  password: z.string()
    .min(8, '비밀번호는 8자 이상')
    .regex(/[a-z]/, '소문자 포함 필요')
    .regex(/[A-Z]/, '대문자 포함 필요')
    .regex(/[0-9]/, '숫자 포함 필요')
    .regex(/[^a-zA-Z0-9]/, '특수문자 포함 필요'),
  companyName: z.string().min(1, '회사명은 필수'),
  ownerName: z.string().min(1, '대표자명은 필수'),
  businessNumber: z.string()
    .max(12, '사업자등록번호는 12자 이내')
    .regex(/^\d{3}-?\d{2}-?\d{5}$/, '사업자등록번호 형식이 올바르지 않습니다')
    .optional(),
  ownerBirthDate: z.string().max(10).optional(),
  phone: z.string()
    .max(13, '전화번호는 13자 이내')
    .regex(/^01[0-9]-?\d{3,4}-?\d{4}$/, '유효한 전화번호 형식이 아닙니다')
    .optional(),
  address: z.string().max(200).optional(),
  addressDetail: z.string().max(100).optional(),
  businessType: z.string().max(50).optional(),
  businessCategory: z.string().max(50).optional(),
  bankName: z.string().max(20).optional(),
  bankAccount: z.string()
    .max(20, '계좌번호는 20자 이내')
    .regex(/^[\d-]{8,20}$/, '계좌번호 형식이 올바르지 않습니다')
    .optional(),
  bankHolder: z.string().max(30).optional(),
  plan: z.enum(['free', 'basic', 'standard', 'enterprise']).default('free'),
  billing: z.enum(['monthly', '1year', '2year', '3year']).optional().default('monthly'),
})

/**
 * POST /api/auth/signup
 * 서버에서 역할(role)을 강제 설정하는 회원가입 엔드포인트
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = rateLimitPublic(ip, '/api/auth/signup')
  if (limited) return limited

  try {
    const body = await request.json()
    const { data: validated, error: validationError } = validateInput(signupSchema, body)
    if (validationError || !validated) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    // 사업자번호 중복 체크
    if (validated.businessNumber) {
      const { data: existing } = await supabaseAdmin
        .from('agencies')
        .select('id')
        .eq('business_number', validated.businessNumber)
        .maybeSingle()

      if (existing) {
        return NextResponse.json({ error: '이미 등록된 사업자번호입니다' }, { status: 409 })
      }
    }

    // 1. Supabase Auth 계정 생성 — role은 서버에서 강제 설정
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: validated.email,
      password: validated.password,
      email_confirm: true,
      user_metadata: {
        role: 'agency_admin', // 서버에서 강제 — 클라이언트 조작 불가
        company_name: validated.companyName,
        owner_name: validated.ownerName,
        plan: validated.plan,
      },
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const userId = authData.user?.id
    if (!userId) {
      return NextResponse.json({ error: '계정 생성 실패' }, { status: 500 })
    }

    // 2. agencies 테이블 생성 (초대코드 자동 생성 포함)
    const inviteCode = generateInviteCode()
    const { data: agencyData, error: agencyError } = await supabaseAdmin
      .from('agencies')
      .insert({
        name: validated.companyName,
        business_number: validated.businessNumber ?? null,
        owner_name: validated.ownerName,
        owner_birth_date: validated.ownerBirthDate ?? null,
        phone: validated.phone ?? null,
        email: validated.email,
        address: validated.address ?? null,
        address_detail: validated.addressDetail ?? null,
        business_type: validated.businessType ?? null,
        business_category: validated.businessCategory ?? null,
        bank_name: validated.bankName ?? null,
        bank_account: validated.bankAccount ?? null,
        bank_holder: validated.bankHolder ?? null,
        plan: validated.plan,
        status: 'active',
        invite_code: inviteCode,
      } as never)
      .select('id')
      .single()

    if (agencyError) {
      // 롤백: 계정 삭제
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: '대리점 생성 실패: ' + agencyError.message }, { status: 500 })
    }

    // 3. app_metadata에 role + agency_id 설정 (서버에서만 변경 가능, RLS에서 참조)
    const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: {
        role: 'agency_admin',
        agency_id: agencyData.id,
        plan: validated.plan,
      },
    })

    if (metaError) {
      // 롤백: 대리점 + 계정 삭제
      await supabaseAdmin.from('agencies').delete().eq('id', agencyData.id)
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json(
        { error: '메타데이터 설정 실패: ' + metaError.message },
        { status: 500 }
      )
    }

    // 4. 구독(subscriptions) 레코드 생성
    const planPrices: Record<string, number> = { free: 0, basic: 49900, standard: 99000, enterprise: 0 };
    const monthlyAmount = planPrices[validated.plan] ?? 0;
    const _billingCycle = validated.billing ?? 'monthly';

    const { error: subError } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        agency_id: agencyData.id,
        plan: validated.plan,
        amount: monthlyAmount,
        billing_date: new Date().getDate(),
        status: validated.plan === 'free' ? 'active' : 'active',
        last_paid_at: new Date().toISOString(),
        next_billing_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      } as never)

    if (subError) {
      console.error('[Signup] 구독 생성 실패:', subError.message)
      // 구독 실패는 치명적 — 에러 반환
      return NextResponse.json({ error: '구독 등록 실패: ' + subError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      userId,
      agencyId: agencyData.id,
      plan: validated.plan,
    })
  } catch (err) {
    console.error('[Signup] 예상치 못한 오류:', err)
    return apiError('회원가입 처리 중 오류가 발생했습니다', 500)
  }
}