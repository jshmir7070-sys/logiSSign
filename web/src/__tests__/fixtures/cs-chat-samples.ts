/**
 * CS 챗봇 평가용 샘플 입력 — 20개.
 *
 * 분류 분포:
 * - 정형 카테고리 (캔드 응답): payment 3, contract 3, settlement 3, driver 2, plan 2, account 2 = 15
 * - LLM 폴백 카테고리: bug 2, feedback 1, other 2 = 5
 *
 * 각 샘플은 detectCategory가 정확히 분류해야 하는 텍스트 + 기대 카테고리 + 평가 시 확인할 핵심 포인트
 */

import type { CsCategory } from '@/lib/cs-chat'

export interface CsChatSample {
  id: string
  message: string
  expectedCategory: CsCategory
  /** LLM 응답 평가 시 포함되어야 하는 키워드 (최소 한 개) */
  shouldIncludeAny?: string[]
  /** LLM 응답 평가 시 절대 포함되면 안 되는 키워드 */
  shouldNotInclude?: string[]
}

export const CS_CHAT_FIXTURES: CsChatSample[] = [
  // ── payment ──
  {
    id: 'payment-card-fail',
    message: '카드 결제가 자꾸 실패해요. 어떻게 해야 하나요?',
    expectedCategory: 'payment',
  },
  {
    id: 'payment-refund',
    message: '환불 요청은 어떻게 진행하나요?',
    expectedCategory: 'payment',
  },
  {
    id: 'payment-virtual-account',
    message: '가상계좌로 입금했는데 반영이 안 됐어요.',
    expectedCategory: 'payment',
  },

  // ── contract ──
  {
    id: 'contract-resend',
    message: '기사가 계약서를 못 받았다고 해요. 재발송 가능한가요?',
    expectedCategory: 'contract',
  },
  {
    id: 'contract-template',
    message: '계약서 템플릿을 새로 만들고 싶습니다.',
    expectedCategory: 'contract',
  },
  {
    id: 'contract-expiry',
    message: '만료된 계약을 연장할 수 있나요?',
    expectedCategory: 'contract',
  },

  // ── settlement ──
  {
    id: 'settlement-excel-upload',
    message: '운송사에서 받은 엑셀을 업로드하니 단가가 안 맞습니다.',
    expectedCategory: 'settlement',
  },
  {
    id: 'settlement-rules',
    message: '거래처별 정산 단가는 어디서 설정하나요?',
    expectedCategory: 'settlement',
  },
  {
    id: 'settlement-tax-invoice',
    message: '세금계산서가 자동으로 발행되나요?',
    expectedCategory: 'settlement',
  },

  // ── driver ──
  {
    id: 'driver-app-link',
    message: '기사 앱 연동이 안 됩니다.',
    expectedCategory: 'driver',
  },
  {
    id: 'driver-invite',
    message: '배달 기사를 초대하려면 어떻게 하나요?',
    expectedCategory: 'driver',
  },

  // ── plan ──
  {
    id: 'plan-upgrade',
    message: 'Pro 플랜으로 업그레이드하면 비용이 어떻게 되나요?',
    expectedCategory: 'plan',
  },
  {
    id: 'plan-driver-limit',
    message: '기사 수 한도를 초과하면 어떻게 되나요?',
    expectedCategory: 'plan',
  },

  // ── account ──
  {
    id: 'account-password',
    message: '비밀번호를 잊어버렸어요.',
    expectedCategory: 'account',
  },
  {
    id: 'account-admin',
    message: '관리자 계정을 추가하고 싶습니다.',
    expectedCategory: 'account',
  },

  // ── bug (LLM fallback) ──
  {
    id: 'bug-pdf-broken',
    message: '정산서 PDF를 다운로드하니 화면이 깨져 있어요. 어디서 확인해야 하나요?',
    expectedCategory: 'bug',
    shouldIncludeAny: ['정산', 'PDF', '확인'],
    shouldNotInclude: ['죄송합니다 도와드릴 수 없습니다'],
  },
  {
    id: 'bug-app-crash',
    message: '앱이 자꾸 꺼져요. 안드로이드 11 입니다.',
    expectedCategory: 'bug',
    shouldIncludeAny: ['확인', '앱', '버전'],
  },

  // ── feedback (LLM fallback) ──
  {
    id: 'feedback-bulk-export',
    message: '정산서를 한 번에 ZIP으로 다운로드 받는 기능이 있으면 좋겠어요.',
    expectedCategory: 'feedback',
    shouldIncludeAny: ['감사', '검토', '반영', '의견'],
  },

  // ── other (LLM fallback) ──
  {
    id: 'other-ambiguous',
    message: '이거 어떻게 하는지 모르겠는데 도와주세요.',
    expectedCategory: 'other',
    shouldIncludeAny: ['상세', '카테고리', '문의', '안내'],
  },
  {
    id: 'other-vague',
    message: '뭐가 잘 안되는 것 같아요.',
    expectedCategory: 'other',
    shouldIncludeAny: ['상세', '확인', '카테고리'],
  },
]
