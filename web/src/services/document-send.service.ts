import { createBrowserSupabaseClient } from '@/lib/supabase'

/**
 * 문서/서류 전송 서비스
 * - 실제로 푸시 또는 SMS 발송에 성공한 기사만 sent 처리합니다.
 * - 전송에 실패한 대상은 delivery row를 남기지 않아 운영 화면의 sent 수치와 실제 도달 시도가 어긋나지 않게 맞춥니다.
 */

export type SendMethod = 'push' | 'sms' | 'both'

export type DocumentSendType =
  | 'registration'
  | 'renewal'
  | 'amendment'
  | 'general'
  | 'education'

export type DeliveryStatus = 'sent' | 'delivered' | 'viewed' | 'signed' | 'rejected'

export interface DocumentDelivery {
  id: string
  agency_id: string
  document_file_id: string | null
  contract_id: string | null
  driver_id: string
  send_type: DocumentSendType
  send_method: SendMethod
  title: string
  message: string | null
  status: DeliveryStatus
  sent_at: string
  viewed_at: string | null
  signed_at: string | null
  created_at: string
}

export interface SendDocumentParams {
  agencyId: string
  driverIds: string[]
  sendType: DocumentSendType
  sendMethod: SendMethod
  title: string
  message?: string
  documentFileId?: string
  contractId?: string
  requireSign?: boolean
}

export interface SendResult {
  total: number
  pushSent: number
  smsSent: number
  failed: number
  deliveryIds: string[]
  error: string | null
}

type DriverContact = {
  id: string
  name: string
  phone: string | null
  push_token: string | null
}

type ReachableTarget = {
  driver: DriverContact
  actualSendMethod: SendMethod
  canPush: boolean
  canSms: boolean
}

async function sendSmsThroughApi(to: string, text: string): Promise<boolean> {
  const response = await fetch('/api/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      to: String(to ?? '').replace(/\D/g, ''),
      text,
    }),
  })

  return response.ok
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
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
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

function getSendTypeIcon(type: DocumentSendType): string {
  switch (type) {
    case 'registration':
      return '계약'
    case 'renewal':
      return '갱신'
    case 'amendment':
      return '변경'
    case 'general':
      return '문서'
    case 'education':
      return '교육'
    default:
      return '문서'
  }
}

function getDefaultMessage(type: DocumentSendType, title: string): string {
  switch (type) {
    case 'registration':
      return '계약서가 도착했습니다. 내용을 확인하고 서명해 주세요.'
    case 'renewal':
      return '갱신 서류가 도착했습니다. 내용을 확인하고 서명해 주세요.'
    case 'amendment':
      return '계약 변경 서류가 도착했습니다. 변경 내용을 확인해 주세요.'
    case 'general':
      return `"${title}" 문서가 도착했습니다. 앱에서 바로 확인해 주세요.`
    case 'education':
      return '교육 자료가 도착했습니다. 앱에서 확인해 주세요.'
    default:
      return '새 문서가 도착했습니다.'
  }
}

function buildReachableTargets(drivers: DriverContact[], sendMethod: SendMethod): ReachableTarget[] {
  return drivers
    .map((driver) => {
      const canPush = Boolean(driver.push_token)
      const canSms = Boolean(driver.phone)

      if (sendMethod === 'push') {
        if (!canPush) return null
        return { driver, actualSendMethod: 'push' as const, canPush: true, canSms: false }
      }

      if (sendMethod === 'sms') {
        if (!canSms) return null
        return { driver, actualSendMethod: 'sms' as const, canPush: false, canSms: true }
      }

      if (!canPush && !canSms) return null

      return {
        driver,
        actualSendMethod: canPush && canSms ? 'both' : canPush ? 'push' : 'sms',
        canPush,
        canSms,
      }
    })
    .filter((target): target is ReachableTarget => Boolean(target))
}

export async function sendDocuments(params: SendDocumentParams): Promise<SendResult> {
  const { agencyId, driverIds, sendType, sendMethod, title, message, documentFileId, contractId } = params

  if (driverIds.length === 0) {
    return { total: 0, pushSent: 0, smsSent: 0, failed: 0, deliveryIds: [], error: null }
  }

  const supabase = createBrowserSupabaseClient()
  const { data: drivers, error: driverError } = await supabase
    .from('drivers')
    .select('id, name, phone, push_token')
    .in('id', driverIds)

  if (driverError || !drivers) {
    return {
      total: 0,
      pushSent: 0,
      smsSent: 0,
      failed: 0,
      deliveryIds: [],
      error: driverError?.message ?? '기사 정보를 불러오지 못했습니다.',
    }
  }

  const requestedCount = driverIds.length
  const reachableTargets = buildReachableTargets(drivers as DriverContact[], sendMethod)
  if (reachableTargets.length === 0) {
    return {
      total: requestedCount,
      pushSent: 0,
      smsSent: 0,
      failed: requestedCount,
      deliveryIds: [],
      error: '전달 가능한 연락 수단이 있는 기사가 없습니다.',
    }
  }

  const sentAt = new Date().toISOString()
  const notificationBody = message ?? getDefaultMessage(sendType, title)
  const successfulRows: Array<Record<string, unknown>> = []
  let pushSent = 0
  let smsSent = 0

  for (const target of reachableTargets) {
    const deliveryId = crypto.randomUUID()
    let delivered = false
    let usedMethod: SendMethod = target.actualSendMethod

    if (target.canPush && target.driver.push_token) {
      delivered = await sendPushNotification(
        target.driver.push_token,
        `${getSendTypeIcon(sendType)} ${title}`,
        notificationBody,
        {
          type: sendType === 'renewal' || sendType === 'registration' ? 'contract' : 'document',
          id: contractId ?? documentFileId ?? '',
          deliveryId,
        },
      )

      if (delivered) {
        pushSent += 1
        usedMethod = target.canSms ? 'both' : 'push'
      }
    }

    if (!delivered && target.canSms && target.driver.phone) {
      const smsOk = await sendSmsThroughApi(target.driver.phone, notificationBody)
      if (smsOk) {
        delivered = true
        smsSent += 1
        usedMethod = target.canPush ? 'both' : 'sms'
      }
    }

    if (!delivered) {
      continue
    }

    successfulRows.push({
      id: deliveryId,
      agency_id: agencyId,
      document_file_id: documentFileId ?? null,
      contract_id: contractId ?? null,
      driver_id: target.driver.id,
      send_type: sendType,
      send_method: usedMethod,
      title,
      message: message ?? null,
      status: 'sent',
      sent_at: sentAt,
    })
  }

  if (successfulRows.length === 0) {
    return {
      total: requestedCount,
      pushSent: 0,
      smsSent: 0,
      failed: requestedCount,
      deliveryIds: [],
      error: '실제로 문서를 전달하지 못했습니다. 푸시 또는 SMS 수신 상태를 확인해 주세요.',
    }
  }

  const { data: deliveries, error: insertError } = await supabase
    .from('document_deliveries')
    .insert(successfulRows)
    .select('id, driver_id')

  if (insertError) {
    return {
      total: requestedCount,
      pushSent: 0,
      smsSent: 0,
      failed: requestedCount,
      deliveryIds: [],
      error: insertError.message,
    }
  }

  if (documentFileId) {
    await supabase
      .from('document_files')
      .update({
        recipients: successfulRows.map((row) => row.driver_id),
        status: 'sent',
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentFileId)
  }

  return {
    total: requestedCount,
    pushSent,
    smsSent,
    failed: Math.max(0, requestedCount - successfulRows.length),
    deliveryIds: ((deliveries ?? []) as Array<{ id: string }>).map((row) => row.id),
    error: null,
  }
}

export interface RenewalSendParams {
  agencyId: string
  driverIds: string[]
  templateIds: string[]
  bindingDataMap: Record<string, Record<string, string>>
  sendMethod: SendMethod
  effectiveDate?: string
  message?: string
}

export async function sendRenewalDocuments(
  params: RenewalSendParams,
): Promise<{ sent: number; failed: number; error: string | null }> {
  const { agencyId, driverIds, templateIds, bindingDataMap, sendMethod, message } = params

  if (driverIds.length === 0 || templateIds.length === 0) {
    return { sent: 0, failed: 0, error: null }
  }

  let sent = 0
  let failed = 0

  for (const driverId of driverIds) {
    try {
      const bindingData = bindingDataMap[driverId] ?? {}
      const response = await fetch('/api/contracts/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agencyId,
          driverId,
          templateIds,
          bindingData,
        }),
      })

      if (!response.ok) {
        failed += 1
        continue
      }

      const result = await response.json()
      const contractId = result.contractIds?.[0] ?? null

      await sendDocuments({
        agencyId,
        driverIds: [driverId],
        sendType: 'renewal',
        sendMethod,
        title: '갱신 계약 서류',
        message: message ?? '갱신 계약 서류가 도착했습니다. 내용을 확인하고 서명해 주세요.',
        contractId,
      })

      sent += 1
    } catch {
      failed += 1
    }
  }

  return { sent, failed, error: null }
}

export async function getDocumentDeliveries(
  agencyId: string,
  filters?: {
    documentFileId?: string
    contractId?: string
    sendType?: DocumentSendType
    status?: DeliveryStatus
  },
): Promise<{ data: DocumentDelivery[] | null; error: string | null }> {
  const supabase = createBrowserSupabaseClient()

  let query = supabase
    .from('document_deliveries')
    .select('*, drivers:driver_id(name, phone)')
    .eq('agency_id', agencyId)
    .order('sent_at', { ascending: false })

  if (filters?.documentFileId) query = query.eq('document_file_id', filters.documentFileId)
  if (filters?.contractId) query = query.eq('contract_id', filters.contractId)
  if (filters?.sendType) query = query.eq('send_type', filters.sendType)
  if (filters?.status) query = query.eq('status', filters.status)

  const { data, error } = await query
  if (error) return { data: null, error: error.message }
  return { data: data as DocumentDelivery[], error: null }
}

export async function getDriverDocumentDeliveries(
  driverId: string,
): Promise<{ data: DocumentDelivery[] | null; error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  const { data, error } = await supabase
    .from('document_deliveries')
    .select('*')
    .eq('driver_id', driverId)
    .order('sent_at', { ascending: false })

  if (error) return { data: null, error: error.message }
  return { data: data as DocumentDelivery[], error: null }
}

export async function markDocumentViewed(deliveryId: string): Promise<void> {
  const supabase = createBrowserSupabaseClient()
  await supabase
    .from('document_deliveries')
    .update({
      status: 'viewed',
      viewed_at: new Date().toISOString(),
    })
    .eq('id', deliveryId)
    .eq('status', 'sent')
}

export async function markDocumentSigned(deliveryId: string): Promise<void> {
  const supabase = createBrowserSupabaseClient()
  await supabase
    .from('document_deliveries')
    .update({
      status: 'signed',
      signed_at: new Date().toISOString(),
    })
    .eq('id', deliveryId)
    .in('status', ['sent', 'viewed', 'delivered'])
}

export async function getUnreadDocumentCount(driverId: string): Promise<number> {
  const supabase = createBrowserSupabaseClient()
  const { count, error } = await supabase
    .from('document_deliveries')
    .select('id', { count: 'exact', head: true })
    .eq('driver_id', driverId)
    .eq('status', 'sent')

  if (error) return 0
  return count ?? 0
}

export const SEND_TYPE_LABELS: Record<DocumentSendType, string> = {
  registration: '기사 등록 계약',
  renewal: '갱신',
  amendment: '계약 변경',
  general: '일반 문서',
  education: '교육 자료',
}

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  sent: '발송',
  delivered: '전달',
  viewed: '열람',
  signed: '서명 완료',
  rejected: '거절',
}

export const DELIVERY_STATUS_COLORS: Record<DeliveryStatus, string> = {
  sent: 'blue',
  delivered: 'cyan',
  viewed: 'orange',
  signed: 'green',
  rejected: 'red',
}

export const SEND_METHOD_LABELS: Record<SendMethod, string> = {
  push: '푸시 알림',
  sms: 'SMS',
  both: '푸시 + SMS',
}
