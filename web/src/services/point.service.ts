/**
 * 포인트 서비스 — 잔액 조회, 차감, 충전
 * 서버사이드(API Route)에서 supabaseAdmin으로만 사용
 *
 * ⚡ 원자적(atomic) 업데이트로 동시 요청 레이스 컨디션 방지
 */

import { createClient } from '@supabase/supabase-js'
import { POINT_COSTS, WELCOME_BONUS_POINTS, type PointAction } from '@/lib/plan-limits'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/* ══════════════════════ Types ══════════════════════ */

export interface PointBalance {
  balance: number
  totalCharged: number
  totalUsed: number
}

export interface PointTransaction {
  id: string
  type: 'charge' | 'use' | 'refund' | 'bonus' | 'expire'
  amount: number
  balanceAfter: number
  description: string
  referenceType?: string
  referenceId?: string
  createdAt: string
}

/* ══════════════════════ 잔액 조회 ══════════════════════ */

/** 대리점 포인트 잔액 조회 (없으면 0 반환 후 자동 생성) */
export async function getPointBalance(agencyId: string): Promise<PointBalance> {
  const { data } = await supabaseAdmin
    .from('point_balances')
    .select('balance, total_charged, total_used')
    .eq('agency_id', agencyId)
    .single()

  if (data) {
    return {
      balance: data.balance,
      totalCharged: data.total_charged,
      totalUsed: data.total_used,
    }
  }

  // 레코드 없으면 생성 + 웰컴 보너스 지급 (upsert로 중복 방지)
  const welcome = WELCOME_BONUS_POINTS
  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('point_balances')
    .upsert({
      agency_id: agencyId,
      balance: welcome,
      total_charged: welcome,
      total_used: 0,
    }, { onConflict: 'agency_id', ignoreDuplicates: true })
    .select('balance, total_charged, total_used')
    .single()

  // upsert 성공 시 웰컴 보너스 거래 내역 기록
  if (!insertErr && inserted) {
    // 이미 거래 내역이 있는지 확인 (중복 방지)
    const { count } = await supabaseAdmin
      .from('point_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId)
      .eq('type', 'bonus')
      .ilike('description', '%웰컴%')

    if ((count ?? 0) === 0) {
      await supabaseAdmin
        .from('point_transactions')
        .insert({
          agency_id: agencyId,
          type: 'bonus',
          amount: welcome,
          balance_after: welcome,
          description: `가입 축하 웰컴 보너스 ${welcome.toLocaleString()}P`,
        })
    }

    return {
      balance: inserted.balance,
      totalCharged: inserted.total_charged,
      totalUsed: inserted.total_used,
    }
  }

  // 중복 upsert 시 기존 레코드 다시 조회
  const { data: existing } = await supabaseAdmin
    .from('point_balances')
    .select('balance, total_charged, total_used')
    .eq('agency_id', agencyId)
    .single()

  return existing
    ? { balance: existing.balance, totalCharged: existing.total_charged, totalUsed: existing.total_used }
    : { balance: welcome, totalCharged: welcome, totalUsed: 0 }
}

/* ══════════════════════ 포인트 차감 ══════════════════════ */

/**
 * 포인트 차감 (use) — 원자적 업데이트
 * @returns 차감 후 잔액. 잔액 부족 시 에러 throw
 */
export async function deductPoints(params: {
  agencyId: string
  action: PointAction
  count?: number           // 차감 횟수 (기본 1)
  referenceType?: string
  referenceId?: string
  userId?: string
}): Promise<{ balanceAfter: number; deducted: number }> {
  const { agencyId, action, count = 1, referenceType, referenceId, userId } = params
  const costInfo = POINT_COSTS[action]
  if (!costInfo) throw new Error(`알 수 없는 포인트 액션: ${action}`)

  const totalCost = costInfo.cost * count
  if (totalCost === 0) {
    // 무료 액션은 차감 없이 통과
    const bal = await getPointBalance(agencyId)
    return { balanceAfter: bal.balance, deducted: 0 }
  }

  // ⚡ 원자적 차감: 잔액 조회 → 계산 → 낙관적 잠금으로 1회 UPDATE
  // 읽은 시점의 balance 값이 동일할 때만 업데이트 성공 (TOCTOU 방지)
  const bal = await getPointBalance(agencyId)
  const currentBalance = bal.balance
  const currentUsed = bal.totalUsed

  // 잔액 부족 체크
  if (currentBalance < totalCost) {
    throw new Error(`포인트 잔액 부족 (필요: ${totalCost}P, 잔액: ${currentBalance}P)`)
  }

  const newBalance = currentBalance - totalCost

  // 낙관적 잠금: 읽은 시점의 balance와 같을 때만 업데이트
  // 동시 요청이 먼저 차감했다면 balance가 달라져서 0 rows updated
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('point_balances')
    .update({
      balance: newBalance,
      total_used: currentUsed + totalCost,
      updated_at: new Date().toISOString(),
    })
    .eq('agency_id', agencyId)
    .eq('balance', currentBalance) // 낙관적 잠금
    .select('balance')
    .single()

  if (updateErr || !updated) {
    // 동시 요청으로 값이 변경됨 — 재시도 필요
    throw new Error('포인트 차감 충돌 — 잠시 후 다시 시도해주세요')
  }

  // 거래 내역 기록
  const desc = count > 1
    ? `${costInfo.label} ${count}건 (${costInfo.cost}P × ${count})`
    : `${costInfo.label} (${costInfo.cost}P)`

  await supabaseAdmin
    .from('point_transactions')
    .insert({
      agency_id: agencyId,
      type: 'use',
      amount: -totalCost,
      balance_after: newBalance,
      description: desc,
      reference_type: referenceType ?? action,
      reference_id: referenceId,
      created_by: userId,
    })

  return { balanceAfter: newBalance, deducted: totalCost }
}

/* ══════════════════════ 포인트 충전 ══════════════════════ */

/** 포인트 충전 (결제 완료 후 호출) — 원자적 업데이트 */
export async function chargePoints(params: {
  agencyId: string
  points: number
  bonusPoints?: number
  paymentId?: string
  userId?: string
  description?: string
}): Promise<{ balanceAfter: number }> {
  const { agencyId, points, bonusPoints = 0, paymentId, userId, description } = params
  const totalPoints = points + bonusPoints

  // 현재 잔액 조회
  const bal = await getPointBalance(agencyId)
  const currentBalance = bal.balance
  const newBalance = currentBalance + totalPoints

  // 원자적 업데이트 (낙관적 잠금)
  const { error: updateErr } = await supabaseAdmin
    .from('point_balances')
    .update({
      balance: newBalance,
      total_charged: bal.totalCharged + totalPoints,
      updated_at: new Date().toISOString(),
    })
    .eq('agency_id', agencyId)
    .eq('balance', currentBalance) // 낙관적 잠금

  if (updateErr) {
    throw new Error('포인트 충전 처리 중 충돌이 발생했습니다. 다시 시도해주세요.')
  }

  // 충전 내역 (보너스 포함 총액 기록)
  await supabaseAdmin
    .from('point_transactions')
    .insert({
      agency_id: agencyId,
      type: 'charge',
      amount: points,
      balance_after: currentBalance + points,
      description: description ?? `${points.toLocaleString()}P 충전`,
      payment_id: paymentId,
      created_by: userId,
    })

  // 보너스가 있으면 별도 기록
  if (bonusPoints > 0) {
    await supabaseAdmin
      .from('point_transactions')
      .insert({
        agency_id: agencyId,
        type: 'bonus',
        amount: bonusPoints,
        balance_after: newBalance,
        description: `충전 보너스 +${bonusPoints.toLocaleString()}P`,
        payment_id: paymentId,
        created_by: userId,
      })
  }

  return { balanceAfter: newBalance }
}

/* ══════════════════════ 거래 내역 조회 ══════════════════════ */

/** 포인트 거래 내역 조회 (최근순) */
export async function getPointTransactions(
  agencyId: string,
  options?: { limit?: number; offset?: number; type?: string }
): Promise<PointTransaction[]> {
  const limit = options?.limit ?? 20
  const offset = options?.offset ?? 0

  let query = supabaseAdmin
    .from('point_transactions')
    .select('id, type, amount, balance_after, description, reference_type, reference_id, created_at')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })

  if (options?.type) {
    query = query.eq('type', options.type)
  }

  // range만 사용 (limit + range 충돌 방지)
  query = query.range(offset, offset + limit - 1)

  const { data } = await query

  return (data ?? []).map((t) => ({
    id: t.id,
    type: t.type,
    amount: t.amount,
    balanceAfter: t.balance_after,
    description: t.description,
    referenceType: t.reference_type,
    referenceId: t.reference_id,
    createdAt: t.created_at,
  }))
}

/* ══════════════════════ 포인트 충분 여부 확인 ══════════════════════ */

/** 특정 액션 실행 전 잔액 확인 (차감 없이 체크만) */
export async function hasEnoughPoints(
  agencyId: string,
  action: PointAction,
  count: number = 1
): Promise<{ enough: boolean; required: number; balance: number }> {
  const costInfo = POINT_COSTS[action]
  const required = (costInfo?.cost ?? 0) * count
  if (required === 0) return { enough: true, required: 0, balance: 0 }

  const bal = await getPointBalance(agencyId)
  return {
    enough: bal.balance >= required,
    required,
    balance: bal.balance,
  }
}

/* ══════════════════════ 충전 패키지 조회 ══════════════════════ */

export async function getPointPackages() {
  const { data } = await supabaseAdmin
    .from('point_packages')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  return data ?? []
}
