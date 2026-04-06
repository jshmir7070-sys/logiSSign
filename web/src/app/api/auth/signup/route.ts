import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitPublic } from '@/lib/rate-limit'
import { apiError } from '@/lib/api-error'
import { getPointBalance } from '@/services/point.service'
import { encryptAgencyPii } from '@/services/pii.service'
import { z } from 'zod'

const supabaseAdmin = createAdminSupabaseClient()

type SignupPlanMode = 'point' | 'subscription'
type SignupPlanType = 'point' | 'basic' | 'standard' | 'pro' | 'enterprise'
type BillingCycle = 'monthly' | '1year' | '2year'

const signupSchema = z.object({
  email: z.string().trim().email('올바른 이메일 주소를 입력해 주세요.'),
  password: z
    .string()
    .min(8, '비밀번호는 8자 이상이어야 합니다.')
    .regex(/[a-z]/, '비밀번호에 영문 소문자를 포함해 주세요.')
    .regex(/[A-Z]/, '비밀번호에 영문 대문자를 포함해 주세요.')
    .regex(/[0-9]/, '비밀번호에 숫자를 포함해 주세요.')
    .regex(/[^a-zA-Z0-9]/, '비밀번호에 특수문자를 포함해 주세요.'),
  companyName: z.string().trim().min(1, '운송사명을 입력해 주세요.').max(100),
  ownerName: z.string().trim().min(1, '대표자명을 입력해 주세요.').max(50),
  businessNumber: z
    .string()
    .trim()
    .regex(/^\d{3}-?\d{2}-?\d{5}$/, '사업자등록번호 형식이 올바르지 않습니다.')
    .optional()
    .or(z.literal('')),
  ownerBirthDate: z
    .string()
    .trim()
    .regex(/^\d{4}-?\d{2}-?\d{2}$/, '대표자 생년월일 형식이 올바르지 않습니다.')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .trim()
    .regex(/^01[0-9]-?\d{3,4}-?\d{4}$/, '휴대전화 번호 형식이 올바르지 않습니다.')
    .optional()
    .or(z.literal('')),
  address: z.string().trim().max(200).optional().or(z.literal('')),
  addressDetail: z.string().trim().max(100).optional().or(z.literal('')),
  businessType: z.string().trim().max(50).optional().or(z.literal('')),
  businessCategory: z.string().trim().max(50).optional().or(z.literal('')),
  bankName: z.string().trim().max(30).optional().or(z.literal('')),
  bankAccount: z
    .string()
    .trim()
    .regex(/^[\d-]{8,20}$/, '계좌번호 형식이 올바르지 않습니다.')
    .optional()
    .or(z.literal('')),
  bankHolder: z.string().trim().max(30).optional().or(z.literal('')),
  planMode: z.enum(['point', 'subscription']).default('point'),
  plan: z.enum(['point', 'basic', 'standard', 'pro', 'enterprise']).default('point'),
  billing: z.enum(['monthly', '1year', '2year']).default('monthly'),
})

function normalizeNullable(value?: string): string | null {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized.length > 0 ? normalized : null
}

function normalizeBusinessNumber(value?: string): string | null {
  const normalized = normalizeNullable(value)
  return normalized ? normalized.replace(/\s+/g, '') : null
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''

  for (let index = 0; index < 6; index += 1) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }

  return code
}

async function generateUniqueInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = generateInviteCode()
    const { data } = await supabaseAdmin
      .from('agencies')
      .select('id')
      .eq('invite_code', code)
      .maybeSingle()

    if (!data) {
      return code
    }
  }

  throw new Error('초대코드를 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.')
}

async function updateAgencyUsersPlan(agencyId: string, plan: string) {
  let page = 1
  const perPage = 100

  while (true) {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    const users = data?.users ?? []
    const agencyUsers = users.filter((user) => user.app_metadata?.agency_id === agencyId)

    for (const user of agencyUsers) {
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        app_metadata: {
          ...user.app_metadata,
          plan,
        },
      })
    }

    if (users.length < perPage) {
      break
    }

    page += 1
  }
}

async function createPointSubscription(agencyId: string) {
  const now = new Date().toISOString()
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('agency_id', agencyId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingError) {
    throw new Error(`포인트 플랜 설정을 준비하지 못했습니다: ${existingError.message}`)
  }

  const payload = {
    agency_id: agencyId,
    plan: 'point',
    billing_cycle: 'monthly',
    amount: 0,
    monthly_amount: 0,
    total_amount: 0,
    payment_method: 'POINT',
    status: 'active',
    started_at: now,
    updated_at: now,
  }

  if (existing?.id) {
    const { error } = await supabaseAdmin
      .from('subscriptions')
      .update(payload)
      .eq('id', existing.id)

    if (error) {
      throw new Error(`포인트 플랜 설정에 실패했습니다: ${error.message}`)
    }
    return
  }

  const { error } = await supabaseAdmin.from('subscriptions').insert(payload as never)
  if (error) {
    throw new Error(`포인트 플랜 설정에 실패했습니다: ${error.message}`)
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = rateLimitPublic(ip, '/api/auth/signup')
  if (limited) return limited

  try {
    const rawBody = await request.json()
    const parsed = signupSchema.safeParse(rawBody)

    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join(', ')
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const body = parsed.data
    const planMode: SignupPlanMode = body.planMode
    const selectedPlan: SignupPlanType =
      planMode === 'point' ? 'point' : body.plan === 'point' ? 'basic' : body.plan
    const initialPlan = planMode === 'point' ? 'point' : 'free'
    const initialPlanType = planMode === 'point' ? 'point' : 'subscription'
    const businessNumber = normalizeBusinessNumber(body.businessNumber)

    if (selectedPlan === 'enterprise') {
      return NextResponse.json(
        { error: 'Enterprise 플랜은 별도 상담 후 가입할 수 있습니다.' },
        { status: 400 }
      )
    }

    if (businessNumber) {
      const { data: existingAgency } = await supabaseAdmin
        .from('agencies')
        .select('id')
        .eq('business_number', businessNumber)
        .maybeSingle()

      if (existingAgency) {
        return NextResponse.json(
          { error: '이미 등록된 사업자등록번호입니다.' },
          { status: 409 }
        )
      }
    }

    const createUserResult = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        role: 'agency_admin',
        company_name: body.companyName,
        owner_name: body.ownerName,
        requested_plan: selectedPlan,
      },
    })

    if (createUserResult.error || !createUserResult.data.user) {
      return NextResponse.json(
        { error: createUserResult.error?.message ?? '회원 계정을 생성하지 못했습니다.' },
        { status: 400 }
      )
    }

    const userId = createUserResult.data.user.id
    let agencyId: string | null = null

    try {
      const inviteCode = await generateUniqueInviteCode()
      const encryptedAgencyFields = await encryptAgencyPii({
        owner_birth_date: normalizeNullable(body.ownerBirthDate),
        bank_account: normalizeNullable(body.bankAccount),
      })

      const agencyInsert = {
        name: body.companyName,
        business_number: businessNumber,
        owner_name: body.ownerName,
        owner_birth_date: encryptedAgencyFields.owner_birth_date ?? null,
        phone: normalizeNullable(body.phone),
        email: body.email,
        address: normalizeNullable(body.address),
        address_detail: normalizeNullable(body.addressDetail),
        business_type: normalizeNullable(body.businessType),
        business_category: normalizeNullable(body.businessCategory),
        bank_name: normalizeNullable(body.bankName),
        bank_account: encryptedAgencyFields.bank_account ?? null,
        bank_holder: normalizeNullable(body.bankHolder),
        plan: initialPlan,
        plan_type: initialPlanType,
        monthly_fee: 0,
        status: 'active',
        invite_code: inviteCode,
      }

      const agencyResult = await supabaseAdmin
        .from('agencies')
        .insert(agencyInsert as never)
        .select('id')
        .single()

      if (agencyResult.error || !agencyResult.data) {
        throw new Error(agencyResult.error?.message ?? '대리점 정보를 저장하지 못했습니다.')
      }

      const createdAgencyId = agencyResult.data.id
      agencyId = createdAgencyId

      const updateMetadataResult = await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          company_name: body.companyName,
          owner_name: body.ownerName,
          requested_plan: selectedPlan,
        },
        app_metadata: {
          role: 'agency_admin',
          agency_id: createdAgencyId,
          plan: initialPlan,
        },
      })

      if (updateMetadataResult.error) {
        throw new Error(updateMetadataResult.error.message)
      }

      if (planMode === 'point') {
        await createPointSubscription(createdAgencyId)
        await getPointBalance(createdAgencyId)
        await updateAgencyUsersPlan(createdAgencyId, 'point')
      }

      return NextResponse.json({
        success: true,
        userId,
        agencyId,
        inviteCode,
        initialPlan,
        selectedPlan,
        billing: body.billing as BillingCycle,
      })
    } catch (innerError) {
      if (agencyId) {
        await supabaseAdmin.from('agencies').delete().eq('id', agencyId)
      }
      await supabaseAdmin.auth.admin.deleteUser(userId)

      throw innerError
    }
  } catch (error) {
    console.error('[Signup] Unexpected error:', error)
    return apiError(
      error instanceof Error ? error.message : '회원가입 처리 중 오류가 발생했습니다.',
      500
    )
  }
}
