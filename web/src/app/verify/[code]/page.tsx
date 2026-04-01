'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

/**
 * 계약서 진위확인 공개 페이지
 * /verify/{인증코드} 또는 /verify 에서 수동 입력
 */

interface VerifyResult {
  valid: boolean
  documentNumber: string | null
  title: string | null
  status: string | null
  signerName: string | null
  signedAt: string | null
  contentHashMatch: boolean
  pdfHashMatch: boolean
  timestampHashMatch: boolean
  message: string
}

export default function VerifyPage() {
  const params = useParams<{ code: string }>()
  const [code, setCode] = useState(params.code ?? '')
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleVerify = async (verificationCode?: string) => {
    const target = (verificationCode ?? code).toUpperCase().trim()
    if (!target || target.length !== 8) {
      setError('8자리 인증코드를 입력해주세요.')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationCode: target }),
      })
      const json = await res.json()
      if (json.data) {
        setResult(json.data)
      } else {
        setError(json.error ?? '확인에 실패했습니다.')
      }
    } catch {
      setError('서버 연결에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (params.code && params.code.length === 8) {
      handleVerify(params.code)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code])

  const maskName = (name: string) => {
    if (name.length <= 1) return '*'
    if (name.length === 2) return name[0] + '*'
    return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1]
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#e4e6f0', marginBottom: '0.25rem' }}>
            <span style={{ color: '#74c0fc' }}>logiSSign</span>
          </div>
          <p style={{ color: '#8b8fa3', fontSize: '0.9rem' }}>전자계약서 진위확인</p>
        </div>

        {/* Input Card */}
        <div style={{
          background: '#1a1d27', border: '1px solid #2e3142', borderRadius: 16,
          padding: '2rem', marginBottom: '1.5rem',
        }}>
          <label style={{ display: 'block', fontSize: '0.82rem', color: '#8b8fa3', marginBottom: '0.5rem', fontWeight: 500 }}>
            인증코드 입력
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
              placeholder="8자리 인증코드"
              maxLength={8}
              style={{
                flex: 1, height: 48, padding: '0 1rem', borderRadius: 12,
                background: '#242736', border: '1px solid #2e3142', color: '#e4e6f0',
                fontSize: '1.1rem', fontFamily: 'monospace', letterSpacing: '0.15em',
                textAlign: 'center', outline: 'none',
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
            />
            <button
              onClick={() => handleVerify()}
              disabled={loading || code.length !== 8}
              style={{
                height: 48, padding: '0 1.5rem', borderRadius: 12,
                background: loading ? '#2e3142' : '#74c0fc', color: '#0f1117',
                fontWeight: 600, fontSize: '0.9rem', border: 'none', cursor: 'pointer',
                opacity: code.length !== 8 ? 0.5 : 1,
              }}
            >
              {loading ? '확인 중...' : '확인'}
            </button>
          </div>
          {error && (
            <p style={{ marginTop: '0.75rem', color: '#ff6b6b', fontSize: '0.82rem' }}>{error}</p>
          )}
          <p style={{ marginTop: '0.75rem', color: '#8b8fa3', fontSize: '0.75rem' }}>
            계약서 하단 또는 감사추적인증서에 기재된 인증코드를 입력하세요.
          </p>
        </div>

        {/* Result */}
        {result && (
          <div style={{
            background: '#1a1d27', border: `1px solid ${result.valid ? '#1b4a20' : '#4a2020'}`,
            borderRadius: 16, padding: '2rem', overflow: 'hidden',
          }}>
            {/* Status Banner */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem',
              padding: '1rem', borderRadius: 12,
              background: result.valid ? 'rgba(105, 219, 124, 0.08)' : 'rgba(255, 107, 107, 0.08)',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem',
                background: result.valid ? 'rgba(105, 219, 124, 0.15)' : 'rgba(255, 107, 107, 0.15)',
              }}>
                {result.valid ? '✓' : '✗'}
              </div>
              <div>
                <div style={{
                  fontWeight: 700, fontSize: '1.1rem',
                  color: result.valid ? '#69db7c' : '#ff6b6b',
                }}>
                  {result.valid ? '유효한 전자계약서' : '확인 실패'}
                </div>
                <div style={{ color: '#8b8fa3', fontSize: '0.82rem' }}>{result.message}</div>
              </div>
            </div>

            {result.valid && (
              <>
                {/* Document Info */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <Row label="문서번호" value={result.documentNumber ?? '-'} mono />
                  <Row label="계약서명" value={result.title ?? '-'} />
                  <Row label="서명자" value={result.signerName ? maskName(result.signerName) : '-'} />
                  <Row label="서명일시" value={result.signedAt ? new Date(result.signedAt).toLocaleString('ko-KR') : '-'} />
                  <Row label="상태" value={result.status === 'signed' ? '서명 완료' : (result.status ?? '-')} />
                </div>

                {/* Hash Verification */}
                <div style={{
                  background: '#242736', borderRadius: 12, padding: '1rem',
                  marginBottom: '0.5rem',
                }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#8b8fa3', marginBottom: '0.75rem' }}>
                    무결성 검증
                  </div>
                  <CheckRow label="문서 내용 해시" ok={result.contentHashMatch} />
                  <CheckRow label="서명 PDF 해시" ok={result.pdfHashMatch} />
                  <CheckRow label="타임스탬프 해시" ok={result.timestampHashMatch} />
                </div>
              </>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '2rem', color: '#8b8fa3', fontSize: '0.72rem' }}>
          <p>logiSSign 전자계약 진위확인 시스템</p>
          <p style={{ marginTop: '0.25rem' }}>이 페이지는 계약서의 진위를 확인하기 위한 공개 페이지입니다.</p>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0',
      borderBottom: '1px solid #2e314220',
    }}>
      <span style={{ color: '#8b8fa3', fontSize: '0.82rem' }}>{label}</span>
      <span style={{
        color: '#e4e6f0', fontSize: '0.82rem', fontWeight: 500,
        fontFamily: mono ? 'monospace' : 'inherit',
      }}>{value}</span>
    </div>
  )
}

function CheckRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      marginBottom: '0.4rem',
    }}>
      <span style={{
        width: 18, height: 18, borderRadius: '50%', display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem',
        background: ok ? 'rgba(105, 219, 124, 0.15)' : 'rgba(255, 107, 107, 0.15)',
        color: ok ? '#69db7c' : '#ff6b6b',
      }}>
        {ok ? '✓' : '—'}
      </span>
      <span style={{ color: '#e4e6f0', fontSize: '0.8rem' }}>{label}</span>
      <span style={{
        marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 600,
        color: ok ? '#69db7c' : '#8b8fa3',
      }}>
        {ok ? '검증됨' : '미확인'}
      </span>
    </div>
  )
}
