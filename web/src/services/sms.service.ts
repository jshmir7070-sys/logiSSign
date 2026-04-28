/**
 * Solapi SMS 발송 서비스
 * 사용처
 * - 계약서 서명 요청 알림
 * - 정산서 발행 알림
 * - 문서 전송 알림
 * - 기사 초대 코드 안내
 * - 계약 갱신 안내
 */

import { withRetry } from '@/lib/retry'

interface SmsPayload {
  to: string
  text: string
  from?: string
}

interface SmsResult {
  sent: boolean
  error: string | null
  messageId?: string
  /** 일시 오류로 재시도 가능 여부 (5xx, 네트워크). false면 영구 실패(잘못된 번호 등). */
  transient?: boolean
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '')
}

async function getSolapiAuthHeader(apiKey: string, apiSecret: string): Promise<string> {
  const date = new Date().toISOString()
  const saltArray = new Uint8Array(16)
  crypto.getRandomValues(saltArray)
  const salt = Array.from(saltArray)
    .map((value) => value.toString(36))
    .join('')
    .slice(0, 20)

  const { createHmac } = await import('crypto')
  const signature = createHmac('sha256', apiSecret).update(date + salt).digest('hex')

  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`
}

export async function sendSms(payload: SmsPayload): Promise<SmsResult> {
  const apiKey = process.env.SOLAPI_API_KEY
  const apiSecret = process.env.SOLAPI_API_SECRET
  const defaultSender = process.env.SOLAPI_SENDER_PHONE

  if (!apiKey || !apiSecret) {
    console.warn('[SMS] Solapi API key is not configured. SMS send skipped.')
    return { sent: false, error: 'SMS API 키가 설정되지 않았습니다.', transient: false }
  }

  const from = normalizePhone(payload.from ?? defaultSender ?? '')
  const to = normalizePhone(payload.to)

  if (!from || !to) {
    return { sent: false, error: '발신 또는 수신 번호가 비어 있습니다.', transient: false }
  }

  // 일시 오류(5xx, 네트워크 throw)는 자동 재시도, 4xx 영구 오류는 즉시 반환
  return withRetry<SmsResult>(
    async () => {
      try {
        const authHeader = await getSolapiAuthHeader(apiKey, apiSecret)
        const response = await fetch('https://api.solapi.com/messages/v4/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader,
          },
          body: JSON.stringify({
            message: {
              to,
              from,
              text: payload.text,
              type: 'SMS',
            },
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          return {
            sent: false,
            error: `SMS 발송 실패: ${response.status} ${errorText}`,
            transient: response.status >= 500,
          }
        }

        const result = await response.json()
        return { sent: true, error: null, messageId: result.messageId, transient: false }
      } catch (error) {
        // fetch가 던진 네트워크/타임아웃 오류는 일시 오류로 분류
        return {
          sent: false,
          error: error instanceof Error ? error.message : 'SMS 발송에 실패했습니다.',
          transient: true,
        }
      }
    },
    {
      maxAttempts: 3,
      initialDelayMs: 300,
      factor: 3,
      tag: 'solapi-sms',
      shouldRetry: (result) => {
        const r = result as SmsResult
        return !r.sent && r.transient === true
      },
    },
  )
}

export async function sendSmsBulk(messages: SmsPayload[]): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0

  for (const message of messages) {
    const result = await sendSms(message)
    if (result.sent) sent += 1
    else failed += 1
  }

  return { sent, failed }
}

function sanitizeSmsText(text: string, maxLen = 50): string {
  return text.replace(/[^a-zA-Z0-9가-힣\s.,!?()\-]/g, '').slice(0, maxLen)
}

export async function sendContractSignSms(
  driverPhone: string,
  contractTitle: string,
  signUrl?: string,
): Promise<SmsResult> {
  const safeTitle = sanitizeSmsText(contractTitle)
  const text = signUrl
    ? `[로지싸인] "${safeTitle}" 계약서가 도착했습니다. 앱에서 확인 후 서명해 주세요.\n${signUrl}`
    : `[로지싸인] "${safeTitle}" 계약서가 도착했습니다. 로지싸인 앱에서 확인 후 서명해 주세요.`

  return sendSms({ to: driverPhone, text })
}

export async function sendSettlementReminderSms(driverPhone: string, yearMonth: string): Promise<SmsResult> {
  return sendSms({
    to: driverPhone,
    text: `[로지싸인] ${yearMonth} 정산서가 발행되었습니다. 로지싸인 앱에서 확인해 주세요.`,
  })
}

export async function sendDocumentSms(
  driverPhone: string,
  documentTitle: string,
  viewUrl?: string,
): Promise<SmsResult> {
  const safeTitle = sanitizeSmsText(documentTitle, 30)
  const text = viewUrl
    ? `[로지싸인] "${safeTitle}" 문서가 도착했습니다. 확인해 주세요.\n${viewUrl}`
    : `[로지싸인] "${safeTitle}" 문서가 도착했습니다. 로지싸인 앱에서 확인해 주세요.`

  return sendSms({ to: driverPhone, text })
}

export async function sendInviteCodeSms(
  driverPhone: string,
  driverName: string,
  inviteCode: string,
  agencyName: string,
  driverCode?: string,
): Promise<SmsResult> {
  const playStore = 'https://play.google.com/store/apps/details?id=com.logissign.app'
  const appStore = 'https://apps.apple.com/kr/app/logissign/id0000000000'

  const text =
    `[로지싸인] ${driverName}님, ${agencyName}에서 초대가 도착했습니다.\n\n` +
    `초대코드: ${inviteCode}\n` +
    `${driverCode ? `기사 고유코드: ${driverCode}\n` : ''}\n` +
    `아래 링크에서 앱을 설치한 뒤 초대코드로 가입해 주세요.\n\n` +
    `안드로이드: ${playStore}\n` +
    `아이폰: ${appStore}`

  return sendSms({ to: driverPhone, text })
}

export async function sendRenewalSms(
  driverPhone: string,
  driverName: string,
  contractEndDate: string,
): Promise<SmsResult> {
  return sendSms({
    to: driverPhone,
    text: `[로지싸인] ${driverName}님의 계약 만료일이 ${contractEndDate}로 다가오고 있습니다. 갱신 관련 문서를 앱에서 확인해 주세요.`,
  })
}
