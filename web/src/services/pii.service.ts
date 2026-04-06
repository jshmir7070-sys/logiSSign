/**
 * PII 암호화/복호화 서비스
 *
 * DB 저장 전 encrypt, 조회 후 decrypt를 일괄 처리합니다.
 * 개인정보보호법 제29조 (안전조치 의무) 준수
 */

import { encryptPii, decryptPii, encryptPiiFields, decryptPiiFields } from '@/lib/crypto'

// ── 암호화 대상 PII 필드 정의 ──

/** drivers 테이블 암호화 대상 */
export const DRIVER_PII_FIELDS = ['bank_account', 'birth_date'] as const

/** agencies 테이블 암호화 대상 */
export const AGENCY_PII_FIELDS = ['bank_account', 'owner_birth_date'] as const

// ── Driver PII ──

export async function encryptDriverPii<T extends Record<string, unknown>>(driver: T): Promise<T> {
  return encryptPiiFields(driver, DRIVER_PII_FIELDS as unknown as (keyof T)[])
}

export async function decryptDriverPii<T extends Record<string, unknown>>(driver: T): Promise<T> {
  return decryptPiiFields(driver, DRIVER_PII_FIELDS as unknown as (keyof T)[])
}

export async function decryptDriverList<T extends Record<string, unknown>>(drivers: T[]): Promise<T[]> {
  return Promise.all(drivers.map(d => decryptDriverPii(d)))
}

// ── Agency PII ──

export async function encryptAgencyPii<T extends Record<string, unknown>>(agency: T): Promise<T> {
  return encryptPiiFields(agency, AGENCY_PII_FIELDS as unknown as (keyof T)[])
}

export async function decryptAgencyPii<T extends Record<string, unknown>>(agency: T): Promise<T> {
  return decryptPiiFields(agency, AGENCY_PII_FIELDS as unknown as (keyof T)[])
}

// ── 단일 필드 ──

export { encryptPii, decryptPii }
