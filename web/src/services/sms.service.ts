/**
 * Solapi SMS 발송 서비스
 *
 * 사용처:
 *  - 계약서 서명 요청 SMS
 *  - 정산서 미확인 재알림
 *  - 가입 시 OTP 본인확인
 *  - 문서 전송 알림
 *
 * 설정 필요:
 *  환경변수에 SOLAPI_API_KEY, SOLAPI_API_SECRET,
 *  SOLAPI_SENDER_PHONE 설정
 *
 * Solapi 가입: https://solapi.com
 * API 문서: https://docs.solapi.com
 */

interface SmsPayload {
  to: string        // 수신번호 (010-1234-5678 또는 01012345678)
  text: string      // 메시지 내용
  from?: string     // 발신번호 (미지정 시 환경변수 사용)
}

interface SmsResult {
  sent: boolean
  error: string | null
  messageId?: string
}

/** 발신번호에서 하이픈 제거 */
function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '')
}

/** Solapi HMAC-SHA256 인증 헤더 생성 */
async function getSolapiAuthHeader(apiKey: string, apiSecret: string): Promise<string> {
  const date = new Date().toISOString()
  // 12~64바이트 랜덤 salt
  const saltArray = new Uint8Array(16)
  crypto.getRandomValues(saltArray)
  const salt = Array.from(saltArray).map(b => b.toString(36)).join('').slice(0, 20)

  const hmacData = date + salt

  // Node.js crypto로 HMAC-SHA256 생성
  const { createHmac } = await import('crypto')
  const signature = createHmac('sha256', apiSecret)
    .update(hmacData)
    .digest('hex')

  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`
}

/**
 * SMS 단건 발송
 */
export async function sendSms(payload: SmsPayload): Promise<SmsResult> {
  const apiKey = process.env.SOLAPI_API_KEY
  const apiSecret = process.env.SOLAPI_API_SECRET
  const defaultSender = process.env.SOLAPI_SENDER_PHONE

  if (!apiKey || !apiSecret) {
    console.warn('[SMS] Solapi API 키 미설정 — SMS 발송 건너뜀')
    return { sent: false, error: 'SMS API 키 미설정' }
  }

  const from = normalizePhone(payload.from ?? defaultSender ?? '')
  const to = normalizePhone(payload.to)

  if (!from || !to) {
    return { sent: false, error: '발신/수신 번호 없음' }
  }

  try {
    const authHeader = await getSolapiAuthHeader(apiKey, apiSecret)

    const response = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
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
      const errText = await response.text()
      return { sent: false, error: `SMS 발송 실패: ${response.status} ${errText}` }
    }

    const result = await response.json()
    return { sent: true, error: null, messageId: result.messageId }
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : 'SMS 발송 실패' }
  }
}

/**
 * SMS 대량 발송
 */
export async function sendSmsBulk(
  messages: SmsPayload[]
): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0

  for (const msg of messages) {
    const result = await sendSms(msg)
    if (result.sent) sent++
    else failed++
  }

  return { sent, failed }
}

// ── 비즈니스 로직 헬퍼 ──

/** SMS 메시지용 문자열 sanitize (한글/영문/숫자/공백/기본 특수문자만 허용, 50자 제한) */
function sanitizeSmsText(text: string, maxLen: number = 50): string {
  return text.replace(/[^a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ\s.,!?()\-]/g, '').slice(0, maxLen)
}

/** 계약서 서명 요청 SMS */
export async function sendContractSignSms(
  driverPhone: string,
  contractTitle: string,
  signUrl?: string
): Promise<SmsResult> {
  const safeTitle = sanitizeSmsText(contractTitle)
  const text = signUrl
    ? `[로지사인] "${safeTitle}" 계약서가 도착했습니다. 앱에서 확인 후 서명해주세요.\n${signUrl}`
    : `[로지사인] "${safeTitle}" 계약서가 도착했습니다. 로지사인 앱에서 확인 후 서명해주세요.`

  return sendSms({ to: driverPhone, text })
}

/** 정산서 확인 요청 SMS (푸시 미수신 fallback) */
export async function sendSettlementReminderSms(
  driverPhone: string,
  yearMonth: string
): Promise<SmsResult> {
  return sendSms({
    to: driverPhone,
    text: `[로지사인] ${yearMonth} 정산서가 발행되었습니다. 로지사인 앱에서 확인해주세요.`,
  })
}

/** 문서 전송 알림 SMS */
export async function sendDocumentSms(
  driverPhone: string,
  documentTitle: string,
  viewUrl?: string
): Promise<SmsResult> {
  const safeTitle = sanitizeSmsText(documentTitle, 30)
  const text = viewUrl
    ? `[로지사인] "${safeTitle}" 문서가 도착했습니다. 확인해주세요.\n${viewUrl}`
    : `[로지사인] "${safeTitle}" 문서가 도착했습니다. 로지사인 앱에서 확인해주세요.`

  return sendSms({ to: driverPhone, text })
}

/** 기사 초대코드 + 앱 설치 링크 SMS */
export async function sendInviteCodeSms(
  driverPhone: string,
  driverName: string,
  inviteCode: string,
  agencyName: string,
): Promise<SmsResult> {
  const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.logissign.app'
  const APP_STORE = 'https://apps.apple.com/kr/app/logissign/id0000000000'

  const text =
    `[로지사인] ${driverName}님, ${agencyName}에서 초대합니다.\n\n` +
    `초대코드: ${inviteCode}\n\n` +
    `아래 링크에서 앱을 설치 후 초대코드로 가입해주세요.\n\n` +
    `▶ 안드로이드: ${PLAY_STORE}\n` +
    `▶ 아이폰: ${APP_STORE}`

  return sendSms({ to: driverPhone, text })
}

/** 재계약 안내 SMS */
export async function sendRenewalSms(
  driverPhone: string,
  driverName: string,
  contractEndDate: string
): Promise<SmsResult> {
  return sendSms({
    to: driverPhone,
    text: `[로지사인] ${driverName}님, 계약 만료일(${contractEndDate})이 다가옵니다. 재계약 관련 서류를 앱에서 확인해주세요.`,
  })
}
