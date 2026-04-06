'use client'

import { BillingKeyMethod, PayMethod } from '@portone/browser-sdk/v2'
import type { Bank, PaymentRequest, PaymentResponse } from '@portone/browser-sdk/v2'

import type { AgencyEasyPayProvider, AgencyPaymentMethod } from '@/lib/payment-methods'

export interface RequestAgencyPaymentParams {
  paymentId: string
  orderName: string
  amount: number
  method: AgencyPaymentMethod
  customer: {
    customerId: string
    fullName?: string
    email?: string
    phoneNumber?: string
  }
  easyPayProvider?: AgencyEasyPayProvider
  virtualAccountBankCode?: string
  redirectUrl?: string
}

export interface RequestAgencyBillingKeyParams {
  issueId: string
  issueName: string
  customer: {
    customerId: string
    fullName?: string
    email?: string
    phoneNumber?: string
  }
}

function getStoreId(): string {
  return process.env.NEXT_PUBLIC_PORTONE_STORE_ID ?? ''
}

function getChannelKey(): string {
  return process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY ?? ''
}

function assertPortoneConfig() {
  const storeId = getStoreId()
  const channelKey = getChannelKey()

  if (!storeId || !channelKey) {
    throw new Error('PortOne 결제 설정이 누락되었습니다.')
  }

  return { storeId, channelKey }
}

function buildPaymentRequest(params: RequestAgencyPaymentParams): PaymentRequest {
  const { storeId, channelKey } = assertPortoneConfig()

  const baseRequest: PaymentRequest = {
    storeId,
    channelKey,
    paymentId: params.paymentId,
    orderName: params.orderName,
    totalAmount: params.amount,
    currency: 'KRW',
    payMethod: PayMethod[params.method],
    customer: params.customer,
    redirectUrl: params.redirectUrl,
  }

  if (params.method === 'CARD') {
    return {
      ...baseRequest,
      card: {
        useInstallment: false,
      },
    }
  }

  if (params.method === 'EASY_PAY') {
    if (!params.easyPayProvider) {
      throw new Error('간편결제 수단을 선택해 주세요.')
    }

    return {
      ...baseRequest,
      easyPay: {
        easyPayProvider: params.easyPayProvider,
        useInstallment: false,
      },
    }
  }

  if (params.method === 'TRANSFER') {
    return {
      ...baseRequest,
      transfer: {},
    }
  }

  return {
    ...baseRequest,
    virtualAccount: {
      bankCode: params.virtualAccountBankCode as Bank | undefined,
      accountExpiry: {
        validHours: 24,
      },
    },
  }
}

export async function requestAgencyPayment(
  params: RequestAgencyPaymentParams,
): Promise<PaymentResponse> {
  const PortOne = (await import('@portone/browser-sdk/v2')).default
  const request = buildPaymentRequest(params)
  const result = await PortOne.requestPayment(request)

  if (!result) {
    throw new Error('결제 결과를 확인하지 못했습니다.')
  }

  if (result.code) {
    throw new Error(result.message ?? result.code)
  }

  return result
}

export async function requestAgencyBillingKey(
  params: RequestAgencyBillingKeyParams,
): Promise<{
  billingKey: string
  cardName?: string
  cardNumberMasked?: string
}> {
  const { storeId, channelKey } = assertPortoneConfig()
  const { requestIssueBillingKey } = await import('@portone/browser-sdk/v2')

  const result = await requestIssueBillingKey({
    storeId,
    channelKey,
    billingKeyMethod: BillingKeyMethod.CARD,
    issueId: params.issueId,
    issueName: params.issueName,
    customer: params.customer,
  })

  if (!result) {
    throw new Error('카드 등록 결과를 확인하지 못했습니다.')
  }

  if (result.code || !result.billingKey) {
    throw new Error(result.message ?? result.code ?? '카드 등록에 실패했습니다.')
  }

  return {
    billingKey: result.billingKey,
    cardName: undefined,
    cardNumberMasked: undefined,
  }
}
