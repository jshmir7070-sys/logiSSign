'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

const DaumPostcodeEmbed = dynamic(() => import('react-daum-postcode'), { ssr: false })

/* ══════════════════════════════════════════════
   주소 검색 컴포넌트 — react-daum-postcode
   ──────────────────────────────────────────────
   레이아웃:
   [우편번호         🔍]   ← 입력창 안쪽 우측에 돋보기
   [건물명/주소]           ← 자동 입력 (readOnly)
   [상세주소]              ← 주소 선택 후 펼쳐짐
   ══════════════════════════════════════════════ */

export interface AddressValue {
  zonecode: string
  address: string
  addressDetail: string
  fullAddress: string
  roadAddress: string
  jibunAddress: string
  buildingName: string
}

interface AddressSearchProps {
  value?: string
  detailValue?: string
  zonecodeValue?: string
  onChange: (address: AddressValue) => void
  label?: string
  required?: boolean
  disabled?: boolean
  className?: string
  /** true이면 우편번호·주소·상세주소를 한 행에 가로 배치 */
  inline?: boolean
}

const INPUT_CLS =
  'w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm font-korean'

export default function AddressSearch({
  value = '',
  detailValue = '',
  zonecodeValue = '',
  onChange,
  label = '주소',
  required = false,
  disabled = false,
  className = '',
  inline = false,
}: AddressSearchProps) {
  const [zonecode, setZonecode] = useState(zonecodeValue)
  const [address, setAddress] = useState(value)
  const [buildingName, setBuildingName] = useState('')
  const [roadAddress, setRoadAddress] = useState('')
  const [jibunAddress, setJibunAddress] = useState('')
  const [detail, setDetail] = useState(detailValue)
  const [showDetail, setShowDetail] = useState(!!value)
  const [showModal, setShowModal] = useState(false)

  const detailRef = useRef<HTMLInputElement>(null)

  // 외부 value 동기화
  useEffect(() => {
    if (value !== address) {
      setAddress(value)
      if (value) setShowDetail(true)
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (detailValue !== detail) setDetail(detailValue) }, [detailValue]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (zonecodeValue !== zonecode) setZonecode(zonecodeValue) }, [zonecodeValue]) // eslint-disable-line react-hooks/exhaustive-deps

  /** 부모에 값 전달 */
  const emitChange = useCallback(
    (addr: string, det: string, zc: string, road: string, jibun: string, bldg: string) => {
      const full = det ? `${addr} ${det}` : addr
      onChange({
        zonecode: zc,
        address: addr,
        addressDetail: det,
        fullAddress: full,
        roadAddress: road || addr,
        jibunAddress: jibun || addr,
        buildingName: bldg,
      })
    },
    [onChange]
  )

  /** 주소 선택 완료 콜백 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleComplete = useCallback((data: any) => {
    const addr = data.addressType === 'R' ? data.roadAddress : data.jibunAddress
    let extra = ''
    if (data.buildingName) {
      extra = data.bname
        ? ` (${data.bname}, ${data.buildingName})`
        : ` (${data.buildingName})`
    } else if (data.bname) {
      extra = ` (${data.bname})`
    }

    const fullAddr = addr + extra
    setZonecode(data.zonecode || '')
    setAddress(fullAddr)
    setBuildingName(data.buildingName || '')
    setRoadAddress(data.roadAddress || '')
    setJibunAddress(data.jibunAddress || '')
    setDetail('')
    setShowDetail(true)
    setShowModal(false)

    // 부모에 전달
    onChange({
      zonecode: data.zonecode || '',
      address: fullAddr,
      addressDetail: '',
      fullAddress: fullAddr,
      roadAddress: data.roadAddress || fullAddr,
      jibunAddress: data.jibunAddress || fullAddr,
      buildingName: data.buildingName || '',
    })

    // 상세주소로 포커스
    setTimeout(() => detailRef.current?.focus(), 200)
  }, [onChange])

  /** 주소 검색 모달 열기 */
  const openSearch = useCallback(() => {
    if (disabled) return
    setShowModal(true)
  }, [disabled])

  // ESC 키로 모달 닫기
  useEffect(() => {
    if (!showModal) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowModal(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [showModal])

  /** 상세주소 변경 시 부모에 전달 */
  const handleDetailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setDetail(val)
    emitChange(address, val, zonecode, roadAddress, jibunAddress, buildingName)
  }

  /** 상세주소 Enter */
  const handleDetailKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      emitChange(address, detail, zonecode, roadAddress, jibunAddress, buildingName)
    }
  }

  return (
    <div className={className}>
      {/* 라벨 */}
      <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-korean">
        {label}{required && <span className="text-error ml-0.5">*</span>}
      </label>

      {inline ? (
        /* ── 인라인 모드: 우편번호 | 주소 | 상세주소 한 행 ── */
        <div className="flex gap-2">
          {/* 우편번호 */}
          <div className="relative w-32 shrink-0">
            <input
              type="text"
              readOnly
              value={zonecode}
              placeholder="우편번호"
              onClick={openSearch}
              disabled={disabled}
              className={`w-full h-11 pl-4 pr-9 rounded-xl bg-surface-container-low text-on-surface text-sm font-data cursor-pointer placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
            <button
              type="button"
              onClick={openSearch}
              disabled={disabled}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant/60 hover:text-on-surface transition-colors disabled:opacity-50"
              aria-label="주소 검색"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </button>
          </div>
          {/* 주소 */}
          <input
            type="text"
            readOnly
            value={address}
            placeholder="주소 검색 →"
            onClick={openSearch}
            disabled={disabled}
            className={`flex-1 ${INPUT_CLS} cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
          {/* 상세주소 */}
          <input
            ref={detailRef}
            type="text"
            value={detail}
            onChange={handleDetailChange}
            onKeyDown={handleDetailKeyDown}
            onBlur={() => emitChange(address, detail, zonecode, roadAddress, jibunAddress, buildingName)}
            placeholder="상세주소"
            disabled={disabled || !address}
            className={`flex-1 ${INPUT_CLS} ${!address ? 'opacity-40' : ''}`}
          />
        </div>
      ) : (
        /* ── 기본 모드: 세로 3줄 ── */
        <>
          {/* 1행: 우편번호 + 돋보기 */}
      <div className="relative w-40">
        <input
          type="text"
          readOnly
          value={zonecode}
          placeholder="우편번호"
          onClick={openSearch}
          disabled={disabled}
          className={`w-full h-11 pl-4 pr-10 rounded-xl bg-surface-container-low text-on-surface text-sm font-data cursor-pointer placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
        <button
          type="button"
          onClick={openSearch}
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant/60 hover:text-on-surface transition-colors disabled:opacity-50"
          aria-label="주소 검색"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </button>
      </div>

      {/* 2행: 건물명 / 기본 주소 (readOnly) */}
      <div className="mt-2">
        <input
          type="text"
          readOnly
          value={buildingName && address ? `${buildingName} — ${address}` : address}
          placeholder="위 버튼을 눌러 주소를 검색하세요"
          onClick={openSearch}
          disabled={disabled}
          className={`${INPUT_CLS} cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
      </div>

      {/* 3행: 상세주소 (주소 선택 후 펼쳐짐) */}
      {showDetail && address && (
        <div className="mt-2">
          <input
            ref={detailRef}
            type="text"
            value={detail}
            onChange={handleDetailChange}
            onKeyDown={handleDetailKeyDown}
            onBlur={() => emitChange(address, detail, zonecode, roadAddress, jibunAddress, buildingName)}
            placeholder="상세주소 입력 (동/호수 등)"
            disabled={disabled}
            className={INPUT_CLS}
          />
        </div>
      )}
        </>
      )}

      {/* 주소 검색 모달 오버레이 — react-daum-postcode 사용 */}
      {showModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ width: 420, height: 520 }}>
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 bg-surface-container border-b border-outline-variant">
              <span className="text-sm font-medium text-on-surface font-korean">주소 검색</span>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container-high transition-colors text-on-surface-variant"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Daum Postcode embed 영역 */}
            <div style={{ height: 'calc(100% - 48px)' }}>
              <DaumPostcodeEmbed
                onComplete={handleComplete}
                style={{ width: '100%', height: '100%' }}
                autoClose={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
