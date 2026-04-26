import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

import { apiError } from '@/lib/api-error'
import { authenticateRequest } from '@/lib/api-auth'
import { sendContractSchema, validateInput } from '@/lib/api-schemas'
import { getClientIp } from '@/lib/get-ip'
import { getPlanLimits, isPointBased, isPaidPlan, type PlanType } from '@/lib/plan-limits'
import { rateLimitAuth } from '@/lib/rate-limit'
import { decryptAgencyPii, decryptDriverPii } from '@/services/pii.service'
import { deductPoints, hasEnoughPoints, refundPoints } from '@/services/point.service'
import { sendContractSignSms } from '@/services/sms.service'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

type DriverChannel = {
  id: string
  name: string
  phone: string | null
  push_token: string | null
}

type InsertedContract = {
  id: string
  driver_id: string
  title: string
}

type ContractTemplateRow = {
  id: string
  agency_id: string | null
  principal_id: string | null
  title: string
  content: string
  is_active: boolean
  template_type: string | null
  template_pdf_url: string | null
  sign_fields: Record<string, unknown>[] | null
}

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function bindVariables(content: string, data: Record<string, string>): string {
  let result = content
  for (const [key, value] of Object.entries(data)) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const safeValue = escapeHtml(value || '')
    result = result.replace(new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g'), safeValue)
  }
  return result
}

function getKSTMonthStart(): string {
  const now = new Date()
  const kstOffset = 9 * 60 * 60 * 1000
  const kstNow = new Date(now.getTime() + kstOffset)
  const kstYear = kstNow.getUTCFullYear()
  const kstMonth = kstNow.getUTCMonth()
  const kstMonthStart = new Date(Date.UTC(kstYear, kstMonth, 1, 0, 0, 0) - kstOffset)
  return kstMonthStart.toISOString()
}

async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        to: token,
        title,
        body,
        sound: 'default',
        channelId: 'default',
        data,
      }),
    })

    return response.ok
  } catch {
    return false
  }
}

async function resolveDriverBindingData(
  driverId: string,
  agencyId: string,
  providedBindingData?: Record<string, string>,
): Promise<Record<string, string>> {
  if (providedBindingData && Object.keys(providedBindingData).length > 0) {
    return providedBindingData
  }

  try {
    const { BINDING_FIELDS } = await import('@/lib/binding-fields')
    const [driverRes, ratesRes, routeRes, deductionsRes] = await Promise.all([
      supabaseAdmin.from('drivers').select('*').eq('id', driverId).single(),
      supabaseAdmin
        .from('driver_rates')
        .select('package_type, unit_price')
        .eq('driver_id', driverId)
        .eq('is_active', true),
      supabaseAdmin
        .from('driver_route_rates')
        .select('route_code, delivery_rate, return_rate')
        .eq('driver_id', driverId)
        .eq('is_active', true),
      supabaseAdmin
        .from('driver_deductions')
        .select('name, amount, deduction_type')
        .eq('driver_id', driverId)
        .eq('is_active', true),
    ])
    const agencyRes = await supabaseAdmin.from('agencies').select('*').eq('id', agencyId).single()

    const rawDriver = driverRes.data as Record<string, unknown> | null
    const rawAgency = agencyRes.data as Record<string, unknown> | null
    if (!rawDriver || !rawAgency) {
      return {}
    }

    const driver = await decryptDriverPii(rawDriver)
    const agency = await decryptAgencyPii(rawAgency)

    const rateMap: Record<string, number> = {}
    for (const rate of ratesRes.data || []) {
      rateMap[rate.package_type] = rate.unit_price
    }

    const routeText = (routeRes.data || [])
      .map(
        (route) =>
          `${route.route_code}: 배송 ${route.delivery_rate?.toLocaleString()}원 / 반품 ${(route.return_rate || route.delivery_rate)?.toLocaleString()}원`,
      )
      .join('\n')

    const deductionText = (deductionsRes.data || [])
      .map((deduction) =>
        `${deduction.name}: ${
          deduction.deduction_type === 'percentage'
            ? `${deduction.amount}%`
            : `${deduction.amount.toLocaleString()}원`
        }`,
      )
      .join('\n')

    const toStringSafe = (value: unknown) => (value != null ? String(value) : '')
    const toWon = (value: unknown) =>
      value && Number(value) ? `${Number(value).toLocaleString()}원` : ''

    const autoData: Record<string, string> = {}
    for (const field of BINDING_FIELDS) {
      let value = ''
      if (field.source.startsWith('drivers.')) {
        value = toStringSafe(driver[field.source.replace('drivers.', '')])
      } else if (field.source.startsWith('agencies.')) {
        value = toStringSafe(agency[field.source.replace('agencies.', '')])
      } else if (field.source === 'driver_rates.배송') {
        value = toWon(rateMap['배송'] || driver.flat_rate)
      } else if (field.source === 'driver_rates.반품') {
        value = toWon(rateMap['반품'])
      } else if (field.source === 'driver_rates.집하') {
        value = toWon(rateMap['집하'])
      } else if (field.source === 'driver_route_rates') {
        value = routeText
      } else if (field.source === 'driver_deductions') {
        value = deductionText
      } else if (field.source === 'system.today') {
        value = new Date().toLocaleDateString('ko-KR')
      }

      if (value) {
        autoData[field.templateVar] = value
      }
    }

    autoData['대리점주소'] = agency.address
      ? `${toStringSafe(agency.address)}${agency.address_detail ? ` ${toStringSafe(agency.address_detail)}` : ''}`
      : ''
    autoData['부가세구분'] = driver.vat_included ? '포함가 (VAT 포함)' : '별도 (VAT 별도)'
    autoData['사업자여부'] = driver.is_business_owner ? '사업자' : '개인'
    autoData['보험부담'] = driver.vehicle_insurance_by === 'lessor' ? '법인 부담' : '기사 부담'
    autoData['차량소유'] = driver.vehicle_owner === 'company' ? '회사 차량' : '자차'
    autoData['대표자명'] = toStringSafe(driver.representative_name) || toStringSafe(driver.name)
    autoData['세금처리'] = driver.is_business_owner
      ? driver.tax_type === 'vat_invoice'
        ? '세금계산서 발행'
        : toStringSafe(driver.tax_type)
      : '3.3% 원천징수'
    autoData['계약시작일'] = new Date().toLocaleDateString('ko-KR')
    autoData['계약종료일'] = ''

    return autoData
  } catch (error) {
    console.warn('[ContractSend] Auto-bind fallback failed:', error)
    return {}
  }
}

async function resolveSenderBindingData(agencyId: string): Promise<Record<string, string>> {
  const [{ data: agencyData }, { data: defaultSeal }] = await Promise.all([
    supabaseAdmin.from('agencies').select('*').eq('id', agencyId).single(),
    supabaseAdmin
      .from('seals')
      .select('seal_data_uri, seal_image_url')
      .eq('owner_type', 'agency')
      .eq('owner_id', agencyId)
      .eq('is_default', true)
      .maybeSingle(),
  ])

  const agency = (agencyData ?? {}) as Record<string, unknown>
  return {
    대리점명: String(agency.name ?? ''),
    대표자명_대리점: String(agency.owner_name ?? ''),
    대리점사업자번호: String(agency.business_number ?? ''),
    대리점주소: agency.address
      ? `${String(agency.address)}${agency.address_detail ? ` ${String(agency.address_detail)}` : ''}`
      : '',
    대리점전화: String(agency.phone ?? ''),
    대리점이메일: String(agency.email ?? ''),
    업태: String(agency.business_type ?? ''),
    종목: String(agency.business_category ?? ''),
    대리점직인: defaultSeal?.seal_data_uri || defaultSeal?.seal_image_url || '',
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/contracts/send')
  if (limited) return limited

  const { auth, error: authError } = await authenticateRequest(request)
  if (authError || !auth) return authError!

  try {
    const body = await request.json()
    const { data: validated, error: validationError } = validateInput(sendContractSchema, body)
    if (validationError || !validated) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const driverIds = Array.from(new Set(validated.driverIds ?? (validated.driverId ? [validated.driverId] : [])))
    const templateIds = Array.from(new Set(validated.templateIds))
    const { bindingData, bindingDataMap, principalId } = validated

    if (driverIds.length === 0) {
      return NextResponse.json({ error: '기사를 1명 이상 선택해 주세요.' }, { status: 400 })
    }

    const agencyId = auth.agencyId
    if (!agencyId) {
      return NextResponse.json({ error: '대리점 정보가 없습니다.' }, { status: 403 })
    }

    if (principalId) {
      const { data: principal, error: principalErr } = await supabaseAdmin
        .from('principals')
        .select('id')
        .eq('id', principalId)
        .eq('agency_id', agencyId)
        .maybeSingle()

      if (principalErr || !principal) {
        return NextResponse.json({ error: '선택한 카테고리를 확인할 수 없습니다.' }, { status: 403 })
      }
    }

    const { data: agency } = await supabaseAdmin
      .from('agencies')
      .select('plan')
      .eq('id', agencyId)
      .single()

    const agencyPlan = (agency?.plan ?? 'free') as PlanType
    const planLimits = getPlanLimits(agencyPlan)
    const totalContracts = driverIds.length * templateIds.length
    const monthlyFreeLimit = planLimits.monthlyFreeContracts
    const monthStartISO = getKSTMonthStart()

    const { count: monthlyUsed } = await supabaseAdmin
      .from('contracts')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId)
      .gte('created_at', monthStartISO)

    const usedThisMonth = monthlyUsed ?? 0
    const remainingFree =
      monthlyFreeLimit === null ? totalContracts : Math.max(0, monthlyFreeLimit - usedThisMonth)
    const requestedChargeableContracts = Math.max(0, totalContracts - remainingFree)
    const isSubscription = isPaidPlan(agencyPlan) && !isPointBased(agencyPlan)

    if (isSubscription && monthlyFreeLimit !== null && requestedChargeableContracts > 0) {
      return NextResponse.json(
        {
          error: `${planLimits.monthlyFreeContracts}건 무료 발송 한도를 초과했습니다. 이번 달 사용 ${usedThisMonth}건 / 상위 플랜 업그레이드가 필요합니다.`,
        },
        { status: 402 },
      )
    }

    if (requestedChargeableContracts > 0 && !isSubscription) {
      const pointCheck = await hasEnoughPoints(agencyId, 'contract_send', requestedChargeableContracts)
      if (!pointCheck.enough) {
        return NextResponse.json(
          {
            error: `무료 ${monthlyFreeLimit}건 한도를 모두 사용했습니다. 추가 ${requestedChargeableContracts}건 발송에는 ${pointCheck.required.toLocaleString()}P가 필요합니다. 현재 보유 ${pointCheck.balance.toLocaleString()}P`,
          },
          { status: 402 },
        )
      }
    }

    const { data: drivers } = await supabaseAdmin
      .from('drivers')
      .select('id, name, phone, push_token')
      .eq('agency_id', agencyId)
      .in('id', driverIds)

    const driverChannels = (drivers ?? []) as DriverChannel[]
    if (driverChannels.length !== driverIds.length) {
      return NextResponse.json(
        { error: '선택한 기사 중 현재 대리점 소속이 아닌 기사가 포함되어 있습니다.' },
        { status: 403 },
      )
    }

    if (principalId) {
      const { data: links, error: linkErr } = await supabaseAdmin
        .from('driver_principals')
        .select('driver_id')
        .eq('principal_id', principalId)
        .eq('status', 'active')
        .in('driver_id', driverIds)

      const linkedDriverIds = new Set((links ?? []).map((link) => link.driver_id))
      const unlinkedDriverIds = driverIds.filter((driverId) => !linkedDriverIds.has(driverId))
      if (linkErr || unlinkedDriverIds.length > 0) {
        return NextResponse.json(
          { error: '선택한 카테고리에 연결되지 않은 기사가 포함되어 있습니다.' },
          { status: 403 },
        )
      }
    }

    const unreachableDrivers = driverChannels.filter((driver) => !driver.push_token && !driver.phone)
    if (unreachableDrivers.length > 0) {
      const names = unreachableDrivers.map((driver) => driver.name || driver.id).join(', ')
      return NextResponse.json(
        {
          error: `전송 가능한 연락 수단이 없는 기사가 있습니다. 푸시 토큰 또는 휴대전화 번호를 먼저 확인해 주세요. ${names}`,
        },
        { status: 400 },
      )
    }

    const { data: templates, error: fetchErr } = await supabaseAdmin
      .from('contract_templates')
      .select('id, agency_id, principal_id, title, content, is_active, template_type, template_pdf_url, sign_fields')
      .in('id', templateIds)
      .eq('is_active', true)
      .or(`agency_id.eq.${agencyId},agency_id.is.null`)

    const templateRows = (templates ?? []) as ContractTemplateRow[]
    const foundTemplateIds = new Set(templateRows.map((template) => template.id))
    const missingTemplateIds = templateIds.filter((templateId) => !foundTemplateIds.has(templateId))
    const notSendableTemplate = templateRows.find(
      (template) => template.agency_id !== agencyId && !(template.agency_id === null && template.template_type !== 'pdf'),
    )
    const mismatchedPrincipalTemplate = templateRows.find(
      (template) => template.principal_id && template.principal_id !== principalId,
    )

    if (fetchErr || missingTemplateIds.length > 0 || notSendableTemplate || mismatchedPrincipalTemplate) {
      return NextResponse.json({ error: '계약서 템플릿을 불러오지 못했습니다.' }, { status: 400 })
    }

    const senderBindingData = await resolveSenderBindingData(agencyId)
    const contracts: Record<string, unknown>[] = []
    const sentAt = new Date().toISOString()

    for (const driverId of driverIds) {
      const driverBindingData = await resolveDriverBindingData(
        driverId,
        agencyId,
        bindingDataMap?.[driverId] ?? bindingData,
      )

      for (const template of templateRows) {
        const templateRecord = template as Record<string, unknown>
        const content = bindVariables(template.content, driverBindingData)
        const contentHash = await sha256(content)

        let resolvedSignFields = templateRecord.sign_fields as Record<string, unknown>[] | null
        if (
          templateRecord.template_type === 'pdf' &&
          resolvedSignFields &&
          Array.isArray(resolvedSignFields)
        ) {
          resolvedSignFields = resolvedSignFields.map((field) => {
            const nextField = { ...field }
            if (
              nextField.field_owner === 'sender' &&
              !nextField.default_value &&
              nextField.binding_var &&
              senderBindingData[nextField.binding_var as string]
            ) {
              nextField.default_value = senderBindingData[nextField.binding_var as string]
            }

            if (
              nextField.field_owner === 'receiver' &&
              nextField.binding_var &&
              driverBindingData[nextField.binding_var as string]
            ) {
              nextField.default_value = driverBindingData[nextField.binding_var as string]
            }
            return nextField
          })
        }

        contracts.push({
          agency_id: agencyId,
          template_id: template.id,
          driver_id: driverId,
          title: template.title,
          content,
          content_hash: contentHash,
          sign_token: crypto.randomUUID(),
          binding_data: driverBindingData,
          status: 'sent',
          sent_at: sentAt,
          ...(templateRecord.template_type === 'pdf'
            ? {
                template_type: 'pdf',
                template_pdf_url: templateRecord.template_pdf_url,
                sign_fields: resolvedSignFields,
              }
            : {}),
        })
      }
    }

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('contracts')
      .insert(contracts as never[])
      .select('id, driver_id, title')

    if (insertErr || !inserted?.length || inserted.length !== contracts.length) {
      console.error('[ContractSend] Insert error:', insertErr)
      return NextResponse.json(
        { error: `계약서 생성에 실패했습니다. ${insertErr?.message ?? ''}`.trim() },
        { status: 500 },
      )
    }

    const insertedContracts = inserted as InsertedContract[]
    const contractsByDriver = new Map<string, InsertedContract[]>()
    for (const contract of insertedContracts) {
      const current = contractsByDriver.get(contract.driver_id) ?? []
      current.push(contract)
      contractsByDriver.set(contract.driver_id, current)
    }

    let chargedContractCount = 0
    let pointDeducted = 0
    if (requestedChargeableContracts > 0 && !isSubscription) {
      try {
        const result = await deductPoints({
          agencyId,
          action: 'contract_send',
          count: requestedChargeableContracts,
          referenceType: 'contract',
          userId: auth.userId,
        })
        chargedContractCount = requestedChargeableContracts
        pointDeducted = result.deducted
      } catch (pointError) {
        console.error('[ContractSend] Point deduction failed:', pointError)
        const { error: cleanupError } = await supabaseAdmin
          .from('contracts')
          .delete()
          .in('id', insertedContracts.map((contract) => contract.id))
        if (cleanupError) {
          console.error('[ContractSend] Failed to delete contracts after point error:', cleanupError)
        }
        return NextResponse.json(
          { error: pointError instanceof Error ? pointError.message : '포인트 차감에 실패했습니다.' },
          { status: 402 },
        )
      }
    }

    const notifiedDriverIds = new Set<string>()
    const failedDriverIds = new Set<string>()

    for (const driver of driverChannels) {
      const driverContracts = contractsByDriver.get(driver.id) ?? []
      if (driverContracts.length === 0) {
        continue
      }

      const title =
        driverContracts.length === 1
          ? driverContracts[0].title
          : `${driverContracts[0].title} 외 ${driverContracts.length - 1}건`

      let delivered = false
      if (driver.push_token) {
        delivered = await sendPushNotification(
          driver.push_token,
          '계약서가 도착했습니다',
          `${driverContracts.length}건의 계약서가 도착했습니다. 앱에서 내용을 확인하고 서명해 주세요.`,
          { type: 'contract' },
        )
      }

      if (!delivered && driver.phone) {
        const smsResult = await sendContractSignSms(driver.phone, title)
        delivered = smsResult.sent
      }

      if (delivered) {
        notifiedDriverIds.add(driver.id)
      } else {
        failedDriverIds.add(driver.id)
      }
    }

    const sentContracts = insertedContracts.filter((contract) => notifiedDriverIds.has(contract.driver_id))
    const unsentContractIds = insertedContracts
      .filter((contract) => !notifiedDriverIds.has(contract.driver_id))
      .map((contract) => contract.id)

    if (unsentContractIds.length > 0) {
      const { error: cleanupError } = await supabaseAdmin
        .from('contracts')
        .delete()
        .in('id', unsentContractIds)
      if (cleanupError) {
        console.error('[ContractSend] Failed to delete unnotified contracts:', cleanupError)
      }
    }

    if (sentContracts.length === 0) {
      if (chargedContractCount > 0) {
        try {
          const refund = await refundPoints({
            agencyId,
            action: 'contract_send',
            count: chargedContractCount,
            referenceType: 'contract',
            userId: auth.userId,
            description: '계약서 알림 전체 실패 환불',
          })
          pointDeducted = Math.max(0, pointDeducted - refund.refunded)
        } catch (refundError) {
          console.error('[ContractSend] Point refund failed after full notification failure:', refundError)
        }
      }

      return NextResponse.json(
        { error: '계약서 알림 전송에 실패했습니다. 전송되지 않은 계약서는 저장하지 않았습니다.' },
        { status: 502 },
      )
    }

    const actualChargeableContracts = Math.max(0, sentContracts.length - remainingFree)
    const refundContractCount = Math.max(0, chargedContractCount - actualChargeableContracts)
    if (refundContractCount > 0 && !isSubscription) {
      try {
        const refund = await refundPoints({
          agencyId,
          action: 'contract_send',
          count: refundContractCount,
          referenceType: 'contract',
          userId: auth.userId,
          description: `계약서 알림 실패 환불 ${refundContractCount}건`,
        })
        pointDeducted = Math.max(0, pointDeducted - refund.refunded)
      } catch (refundError) {
        console.error('[ContractSend] Point refund failed after partial notification failure:', refundError)
      }
    }

    return NextResponse.json({
      created: sentContracts.length,
      contractIds: sentContracts.map((contract) => contract.id),
      pointDeducted,
      freeUsed: Math.min(sentContracts.length, remainingFree),
      notifiedDrivers: notifiedDriverIds.size,
      failedDrivers: Array.from(failedDriverIds),
    })
  } catch (error) {
    console.error('[ContractSend] Unexpected error:', error)
    return apiError('계약서 전송 중 오류가 발생했습니다.', 500)
  }
}
