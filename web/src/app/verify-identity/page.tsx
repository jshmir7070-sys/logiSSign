'use client'

import { useEffect, useState } from 'react'

type VerifyStatus = 'idle' | 'running' | 'success' | 'error'

export default function VerifyIdentityPage() {
  const [status, setStatus] = useState<VerifyStatus>('idle')
  const [message, setMessage] = useState('본인인증을 준비하고 있습니다.')
  const [identityVerificationId, setIdentityVerificationId] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    setIdentityVerificationId(params.get('id')?.trim() ?? '')
  }, [])

  useEffect(() => {
    async function runVerification() {
      const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID
      const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY

      if (!identityVerificationId) {
        setStatus('error')
        setMessage('본인인증 요청 정보가 없습니다.')
        return
      }

      if (!storeId || !channelKey) {
        setStatus('error')
        setMessage('PortOne 본인인증 설정이 누락되었습니다.')
        return
      }

      try {
        setStatus('running')
        setMessage('본인인증 창을 여는 중입니다.')

        const PortOne = await import('@portone/browser-sdk/v2')
        const result = await PortOne.requestIdentityVerification({
          storeId,
          channelKey,
          identityVerificationId,
        })

        if (!result || result.code) {
          throw new Error(result?.message ?? '본인인증이 취소되었거나 실패했습니다.')
        }

        setStatus('success')
        setMessage('본인인증이 완료되었습니다. 앱으로 돌아가 주세요.')

        window.setTimeout(() => {
          window.close()
        }, 800)
      } catch (error) {
        setStatus('error')
        setMessage(error instanceof Error ? error.message : '본인인증 처리 중 오류가 발생했습니다.')
      }
    }

    if (identityVerificationId) {
      void runVerification()
    }
  }, [identityVerificationId])

  return (
    <div className="min-h-screen bg-surface px-6 py-12">
      <div className="mx-auto flex min-h-[60vh] max-w-[520px] items-center justify-center">
        <div className="w-full rounded-3xl bg-surface-container-lowest p-8 text-center shadow-ambient">
          <div
            className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ${
              status === 'success'
                ? 'bg-tertiary/10 text-tertiary'
                : status === 'error'
                  ? 'bg-error/10 text-error'
                  : 'bg-primary/10 text-primary'
            }`}
          >
            {status === 'success' ? '완료' : status === 'error' ? '오류' : '진행'}
          </div>
          <h1 className="font-headline text-[24px] font-bold text-on-surface">대표자 본인인증</h1>
          <p className="mt-3 text-sm leading-6 text-on-surface-variant font-korean">{message}</p>
          {status !== 'success' ? (
            <p className="mt-4 text-xs text-on-surface-variant font-korean">
              인증이 끝나면 결과를 자동으로 확인합니다.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
