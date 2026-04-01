import { createBrowserSupabaseClient } from '@/lib/supabase'

/**
 * 문서 전송 통합 서비스
 *
 * 3가지 전송 시나리오:
 * 1. 기사 등록시 → 계약서 자동 전송 (contract.service.ts 연동)
 * 2. 재계약시   → 갱신 계약서 + 변경된 조건 전송
 * 3. 상시 전송  → 대리점이 업로드한 문서를 선택한 기사에게 전송
 *
 * 전송 방법:
 * - 앱 푸시 알림 (Expo Push)
 * - SMS 알림 (Solapi)
 * - 앱 내 문서함 (driver_documents / document_deliveries 테이블)
 */

/* ══════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════ */

export type SendMethod = 'push' | 'sms' | 'both'

export type DocumentSendType =
  | 'registration'    // 기사 등록시 계약서
  | 'renewal'         // 재계약 서류
  | 'amendment'       // 계약 변경 서류
  | 'general'         // 상시 문서 전송 (공지, 안내문 등)
  | 'education'       // 안전교육 등

export type DeliveryStatus = 'sent' | 'delivered' | 'viewed' | 'signed' | 'rejected'

export interface DocumentDelivery {
  id: string
  agency_id: string
  document_file_id: string | null   // document_files 테이블 연동 (업로드 문서)
  contract_id: string | null        // contracts 테이블 연동 (계약서)
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
  documentFileId?: string    // 업로드 문서 전송 시
  contractId?: string        // 계약서 전송 시
  requireSign?: boolean      // 서명 필요 여부
}

export interface SendResult {
  total: number
  pushSent: number
  smsSent: number
  failed: number
  deliveryIds: string[]
  error: string | null
}

/* ══════════════════════════════════════════════
   문서 전송 (통합)
   ══════════════════════════════════════════════ */

export async function sendDocuments(
  params: SendDocumentParams
): Promise<SendResult> {
  const {
    agencyId,
    driverIds,
    sendType,
    sendMethod,
    title,
    message,
    documentFileId,
    contractId,
  } = params

  if (driverIds.length === 0) {
    return { total: 0, pushSent: 0, smsSent: 0, failed: 0, deliveryIds: [], error: null }
  }

  const supabase = createBrowserSupabaseClient()

  // 1. 수신 기사 정보 조회 (push_token, phone)
  const { data: drivers, error: driverErr } = await supabase
    .from('drivers')
    .select('id, name, phone, push_token')
    .in('id', driverIds)

  if (driverErr || !drivers) {
    return { total: 0, pushSent: 0, smsSent: 0, failed: 0, deliveryIds: [], error: driverErr?.message ?? '기사 조회 실패' }
  }

  // 2. document_deliveries 레코드 생성
  const deliveryRows = drivers.map((d) => ({
    agency_id: agencyId,
    document_file_id: documentFileId ?? null,
    contract_id: contractId ?? null,
    driver_id: d.id,
    send_type: sendType,
    send_method: sendMethod,
    title,
    message: message ?? null,
    status: 'sent' as const,
    sent_at: new Date().toISOString(),
  }))

  const { data: deliveries, error: insertErr } = await supabase
    .from('document_deliveries')
    .insert(deliveryRows)
    .select('id')

  if (insertErr) {
    return { total: 0, pushSent: 0, smsSent: 0, failed: 0, deliveryIds: [], error: insertErr.message }
  }

  const deliveryIds = (deliveries ?? []).map((d) => d.id)

  // 3. document_files의 recipients / status 업데이트
  if (documentFileId) {
    await supabase
      .from('document_files')
      .update({
        recipients: driverIds,
        status: 'sent',
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentFileId)
  }

  // 4. 푸시 알림 발송
  let pushSent = 0
  if (sendMethod === 'push' || sendMethod === 'both') {
    const pushTargets = drivers.filter((d) => d.push_token)
    if (pushTargets.length > 0) {
      const pushMessages = pushTargets.map((d) => ({
        to: d.push_token as string,
        title: getSendTypeIcon(sendType) + ' ' + title,
        body: message ?? getDefaultMessage(sendType, title),
        sound: 'default' as const,
        data: {
          type: sendType === 'renewal' || sendType === 'registration' ? 'contract' : 'document',
          id: contractId ?? documentFileId ?? '',
          deliveryId: deliveryIds[drivers.indexOf(d)] ?? '',
        },
        channelId: 'default',
      }))

      try {
        // Expo Push API (100건씩 배치)
        for (let i = 0; i < pushMessages.length; i += 100) {
          const batch = pushMessages.slice(i, i + 100)
          const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(batch),
          })
          if (response.ok) pushSent += batch.length
        }
      } catch (err) {
        console.warn('[DocumentSend] Push 발송 오류:', err)
      }
    }
  }

  // 5. SMS 발송 — 비활성 (푸시 알림으로 대체)
  const smsSent = 0
  // SMS는 비용 절감을 위해 기본 비활성.
  // 푸시 토큰이 없는 기사에게만 필요 시 수동 발송.

  const failed = driverIds.length - Math.max(pushSent, smsSent)

  return {
    total: driverIds.length,
    pushSent,
    smsSent,
    failed: Math.max(0, failed),
    deliveryIds,
    error: null,
  }
}

/* ══════════════════════════════════════════════
   재계약 전송
   ══════════════════════════════════════════════ */

export interface RenewalSendParams {
  agencyId: string
  driverIds: string[]
  templateIds: string[]          // 재계약 계약서 템플릿
  bindingDataMap: Record<string, Record<string, string>>  // driverId → bindingData
  sendMethod: SendMethod
  effectiveDate?: string
  message?: string
}

/**
 * 재계약 서류 일괄 전송
 * 1. 기사별로 계약서 생성 (createAndSendContracts)
 * 2. document_deliveries 기록
 * 3. 푸시 + SMS 알림
 */
export async function sendRenewalDocuments(
  params: RenewalSendParams
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

      // 1. 계약서 생성 + 전송
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
        failed++
        continue
      }

      const result = await response.json()
      const contractId = result.contractIds?.[0] ?? null

      // 2. document_deliveries 기록
      await sendDocuments({
        agencyId,
        driverIds: [driverId],
        sendType: 'renewal',
        sendMethod,
        title: '재계약 서류',
        message: message ?? '재계약 서류가 도착했습니다. 확인 후 서명해주세요.',
        contractId,
      })

      sent++
    } catch {
      failed++
    }
  }

  return { sent, failed, error: null }
}

/* ══════════════════════════════════════════════
   문서 배달 상태 조회 / 업데이트
   ══════════════════════════════════════════════ */

/** 대리점: 문서 배달 현황 조회 */
export async function getDocumentDeliveries(
  agencyId: string,
  filters?: {
    documentFileId?: string
    contractId?: string
    sendType?: DocumentSendType
    status?: DeliveryStatus
  }
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

/** 기사: 내 문서함 조회 */
export async function getDriverDocumentDeliveries(
  driverId: string
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

/** 기사: 문서 열람 처리 */
export async function markDocumentViewed(deliveryId: string): Promise<void> {
  const supabase = createBrowserSupabaseClient()
  await supabase
    .from('document_deliveries')
    .update({
      status: 'viewed',
      viewed_at: new Date().toISOString(),
    })
    .eq('id', deliveryId)
    .eq('status', 'sent')  // sent 상태에서만 viewed로 변경
}

/** 기사: 문서 서명 처리 */
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

/** 기사: 미확인 문서 수 */
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

/* ══════════════════════════════════════════════
   헬퍼
   ══════════════════════════════════════════════ */

function getSendTypeIcon(type: DocumentSendType): string {
  switch (type) {
    case 'registration': return '\uD83D\uDCDD'  // 📝
    case 'renewal': return '\uD83D\uDD04'        // 🔄
    case 'amendment': return '\u26A0\uFE0F'       // ⚠️
    case 'general': return '\uD83D\uDCC4'        // 📄
    case 'education': return '\uD83D\uDCDA'      // 📚
    default: return '\uD83D\uDCC4'               // 📄
  }
}

function getDefaultMessage(type: DocumentSendType, title: string): string {
  switch (type) {
    case 'registration':
      return '계약서가 도착했습니다. 확인 후 서명해주세요.'
    case 'renewal':
      return '재계약 서류가 도착했습니다. 확인 후 서명해주세요.'
    case 'amendment':
      return '계약 변경 서류가 도착했습니다. 확인해주세요.'
    case 'general':
      return `"${title}" 문서가 도착했습니다. 확인해주세요.`
    case 'education':
      return '교육 자료가 도착했습니다. 확인해주세요.'
    default:
      return '새 문서가 도착했습니다.'
  }
}

/* ══════════════════════════════════════════════
   전송 타입 라벨
   ══════════════════════════════════════════════ */

export const SEND_TYPE_LABELS: Record<DocumentSendType, string> = {
  registration: '기사 등록 계약',
  renewal: '재계약',
  amendment: '계약 변경',
  general: '일반 문서',
  education: '교육 자료',
}

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  sent: '발송됨',
  delivered: '전달됨',
  viewed: '열람',
  signed: '서명완료',
  rejected: '거부',
}

export const DELIVERY_STATUS_COLORS: Record<DeliveryStatus, string> = {
  sent: 'blue',
  delivered: 'cyan',
  viewed: 'orange',
  signed: 'green',
  rejected: 'red',
}

export const SEND_METHOD_LABELS: Record<SendMethod, string> = {
  push: '앱 푸시',
  sms: 'SMS',
  both: '푸시 + SMS',
}
