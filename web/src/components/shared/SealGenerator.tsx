'use client'

/**
 * 도장 생성 컴포넌트 — 모두싸인 스타일 (탭 레이아웃)
 *
 * 레이아웃:
 * ┌──────────────────────────────────────────┐
 * │  일반 도장 | 법인 도장 | 업로드 | 내 도장  │ (탭)
 * ├──────────────────────────────────────────┤
 * │  [한글 ▾]  [이름 입력]         [만들기]  │ (입력줄)
 * ├──────────────────────────────────────────┤
 * │  ┌──┐  ┌──┐  ┌──┐  ┌──┐                │
 * │  │  │  │★│  │  │  │  │  (4열 그리드)    │
 * │  └──┘  └──┘  └──┘  └──┘                │
 * │  ┌──┐  ┌──┐  ┌──┐  ┌──┐                │
 * │  │  │  │  │  │  │  │  │                 │
 * │  └──┘  └──┘  └──┘  └──┘                │
 * └──────────────────────────────────────────┘
 */

import { useState, useCallback } from 'react'
import {
  type SealCategory,
  type SealScript,
  type SealVariant,
  type SealSizeId,
  generateSealVariants,
  removeWhiteBackground,
  fileToDataUri,
  hangulToHanja,
  getHanjaCandidates,
  getSealSizesForCategory,
  getSealSizeById,
  DEFAULT_SEAL_SIZE,
} from '@/services/seal.service'

/* ── Props ── */
interface SealGeneratorProps {
  defaultName?: string
  onComplete: (dataUri: string, meta: { category: SealCategory; script: SealScript; nameText: string }) => void
  onCancel?: () => void
}

type TabId = 'personal' | 'corporate' | 'upload'

const TABS: { id: TabId; label: string }[] = [
  { id: 'personal', label: '일반 도장' },
  { id: 'corporate', label: '법인 도장' },
  { id: 'upload', label: '업로드' },
]

export default function SealGenerator({ defaultName = '', onComplete, onCancel }: SealGeneratorProps) {
  const [activeTab, setActiveTab] = useState<TabId>('personal')
  const [nameText, setNameText] = useState(defaultName)
  const [variants, setVariants] = useState<SealVariant[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [generated, setGenerated] = useState(false)

  // 한글/한자 선택
  const [useHanja, setUseHanja] = useState(false)
  const [_hanjaText, setHanjaText] = useState('')       // 미리보기용 한자 텍스트
  const [hanjaOverride, setHanjaOverride] = useState('')  // 사용자 직접 선택한 한자
  const [showDot, setShowDot] = useState(true)          // 글자 사이 점(·)
  const [editingCharIdx, setEditingCharIdx] = useState<number | null>(null)  // 한자 후보 선택 중인 글자 인덱스

  // Upload state
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [uploadName, setUploadName] = useState('')
  const [corpTitle, setCorpTitle] = useState('')       // 법인도장 중앙 텍스트 (커스텀)
  const [sealSizeId, setSealSizeId] = useState<SealSizeId>(DEFAULT_SEAL_SIZE.personal)  // 도장 사이즈

  // 탭 전환 시 리셋
  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab)
    setVariants([])
    setSelectedId(null)
    setGenerated(false)
    setUploadPreview(null)
    // 사이즈를 카테고리에 맞게 기본값으로
    const cat = tab === 'corporate' ? 'corporate' : 'personal'
    setSealSizeId(DEFAULT_SEAL_SIZE[cat])
  }

  // 한자 변환 미리보기 업데이트
  const updateHanjaPreview = useCallback((name: string) => {
    if (!name.trim()) {
      setHanjaText('')
      setHanjaOverride('')
      return
    }
    const converted = hangulToHanja(name.trim())
    setHanjaText(converted)
    setHanjaOverride(converted)
  }, [])

  // 한자 토글 시
  const handleHanjaToggle = useCallback((on: boolean) => {
    setUseHanja(on)
    if (on && nameText.trim()) {
      updateHanjaPreview(nameText)
    }
    // 토글 시 이전 생성 결과 리셋
    setVariants([])
    setSelectedId(null)
    setGenerated(false)
  }, [nameText, updateHanjaPreview])

  // 개별 한자 후보 선택
  const handleHanjaCharSelect = useCallback((idx: number, char: string) => {
    const arr = Array.from(hanjaOverride)
    arr[idx] = char
    setHanjaOverride(arr.join(''))
    setEditingCharIdx(null)
  }, [hanjaOverride])

  // 현재 카테고리에 맞는 사이즈 옵션
  const currentCategory = activeTab === 'corporate' ? 'corporate' : 'personal'
  const sizeOptions = getSealSizesForCategory(currentCategory)
  const _currentSize = getSealSizeById(sealSizeId)

  // 만들기 클릭
  const handleGenerate = useCallback(() => {
    if (!nameText.trim()) return
    const category = activeTab === 'corporate' ? 'corporate' : 'personal'
    const sz = getSealSizeById(sealSizeId)
    const v = generateSealVariants({
      name: nameText.trim(),
      category,
      script: useHanja ? 'hanja' : 'hangul',
      size: sz?.canvasPx ?? 250,
      representativeName: category === 'corporate' && corpTitle.trim() ? corpTitle.trim() : undefined,
      useHanja,
      hanjaOverride: useHanja ? hanjaOverride : undefined,
      showDot,
    })
    setVariants(v)
    setSelectedId(null)
    setGenerated(true)
  }, [nameText, activeTab, corpTitle, useHanja, hanjaOverride, showDot, sealSizeId])

  // 업로드 파일 처리
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setProcessing(true)
    try {
      const dataUri = await fileToDataUri(file)
      const cleaned = await removeWhiteBackground(dataUri)
      setUploadPreview(cleaned)
      setUploadName(file.name.replace(/\.[^.]+$/, ''))
    } catch {
      // fallback
    }
    setProcessing(false)
  }

  // 등록
  const handleSubmit = () => {
    if (activeTab === 'upload' && uploadPreview) {
      onComplete(uploadPreview, { category: 'upload', script: 'hangul', nameText: uploadName || '업로드' })
    } else if (selectedId) {
      const chosen = variants.find((v) => v.id === selectedId)
      if (chosen) {
        const category = activeTab === 'corporate' ? 'corporate' : 'personal'
        onComplete(chosen.dataUri, { category, script: 'hangul', nameText })
      }
    }
  }

  return (
    <div className="space-y-0">
      {/* ── 탭 ── */}
      <div className="flex border-b border-outline-variant/20">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabChange(tab.id)}
            className={`px-5 py-3 text-sm font-korean font-medium relative transition-colors ${
              activeTab === tab.id
                ? 'text-on-surface'
                : 'text-on-surface-variant/60 hover:text-on-surface-variant'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-amber-500 rounded-t" />
            )}
          </button>
        ))}
      </div>

      {/* ── 일반/법인 도장 탭 내용 ── */}
      {(activeTab === 'personal' || activeTab === 'corporate') && (
        <div className="pt-5 space-y-4">
          {/* 입력줄: [이름] + (법인:중앙텍스트) + [만들기] */}
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={nameText}
              onChange={(e) => { setNameText(e.target.value); if (useHanja) updateHanjaPreview(e.target.value) }}
              placeholder={activeTab === 'corporate' ? '회사명 입력 (예: 주식회사로지싸인)' : '이름 입력 (예: 홍길동)'}
              maxLength={12}
              className="flex-1 h-11 px-4 rounded-xl border border-outline-variant/30 bg-surface text-sm text-on-surface font-korean focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 placeholder:text-on-surface-variant/40"
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              autoFocus
            />
            {activeTab === 'corporate' && (
              <input
                type="text"
                value={corpTitle}
                onChange={(e) => setCorpTitle(e.target.value)}
                placeholder="중앙 텍스트 (기본: 대표이사之印)"
                maxLength={8}
                className="w-48 h-11 px-4 rounded-xl border border-outline-variant/30 bg-surface text-sm text-on-surface font-korean focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 placeholder:text-on-surface-variant/40"
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              />
            )}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!nameText.trim()}
              className="h-11 px-6 rounded-xl bg-amber-500 text-white text-sm font-bold font-korean disabled:opacity-40 hover:bg-amber-600 transition-colors shrink-0"
            >
              만들기
            </button>
          </div>

          {/* 도장 사이즈 선택 */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-on-surface-variant/70 font-korean">도장 크기</p>
            <div className="flex flex-wrap gap-2">
              {sizeOptions.map((sz) => (
                <button
                  key={sz.id}
                  type="button"
                  onClick={() => { setSealSizeId(sz.id); setVariants([]); setSelectedId(null); setGenerated(false) }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-korean transition-all border ${
                    sealSizeId === sz.id
                      ? 'border-amber-500 bg-amber-50 text-amber-700 font-bold shadow-sm'
                      : 'border-outline-variant/20 text-on-surface-variant hover:border-amber-400/50 hover:bg-amber-50/30'
                  }`}
                  title={sz.desc}
                >
                  <span className="font-semibold">{sz.diameterMm}mm</span>
                  <span className="ml-1 text-[10px] opacity-70">{sz.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 옵션: 한자 변환 + 글자 사이 점 */}
          <div className="flex items-center gap-5 flex-wrap">
            {/* 한글/한자 토글 */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                role="switch"
                aria-checked={useHanja}
                onClick={() => handleHanjaToggle(!useHanja)}
                className={`relative w-10 h-[22px] rounded-full transition-colors ${useHanja ? 'bg-amber-500' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${useHanja ? 'translate-x-[20px]' : 'translate-x-[2px]'}`} />
              </div>
              <span className="text-sm text-on-surface font-korean">한자 변환</span>
            </label>

            {/* 글자 사이 점 토글 */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                role="switch"
                aria-checked={showDot}
                onClick={() => { setShowDot(!showDot); setVariants([]); setSelectedId(null); setGenerated(false) }}
                className={`relative w-10 h-[22px] rounded-full transition-colors ${showDot ? 'bg-amber-500' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${showDot ? 'translate-x-[20px]' : 'translate-x-[2px]'}`} />
              </div>
              <span className="text-sm text-on-surface font-korean">글자 사이 점(·)</span>
            </label>
          </div>

          {/* 한자 미리보기 & 후보 선택 */}
          {useHanja && nameText.trim() && hanjaOverride && (
            <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/40 space-y-2">
              <p className="text-xs text-on-surface-variant/70 font-korean">한자 미리보기 (글자를 클릭하면 다른 한자로 변경할 수 있습니다)</p>
              <div className="flex items-center gap-1">
                {Array.from(hanjaOverride).map((char, idx) => {
                  const candidates = getHanjaCandidates(nameText.trim()[idx] || '')
                  const hasCandidates = candidates.length > 1
                  return (
                    <div key={idx} className="relative">
                      <button
                        type="button"
                        onClick={() => hasCandidates && setEditingCharIdx(editingCharIdx === idx ? null : idx)}
                        className={`w-10 h-10 rounded-lg border text-lg font-bold flex items-center justify-center transition-all ${
                          hasCandidates
                            ? 'border-amber-400 hover:bg-amber-100 cursor-pointer'
                            : 'border-gray-200 bg-gray-50 cursor-default'
                        } ${editingCharIdx === idx ? 'bg-amber-100 ring-2 ring-amber-400' : ''}`}
                        title={hasCandidates ? '클릭하여 다른 한자 선택' : '한자 후보 없음'}
                      >
                        {char}
                      </button>
                      {/* 후보 드롭다운 */}
                      {editingCharIdx === idx && hasCandidates && (
                        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-amber-200 rounded-lg shadow-lg p-1.5 flex flex-wrap gap-1 min-w-[120px]">
                          {candidates.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => handleHanjaCharSelect(idx, c)}
                              className={`w-9 h-9 rounded text-base font-bold flex items-center justify-center transition-colors ${
                                c === char ? 'bg-amber-500 text-white' : 'hover:bg-amber-50 text-on-surface'
                              }`}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                <span className="ml-2 text-xs text-on-surface-variant/50 font-korean">
                  {nameText.trim()} → {hanjaOverride}
                </span>
              </div>
            </div>
          )}

          {/* 도장 미리보기 그리드 */}
          {generated && variants.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedId(v.id)}
                    className={`relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all aspect-square ${
                      selectedId === v.id
                        ? 'border-amber-500 bg-amber-50/50 shadow-sm'
                        : 'border-outline-variant/15 hover:border-amber-400/50 bg-white'
                    }`}
                  >
                    {selectedId === v.id && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                      </div>
                    )}
                    {/* eslint-disable-next-line @next/next/no-img-element -- data URI from canvas, next/image not applicable */}
                    <img src={v.dataUri} alt={v.fontLabel} className="w-full h-auto object-contain flex-1" />
                    <span className="text-[10px] text-on-surface-variant/60 font-korean mt-1 truncate w-full text-center">{v.fontLabel}</span>
                  </button>
                ))}
              </div>

              {/* 등록 버튼 */}
              <div className="flex justify-end gap-3 pt-1">
                {onCancel && (
                  <button type="button" onClick={onCancel} className="h-10 px-5 rounded-xl border border-outline-variant/30 text-sm text-on-surface-variant font-korean hover:bg-surface-container-low transition-colors">
                    취소
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!selectedId}
                  className="h-10 px-6 rounded-xl bg-primary text-white text-sm font-semibold font-korean disabled:opacity-40 hover:bg-primary/90 transition-colors"
                >
                  등록하기
                </button>
              </div>
            </div>
          )}

          {/* 아직 생성 전이면 안내 메시지 */}
          {!generated && (
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto rounded-full bg-red-50 flex items-center justify-center mb-4">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#C42B2B" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="9"/>
                  <path d="M12 8v4m0 2v.5"/>
                </svg>
              </div>
              <p className="text-sm text-on-surface-variant font-korean">
                {activeTab === 'corporate'
                  ? '회사명을 입력하고 [만들기]를 클릭하면 법인 인감도장이 생성됩니다'
                  : '이름을 입력하고 [만들기]를 클릭하면 인감도장이 생성됩니다'
                }
              </p>
              <p className="text-xs text-on-surface-variant/50 font-korean mt-2">
                {activeTab === 'corporate'
                  ? '외곽 원호에 회사명 + ★, 중앙에 대표이사인이 배치됩니다'
                  : '원형/사각형 × 서체 조합으로 8가지 디자인을 만들어 드립니다'
                }
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── 업로드 탭 ── */}
      {activeTab === 'upload' && (
        <div className="pt-5 space-y-4">
          {!uploadPreview ? (
            <label className="flex flex-col items-center gap-3 p-10 rounded-2xl border-2 border-dashed border-outline-variant/30 cursor-pointer hover:border-primary/40 hover:bg-primary/[0.02] transition-all">
              <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-on-surface font-korean">
                  {processing ? '배경 제거 처리 중...' : '도장 이미지를 업로드하세요'}
                </p>
                <p className="text-[11px] text-on-surface-variant/50 font-korean mt-1">
                  흰 종이에 찍은 도장 스캔 → 배경이 자동으로 제거됩니다
                </p>
                <p className="text-[11px] text-on-surface-variant/40 font-korean">PNG, JPG (최대 5MB)</p>
              </div>
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="w-40 h-40 rounded-2xl border border-outline-variant/20 flex items-center justify-center p-4"
                     style={{ backgroundImage: 'linear-gradient(45deg, #f0f0f0 25%, transparent 25%, transparent 75%, #f0f0f0 75%), linear-gradient(45deg, #f0f0f0 25%, transparent 25%, transparent 75%, #f0f0f0 75%)', backgroundSize: '16px 16px', backgroundPosition: '0 0, 8px 8px' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URI from canvas, next/image not applicable */}
                  <img src={uploadPreview} alt="업로드 도장" className="max-w-full max-h-full object-contain" />
                </div>
              </div>
              <p className="text-center text-[11px] text-on-surface-variant/60 font-korean">
                배경이 자동으로 제거되었습니다 (체크무늬 = 투명)
              </p>
              <input
                type="text"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="도장 이름 (선택)"
                className="w-full h-10 px-4 rounded-xl border border-outline-variant/30 bg-surface text-sm text-on-surface font-korean focus:outline-none focus:border-primary/60"
              />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setUploadPreview(null)}
                  className="h-10 px-5 rounded-xl border border-outline-variant/30 text-sm text-on-surface-variant font-korean hover:bg-surface-container-low">
                  다시 업로드
                </button>
                {onCancel && (
                  <button type="button" onClick={onCancel} className="h-10 px-5 rounded-xl border border-outline-variant/30 text-sm text-on-surface-variant font-korean hover:bg-surface-container-low">취소</button>
                )}
                <button type="button" onClick={handleSubmit}
                  className="h-10 px-6 rounded-xl bg-primary text-white text-sm font-semibold font-korean hover:bg-primary/90 transition-colors">
                  등록하기
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
