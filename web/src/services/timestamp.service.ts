/**
 * 공인 타임스탬프 서비스 (전자문서법 준수)
 *
 * 전자서명의 부인방지를 위해 신뢰할 수 있는 제3자 시간 증명을 제공합니다.
 *
 * 현재: 자체 HMAC 기반 타임스탬프 (Phase 1)
 * 향후: KISA TSA 연동 (Phase 2 — RFC 3161 호환)
 *
 * TSA 연동 시 환경변수:
 *   TSA_URL=https://tsa.kisa.or.kr/tsa  (예시)
 *   TSA_AUTH_KEY=...
 */

interface TimestampResult {
  timestamp: string          // ISO 8601
  hash: string               // SHA-256 해시
  token: string              // 서명된 타임스탬프 토큰
  authority: 'self' | 'kisa' // 발급 기관
  error?: string
}

/**
 * 타임스탬프 토큰 생성
 * @param dataHash 서명할 데이터의 SHA-256 해시
 * @param documentNumber 문서 번호
 */
export async function createTimestamp(
  dataHash: string,
  documentNumber: string
): Promise<TimestampResult> {
  const timestamp = new Date().toISOString()
  const tsaUrl = process.env.TSA_URL

  // Phase 2: KISA TSA 연동 (RFC 3161)
  if (tsaUrl) {
    try {
      return await requestExternalTsa(tsaUrl, dataHash, timestamp, documentNumber)
    } catch (err) {
      console.error('[TSA] 외부 TSA 연동 실패, 자체 타임스탬프 사용:', err)
      // 폴백: 자체 타임스탬프
    }
  }

  // Phase 1: 자체 HMAC 타임스탬프 (기본)
  const payload = `${documentNumber}:${dataHash}:${timestamp}`
  const token = await hmacSign(payload)

  return {
    timestamp,
    hash: dataHash,
    token,
    authority: 'self',
  }
}

/**
 * 타임스탬프 검증
 */
export async function verifyTimestamp(
  dataHash: string,
  documentNumber: string,
  timestamp: string,
  token: string
): Promise<{ valid: boolean; authority: string }> {
  // Phase 1: 자체 검증
  const payload = `${documentNumber}:${dataHash}:${timestamp}`
  const expected = await hmacSign(payload)

  // 타이밍 세이프 비교
  if (token.length !== expected.length) return { valid: false, authority: 'self' }
  let mismatch = 0
  for (let i = 0; i < token.length; i++) {
    mismatch |= token.charCodeAt(i) ^ expected.charCodeAt(i)
  }

  return { valid: mismatch === 0, authority: 'self' }
}

// ── Internal HMAC ──

async function hmacSign(data: string): Promise<string> {
  const secret = process.env.TSA_HMAC_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// ── Phase 2: RFC 3161 TSA Request (준비용) ──

async function requestExternalTsa(
  tsaUrl: string,
  dataHash: string,
  timestamp: string,
  documentNumber: string
): Promise<TimestampResult> {
  const authKey = process.env.TSA_AUTH_KEY

  // RFC 3161 TimeStampReq 간소화 버전
  const response = await fetch(tsaUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/timestamp-query',
      ...(authKey ? { Authorization: `Bearer ${authKey}` } : {}),
    },
    body: JSON.stringify({
      hash: dataHash,
      hashAlgorithm: 'SHA-256',
      nonce: crypto.randomUUID(),
    }),
  })

  if (!response.ok) {
    throw new Error(`TSA 응답 오류: ${response.status}`)
  }

  const result = await response.json()

  return {
    timestamp,
    hash: dataHash,
    token: result.token || result.timeStampToken || '',
    authority: 'kisa',
  }
}
