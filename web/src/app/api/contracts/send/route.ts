import { getClientIp } from '@/lib/get-ip'
import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateRequest } from '@/lib/api-auth'
import { sendContractSchema, validateInput } from '@/lib/api-schemas'
import { rateLimitAuth } from '@/lib/rate-limit'
import { isPaidPlan, getPlanLimits, type PlanType } from '@/lib/plan-limits'
import { deductPoints, hasEnoughPoints } from '@/services/point.service'
import { decryptAgencyPii, decryptDriverPii } from '@/services/pii.service'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/** SHA-256 해시 생성 */
async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** HTML 특수문자 이스케이프 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 변수 치환 (RegExp 특수문자 이스케이프 + HTML 이스케이프) */
function bindVariables(content: string, data: Record<string, string>): string {
  let result = content
  for (const [key, value] of Object.entries(data)) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const safeValue = escapeHtml(value || '')
    result = result.replace(new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g'), safeValue)
  }
  return result
}

/** KST 기준 이번 달 1일 00:00:00 (UTC ISO string 반환) */
function getKSTMonthStart(): string {
  const now = new Date()
  // KST = UTC + 9시간
  const kstOffset = 9 * 60 * 60 * 1000
  const kstNow = new Date(now.getTime() + kstOffset)
  const kstYear = kstNow.getUTCFullYear()
  const kstMonth = kstNow.getUTCMonth()
  // KST 기준 1일 00:00:00 → UTC로 변환
  const kstMonthStart = new Date(Date.UTC(kstYear, kstMonth, 1, 0, 0, 0) - kstOffset)
  return kstMonthStart.toISOString()
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = rateLimitAuth(ip, '/api/contracts/send')
  if (limited) return limited

  const { auth, error: authError } = await authenticateRequest(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const { data: validated, error: validationError } = validateInput(sendContractSchema, body)
    if (validationError || !validated) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    // 단건 (driverId) 또는 다건 (driverIds) 지원
    const driverIds: string[] = validated.driverIds ?? (validated.driverId ? [validated.driverId] : [])
    const { templateIds, bindingData, bindingDataMap } = validated

    if (driverIds.length === 0) {
      return NextResponse.json({ error: '기사를 1명 이상 선택하세요' }, { status: 400 })
    }

    const agencyId = auth!.agencyId
    if (!agencyId) {
      return NextResponse.json({ error: '대리점 정보가 없습니다' }, { status: 403 })
    }

    // 대리점 플랜 조회
    const { data: agency } = await supabaseAdmin
      .from('agencies')
      .select('plan')
      .eq('id', agencyId)
      .single()
    const agencyPlan = (agency?.plan ?? 'free') as PlanType

    // 월 무료 발송 건수 체크 (KST 기준)
    const planLimits = getPlanLimits(agencyPlan)
    const totalContracts = driverIds.length * templateIds.length
    const monthlyFreeLimit = planLimits.monthlyFreeContracts // null = 무제한

    // 이번 달 발송 건수 조회 (KST 기준)
    const monthStartISO = getKSTMonthStart()
    const { count: monthlyUsed } = await supabaseAdmin
      .from('contracts')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId)
      .gte('created_at', monthStartISO)

    const usedThisMonth = monthlyUsed ?? 0
    const remainingFree = monthlyFreeLimit === null ? totalContracts : Math.max(0, monthlyFreeLimit - usedThisMonth)
    const chargeableContracts = Math.max(0, totalContracts - remainingFree) // 무료 한도 초과분만 과금

    // 구독형 여부 (point 제외한 유료 플랜은 구독형)
    const isSubscription = isPaidPlan(agencyPlan) && agencyPlan !== 'point'

    // 구독형 플랜: 월 한도 초과 시 차단 (Pro/Enterprise는 무제한이므로 해당 없음)
    if (isSubscription && monthlyFreeLimit !== null && chargeableContracts > 0) {
      return NextResponse.json({
        error: `${planLimits.monthlyFreeContracts}건 월 한도를 초과합니다 (이번 달 ${usedThisMonth}건 사용). 상위 플랜으로 업그레이드하세요.`,
      }, { status: 402 })
    }

    // 포인트형/무료 플랜: 무료 한도 초과분 포인트 차감 (계약서 생성 전에 먼저 차감)
    let pointDeducted = 0
    if (chargeableContracts > 0 && !isSubscription) {
      // 잔액 확인
      const check = await hasEnoughPoints(agencyId, 'contract_send', chargeableContracts)
      if (!check.enough) {
        return NextResponse.json({
          error: `월 무료 ${monthlyFreeLimit}건 중 ${usedThisMonth}건 사용 완료. 추가 ${chargeableContracts}건 발송에 포인트 부족 (필요: ${check.required.toLocaleString()}P, 잔액: ${check.balance.toLocaleString()}P)`,
        }, { status: 402 })
      }

      // ⚡ 먼저 포인트 차감 (원자적) — 실패 시 계약서 생성 안 함
      try {
        const result = await deductPoints({
          agencyId,
          action: 'contract_send',
          count: chargeableContracts,
          referenceType: 'contract',
          userId: auth!.userId,
        })
        pointDeducted = result.deducted
      } catch (pointErr) {
        console.error('[ContractSend] Point deduction failed:', pointErr)
        return NextResponse.json({
          error: '포인트 차감에 실패했습니다. 잠시 후 다시 시도해주세요.',
        }, { status: 402 })
      }
    }

    // 소속 기사 일괄 확인
    const { data: drivers } = await supabaseAdmin
      .from('drivers')
      .select('id, push_token')
      .eq('agency_id', agencyId)
      .in('id', driverIds)

    if (!drivers?.length) {
      return NextResponse.json({ error: '소속 기사가 아닙니다' }, { status: 403 })
    }
    const validDriverIds = new Set(drivers.map(d => d.id))

    // 템플릿 조회
    const { data: templates, error: fetchErr } = await supabaseAdmin
      .from('contract_templates')
      .select('id, title, content, template_type, template_pdf_url, sign_fields')
      .in('id', templateIds)
      .or(`agency_id.eq.${agencyId},agency_id.is.null`)

    if (fetchErr || !templates?.length) {
      return NextResponse.json({ error: '템플릿 조회 실패' }, { status: 400 })
    }

    // 전체 계약서 일괄 생성 (기사 × 템플릿)
    const contracts: Record<string, unknown>[] = []
    const pushTokens: string[] = []

    // sender(대리점) 데이터 캐시 — 기사 루프 밖에서 한 번만 조회
    let senderDataCache: Record<string, string> | null = null

    for (const did of driverIds) {
      if (!validDriverIds.has(did)) continue
      let driverBindingData = bindingDataMap?.[did] ?? bindingData ?? {}

      // bindingData가 비어있으면 → DB에서 자동 조회 (bind 엔진)
      if (!driverBindingData || Object.keys(driverBindingData).length === 0) {
        try {
          const { BINDING_FIELDS } = await import('@/lib/binding-fields')
          const [driverRes, ratesRes, routeRes, deductionsRes] = await Promise.all([
            supabaseAdmin.from('drivers').select('*').eq('id', did).single(),
            supabaseAdmin.from('driver_rates').select('package_type, unit_price').eq('driver_id', did).eq('is_active', true),
            supabaseAdmin.from('driver_route_rates').select('route_code, delivery_rate, return_rate').eq('driver_id', did).eq('is_active', true),
            supabaseAdmin.from('driver_deductions').select('name, amount, deduction_type').eq('driver_id', did).eq('is_active', true),
          ])
          const agencyRes = await supabaseAdmin.from('agencies').select('*').eq('id', agencyId).single()
          const rawDriver = driverRes.data as Record<string, unknown> | null
          const rawAgency = agencyRes.data as Record<string, unknown> | null
          if (rawDriver && rawAgency) {
            const d = await decryptDriverPii(rawDriver)
            const a = await decryptAgencyPii(rawAgency)
            const rateMap: Record<string, number> = {}
            ;(ratesRes.data || []).forEach((r: { package_type: string; unit_price: number }) => { rateMap[r.package_type] = r.unit_price })
            const routeText = (routeRes.data || []).map((r: { route_code: string; delivery_rate: number; return_rate: number }) =>
              `${r.route_code}: ${r.delivery_rate?.toLocaleString()}원/${(r.return_rate || r.delivery_rate)?.toLocaleString()}원`).join('\n')
            const deductionText = (deductionsRes.data || []).map((dd: { name: string; amount: number; deduction_type: string }) =>
              `${dd.name}: ${dd.deduction_type === 'percentage' ? dd.amount + '%' : dd.amount.toLocaleString() + '원'}`).join('\n')
            const str = (v: unknown) => v != null ? String(v) : ''
            const fmt = (v: unknown) => v && Number(v) ? Number(v).toLocaleString() + '원' : ''

            // 레지스트리 기반 자동 바인딩
            const autoData: Record<string, string> = {}
            for (const f of BINDING_FIELDS) {
              let val = ''
              if (f.source.startsWith('drivers.')) { val = str(d[f.source.replace('drivers.', '')]) }
              else if (f.source.startsWith('agencies.')) { val = str(a[f.source.replace('agencies.', '')]) }
              else if (f.source === 'driver_rates.배송') { val = fmt(rateMap['배송'] || d.flat_rate) }
              else if (f.source === 'driver_rates.반품') { val = fmt(rateMap['반품']) }
              else if (f.source === 'driver_rates.집하') { val = fmt(rateMap['집하']) }
              else if (f.source === 'driver_route_rates') { val = routeText }
              else if (f.source === 'driver_deductions') { val = deductionText }
              else if (f.source === 'system.today') { val = new Date().toLocaleDateString('ko-KR') }
              if (val) autoData[f.templateVar] = val
            }
            // 특수 처리
            autoData['대리점주소'] = a.address ? (str(a.address) + (a.address_detail ? ' ' + str(a.address_detail) : '')) : ''
            autoData['부가세구분'] = d.vat_included ? '포함가 (VAT 포함)' : '별도 (VAT 별도)'
            autoData['사업자여부'] = d.is_business_owner ? '사업자' : '개인'
            autoData['보험부담'] = d.vehicle_insurance_by === 'lessor' ? '임대인' : '임차인'
            autoData['차량소유'] = d.vehicle_owner === 'company' ? '회사차' : '자차'
            autoData['대표자명'] = str(d.representative_name) || str(d.name)
            autoData['세금처리'] = d.is_business_owner ? (d.tax_type === 'vat_invoice' ? '세금계산서 발행' : str(d.tax_type)) : '3.3% 원천징수'
            autoData['계약시작일'] = new Date().toLocaleDateString('ko-KR')
            autoData['계약종료일'] = ''
            driverBindingData = autoData
          }
        } catch (bindErr) {
          console.warn('[ContractSend] auto-bind failed:', bindErr)
        }
      }

      for (const tmpl of templates) {
        const boundContent = bindVariables((tmpl as { content: string }).content, driverBindingData)
        const contentHash = await sha256(boundContent)
        const signToken = crypto.randomUUID()

        const tRec = tmpl as Record<string, unknown>

        // PDF 타입: sender 필드 자동 채움 처리
        let resolvedSignFields = tRec.sign_fields as Record<string, unknown>[] | null
        if (tRec.template_type === 'pdf' && resolvedSignFields && Array.isArray(resolvedSignFields)) {
          // 대리점 정보 조회 (한 번만)
          if (!senderDataCache) {
            const { data: agencyData } = await supabaseAdmin
              .from('agencies').select('*').eq('id', agencyId).single()
            const { data: defaultSeal } = await supabaseAdmin
              .from('seals')
              .select('seal_data_uri, seal_image_url')
              .eq('owner_type', 'agency').eq('owner_id', agencyId).eq('is_default', true)
              .maybeSingle()
            const a = agencyData as Record<string, unknown> | null
            senderDataCache = {
              '대리점명': String(a?.name ?? ''),
              '대표자명_대리점': String(a?.owner_name ?? ''),
              '대리점사업자번호': String(a?.business_number ?? ''),
              '대리점주소': a?.address ? (String(a.address) + (a.address_detail ? ' ' + String(a.address_detail) : '')) : '',
              '대리점전화': String(a?.phone ?? ''),
              '대리점이메일': String(a?.email ?? ''),
              '업태': String(a?.business_type ?? ''),
              '종목': String(a?.business_category ?? ''),
              '대리점도장': defaultSeal?.seal_data_uri || defaultSeal?.seal_image_url || '',
            }
          }

          // sender 필드의 바인딩 값을 default_value로 채움 (직접 입력값이 있으면 우선)
          resolvedSignFields = resolvedSignFields.map(field => {
            const f = { ...field }
            if (f.field_owner === 'sender' && !f.default_value && f.binding_var && senderDataCache) {
              const val = senderDataCache[f.binding_var as string]
              if (val) f.default_value = val
            }
            // receiver 필드의 바인딩 값도 기사 데이터로 채움
            if (f.field_owner === 'receiver' && f.binding_var && driverBindingData) {
              const bindKey = f.binding_var as string
              const val = driverBindingData[bindKey]
              if (val) f.default_value = val
            }
            return f
          })
        }

        contracts.push({
          agency_id: agencyId,
          template_id: (tmpl as { id: string }).id,
          driver_id: did,
          title: (tmpl as { title: string }).title,
          content: boundContent,
          content_hash: contentHash,
          sign_token: signToken,
          binding_data: driverBindingData,
          status: 'sent',
          sent_at: new Date().toISOString(),
          // PDF 타입: 템플릿 PDF URL + 서명 필드 (sender 자동 채움 완료)
          ...(tRec.template_type === 'pdf' ? {
            template_type: 'pdf',
            template_pdf_url: tRec.template_pdf_url,
            sign_fields: resolvedSignFields,
          } : {}),
        })
      }

      // 푸시 토큰 수집
      const driver = drivers.find(d => d.id === did)
      if (driver?.push_token) pushTokens.push(driver.push_token as string)
    }

    // 일괄 INSERT
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('contracts')
      .insert(contracts as never[])
      .select('id')

    if (insertErr) {
      console.error('[ContractSend] Insert error:', insertErr)
      // 포인트 이미 차감된 경우 로그 남김 (관리자 확인용)
      if (pointDeducted > 0) {
        console.error(`[ContractSend] ⚠️ 포인트 ${pointDeducted}P 차감됨, 계약서 생성 실패 — 수동 환불 필요. agency=${agencyId}`)
      }
      return NextResponse.json({ error: '계약서 생성 실패: ' + insertErr.message }, { status: 500 })
    }

    // 푸시 알림 일괄 발송 (SMS 대신 푸시)
    if (pushTokens.length > 0) {
      const pushMessages = pushTokens.map(token => ({
        to: token,
        title: '계약서 도착',
        body: `${templates.length}건의 계약서가 도착했습니다. 확인 후 서명해주세요.`,
        sound: 'default' as const,
        data: { type: 'contract' },
        channelId: 'default',
      }))

      // 100건씩 배치
      for (let i = 0; i < pushMessages.length; i += 100) {
        const batch = pushMessages.slice(i, i + 100)
        try {
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(batch),
          })
        } catch { /* 푸시 실패 무시 — 비치명적 */ }
      }
    }

    return NextResponse.json({
      created: inserted?.length ?? 0,
      pointDeducted,
      freeUsed: Math.min(totalContracts, remainingFree),
    })
  } catch (err) {
    console.error('[ContractSend] Unexpected error:', err)
    return apiError('계약서 전송 중 오류가 발생했습니다', 500)
  }
}
