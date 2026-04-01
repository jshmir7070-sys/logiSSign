/**
 * 앱 전역 설정 상수
 * 하드코딩 값을 한 곳에서 관리. 환경변수 오버라이드 지원.
 */

// ── 세율 ──
/** 원천징수세율 (비사업자, 기본 3.3%) */
export const WITHHOLDING_TAX_RATE = parseFloat(process.env.NEXT_PUBLIC_WITHHOLDING_TAX_RATE ?? '0.033')

/** 부가세율 (기본 10%) */
export const VAT_RATE = parseFloat(process.env.NEXT_PUBLIC_VAT_RATE ?? '0.1')

// ── 계약 ──
/** 기본 계약 기간 (일) */
export const DEFAULT_CONTRACT_DAYS = parseInt(process.env.NEXT_PUBLIC_CONTRACT_DAYS ?? '365', 10)

/** 계약 만료 알림 사전 일수 */
export const RENEWAL_ALERT_DAYS = parseInt(process.env.NEXT_PUBLIC_RENEWAL_ALERT_DAYS ?? '60', 10)

/** 계약 서명 토큰 만료 (일) */
export const SIGN_TOKEN_EXPIRY_DAYS = parseInt(process.env.NEXT_PUBLIC_SIGN_TOKEN_EXPIRY_DAYS ?? '30', 10)

// ── 브랜드 ──
export const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'logiSSign'
export const BRAND_DOMAIN = process.env.NEXT_PUBLIC_BRAND_DOMAIN ?? 'logissign.com'

// ── 외부 서비스 ──
export const QR_API_URL = process.env.NEXT_PUBLIC_QR_API_URL ?? 'https://api.qrserver.com/v1/create-qr-code'

// ── 금액 계산 헬퍼 ──
/** 원 단위 절사 (정산용) */
export function roundWon(amount: number): number {
  return Math.round(amount)
}

/** 원천징수 계산 (원 단위 절사) */
export function calcWithholding(netAmount: number): number {
  return roundWon(netAmount * WITHHOLDING_TAX_RATE)
}

/** 부가세 계산 (원 단위 절사) */
export function calcVAT(supplyAmount: number): number {
  return roundWon(supplyAmount * VAT_RATE)
}
