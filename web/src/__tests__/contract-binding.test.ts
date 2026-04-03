import { describe, it, expect } from 'vitest'
import { bindContractVariables } from '@/services/contract.service'

describe('bindContractVariables', () => {
  it('단일 변수 치환', () => {
    const result = bindContractVariables('안녕하세요 {{기사명}}님', { 기사명: '홍길동' })
    expect(result).toBe('안녕하세요 홍길동님')
  })

  it('복수 변수 치환', () => {
    const template = '{{기사명}}님의 연락처: {{전화번호}}, 주소: {{주소}}'
    const result = bindContractVariables(template, {
      기사명: '김철수',
      전화번호: '010-1234-5678',
      주소: '서울시 강남구',
    })
    expect(result).toBe('김철수님의 연락처: 010-1234-5678, 주소: 서울시 강남구')
  })

  it('동일 변수 여러 번 등장', () => {
    const result = bindContractVariables('{{대리점명}} 소속 {{대리점명}}', { 대리점명: 'ABC대리점' })
    expect(result).toBe('ABC대리점 소속 ABC대리점')
  })

  it('없는 변수 → 원본 유지', () => {
    const result = bindContractVariables('{{기사명}}님, {{없는변수}}', { 기사명: '홍길동' })
    expect(result).toBe('홍길동님, {{없는변수}}')
  })

  it('빈 값 → 빈 문자열로 치환', () => {
    const result = bindContractVariables('주소: {{주소}}', { 주소: '' })
    expect(result).toBe('주소: ')
  })

  it('XSS 특수문자 이스케이프', () => {
    const result = bindContractVariables('{{기사명}}', { 기사명: '<script>alert("xss")</script>' })
    expect(result).not.toContain('<script>')
    expect(result).toContain('&lt;script&gt;')
  })

  it('& 문자 이스케이프', () => {
    const result = bindContractVariables('{{대리점명}}', { 대리점명: 'A&B 물류' })
    expect(result).toContain('&amp;')
  })

  it('" 문자 이스케이프', () => {
    const result = bindContractVariables('{{비고}}', { 비고: '"특이사항"' })
    expect(result).toContain('&quot;')
  })

  it('변수 없는 텍스트 → 원본 그대로', () => {
    const plain = '이것은 일반 텍스트입니다.'
    const result = bindContractVariables(plain, { 기사명: '홍길동' })
    expect(result).toBe(plain)
  })

  it('빈 데이터 객체 → 원본 유지', () => {
    const template = '{{기사명}}님 안녕하세요'
    const result = bindContractVariables(template, {})
    expect(result).toBe(template)
  })
})
