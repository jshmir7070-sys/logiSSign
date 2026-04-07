export type AgencyPaymentMethod = 'CARD' | 'EASY_PAY' | 'TRANSFER' | 'VIRTUAL_ACCOUNT'

export type AgencyEasyPayProvider = 'KAKAOPAY' | 'NAVERPAY' | 'TOSSPAY' | 'PAYCO'

export interface PaymentMethodOption {
  value: AgencyPaymentMethod
  label: string
  description: string
}

export interface EasyPayProviderOption {
  value: AgencyEasyPayProvider
  label: string
}

export interface VirtualAccountBankOption {
  value: string
  label: string
}

export const PAYMENT_METHOD_OPTIONS: PaymentMethodOption[] = [
  {
    value: 'CARD',
    label: '카드 일시불',
    description: '신용카드 또는 체크카드로 즉시 승인되는 1회성 결제입니다.',
  },
  {
    value: 'EASY_PAY',
    label: '간편결제',
    description: '카카오페이, 네이버페이, 토스페이, PAYCO로 결제합니다.',
  },
  {
    value: 'TRANSFER',
    label: '계좌이체',
    description: '실시간 계좌이체로 바로 결제합니다.',
  },
  {
    value: 'VIRTUAL_ACCOUNT',
    label: '가상계좌',
    description: '발급된 계좌로 입금하면 결제 상태가 자동으로 반영됩니다.',
  },
]

export const EASY_PAY_PROVIDER_OPTIONS: EasyPayProviderOption[] = [
  { value: 'KAKAOPAY', label: '카카오페이' },
  { value: 'NAVERPAY', label: '네이버페이' },
  { value: 'TOSSPAY', label: '토스페이' },
  { value: 'PAYCO', label: 'PAYCO' },
]

export const VIRTUAL_ACCOUNT_BANK_OPTIONS: VirtualAccountBankOption[] = [
  { value: 'KOOKMIN_BANK', label: 'KB국민은행' },
  { value: 'SHINHAN_BANK', label: '신한은행' },
  { value: 'WOORI_BANK', label: '우리은행' },
  { value: 'HANA_BANK', label: '하나은행' },
  { value: 'KAKAO_BANK', label: '카카오뱅크' },
  { value: 'TOSS_BANK', label: '토스뱅크' },
]

export function getAgencyPaymentMethodLabel(method: string | null | undefined): string {
  const option = PAYMENT_METHOD_OPTIONS.find((item) => item.value === method)
  return option?.label ?? method ?? '-'
}

export function getEasyPayProviderLabel(provider: string | null | undefined): string {
  const option = EASY_PAY_PROVIDER_OPTIONS.find((item) => item.value === provider)
  return option?.label ?? provider ?? '-'
}
