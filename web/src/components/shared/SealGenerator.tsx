'use client'

/**
 * 도장 생성 컴포넌트 — stamp.seedtype.com 스타일
 *
 * 레이아웃:
 * ┌──────────────────────────────────────────┐
 * │  일반 도장 | 법인 도장 | 업로드           │ (탭)
 * ├──────────────────────────────────────────┤
 * │  [이름 입력]              [만들기]        │
 * │  글씨체: [드롭다운 ▾]                    │
 * │  도장 모양: (●원) (■사각) (⬭타원)        │
 * │  글씨 크기:  ━━━━━●━━━━━  50             │
 * │  글자 간격:  ━━━━━●━━━━━  70             │
 * │  도장 크기:  ━━━━━●━━━━━  200px          │
 * │  [한자변환 ○] [글자사이점 ○]              │
 * ├──────────────────────────────────────────┤
 * │         ┌──────────────┐                 │
 * │         │  실시간       │ (큰 미리보기)   │
 * │         │  도장 미리보기 │                │
 * │         └──────────────┘                 │
 * ├──────────────────────────────────────────┤
 * │                    [취소] [등록하기]      │
 * └──────────────────────────────────────────┘
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  type SealCategory,
  type SealScript,
  type SealShape,
  ALL_SEAL_FONTS,
  getThousandCharacterFontIdx,
  getThousandCharacterCount,
  isInThousandCharacterClassic,
  renderSealCanvas,
  ensureSealFontsLoaded,
  removeWhiteBackground,
  fileToDataUri,
  hangulToHanja,
  getHanjaCandidates,
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

const SHAPE_OPTIONS: { value: SealShape; label: string; icon: string }[] = [
  { value: 'circle', label: '원형', icon: '●' },
  { value: 'square', label: '사각', icon: '■' },
  { value: 'oval', label: '타원', icon: '⬭' },
]

/* ── 슬라이더 컴포넌트 ── */
function Slider({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium text-on-surface-variant/70 font-korean w-16 shrink-0">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
      />
      <span className="text-xs font-data text-on-surface-variant w-14 text-right">{value}{unit}</span>
    </div>
  )
}

export default function SealGenerator({ defaultName = '', onComplete, onCancel }: SealGeneratorProps) {
  const [activeTab, setActiveTab] = useState<TabId>('personal')
  const [nameText, setNameText] = useState(defaultName)
  const [previewUri, setPreviewUri] = useState<string | null>(null)

  // stamp.seedtype.com 스타일 컨트롤
  const [fontIdx, setFontIdx] = useState(0)
  const [shape, setShape] = useState<SealShape>('circle')
  const [fontSize, setFontSize] = useState(100)    // 글씨 크기 (50~150%, 기본 100)
  const [letterSpacing, setLetterSpacing] = useState(100)  // 글자 간격 (50~150%, 기본 100)
  const [sealSize, setSealSize] = useState(250)    // 도장 크기 px (100~400)

  // 한글/한자
  const [useHanja, setUseHanja] = useState(false)
  /** 천자문 모드: 한자 변환과 함께 켜면 전서체(한전서체A 등)를 자동 적용 — 전통 인감 느낌 */
  const [useThousandChar, setUseThousandChar] = useState(false)
  const [hanjaOverride, setHanjaOverride] = useState('')
  const [showDot, setShowDot] = useState(true)
  const [editingCharIdx, setEditingCharIdx] = useState<number | null>(null)

  // 법인도장 중앙 텍스트
  const [corpTitle, setCorpTitle] = useState('')

  // 업로드
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [uploadName, setUploadName] = useState('')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 탭 전환
  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab)
    setPreviewUri(null)
    setUploadPreview(null)
  }

  // 한자 변환 — 천자문 모드 시 千字文 본문 한자를 우선 선택
  const updateHanjaPreview = useCallback((name: string, preferThousand?: boolean) => {
    if (!name.trim()) { setHanjaOverride(''); return }
    setHanjaOverride(hangulToHanja(name.trim(), { preferThousandChar: preferThousand ?? useThousandChar }))
  }, [useThousandChar])

  const handleHanjaToggle = useCallback((on: boolean) => {
    setUseHanja(on)
    if (on && nameText.trim()) updateHanjaPreview(nameText)
    // 한자 변환을 끄면 천자문 모드도 함께 끔
    if (!on) setUseThousandChar(false)
  }, [nameText, updateHanjaPreview])

  /** 천자문 토글 — 켜면 한자 변환 활성화 + 한전서체A 자동 + 千字文 한자 우선 사용 */
  const handleThousandCharToggle = useCallback((on: boolean) => {
    setUseThousandChar(on)
    if (on) {
      if (!useHanja) {
        setUseHanja(true)
      }
      if (nameText.trim()) updateHanjaPreview(nameText, true)
      const idx = getThousandCharacterFontIdx()
      if (idx >= 0) setFontIdx(idx)
    } else if (useHanja && nameText.trim()) {
      // 끌 때도 다시 변환해서 천자문 우선 해제
      updateHanjaPreview(nameText, false)
    }
  }, [useHanja, nameText, updateHanjaPreview])

  const handleHanjaCharSelect = useCallback((idx: number, char: string) => {
    const arr = Array.from(hanjaOverride)
    arr[idx] = char
    setHanjaOverride(arr.join(''))
    setEditingCharIdx(null)
  }, [hanjaOverride])

  // ── 실시간 미리보기 렌더링 (debounce 200ms) ──
  const renderPreview = useCallback(() => {
    if (!nameText.trim()) { setPreviewUri(null); return }
    ensureSealFontsLoaded()
    const category: SealCategory = activeTab === 'corporate' ? 'corporate' : 'personal'
    const displayName = useHanja && hanjaOverride ? hanjaOverride : nameText.trim()
    const font = ALL_SEAL_FONTS[fontIdx] ?? ALL_SEAL_FONTS[0]
    const rawTitle = corpTitle.trim() || undefined

    const uri = renderSealCanvas({
      name: displayName,
      category,
      shape,
      fontFamily: font.family,
      fontWeight: font.weight,
      size: sealSize,
      corporateTitle: category === 'corporate' ? (rawTitle ?? '대표자인') : undefined,
      intaglio: false,
      showDot,
      fontSizeScale: fontSize / 100,
      letterSpacingScale: letterSpacing / 100,
      useHanja,
    })
    setPreviewUri(uri)
  }, [nameText, activeTab, fontIdx, shape, fontSize, letterSpacing, sealSize, useHanja, hanjaOverride, showDot, corpTitle])

  // 모든 컨트롤 변경 시 debounce 미리보기 업데이트
  useEffect(() => {
    if (activeTab === 'upload') return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(renderPreview, 200)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [renderPreview, activeTab])

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
    } catch { /* fallback */ }
    setProcessing(false)
  }

  // 등록
  const handleSubmit = () => {
    if (activeTab === 'upload' && uploadPreview) {
      onComplete(uploadPreview, { category: 'upload', script: 'hangul', nameText: uploadName || '업로드' })
    } else if (previewUri) {
      const category: SealCategory = activeTab === 'corporate' ? 'corporate' : 'personal'
      onComplete(previewUri, { category, script: useHanja ? 'hanja' : 'hangul', nameText })
    }
  }

  const inputCls = 'h-11 px-4 rounded-xl border border-outline-variant/30 bg-surface text-sm text-on-surface font-korean focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 placeholder:text-on-surface-variant/40'

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
              activeTab === tab.id ? 'text-on-surface' : 'text-on-surface-variant/60 hover:text-on-surface-variant'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-amber-500 rounded-t" />}
          </button>
        ))}
      </div>

      {/* ── 일반/법인 도장 ── */}
      {(activeTab === 'personal' || activeTab === 'corporate') && (
        <div className="pt-5 space-y-4">
          {/* 이름 입력 */}
          <div className="flex items-center gap-3">
            <input
              type="text" value={nameText}
              onChange={(e) => { setNameText(e.target.value); if (useHanja) updateHanjaPreview(e.target.value) }}
              placeholder={activeTab === 'corporate' ? '회사명 (예: 주식회사로지싸인)' : '이름 (예: 홍길동)'}
              maxLength={12}
              className={`flex-1 ${inputCls}`}
              autoFocus
            />
            {activeTab === 'corporate' && (
              <input
                type="text" value={corpTitle}
                onChange={(e) => setCorpTitle(e.target.value)}
                placeholder="중앙 텍스트 (기본: 대표자인)"
                maxLength={8}
                className={`w-48 ${inputCls}`}
              />
            )}
          </div>

          {/* 컨트롤 패널 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-surface-container-low/50 border border-outline-variant/15">
            {/* 좌측: 글씨체 + 도장 모양 */}
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-on-surface-variant/70 font-korean mb-1.5">글씨체</p>
                <select
                  value={fontIdx}
                  onChange={(e) => setFontIdx(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-lg border border-outline-variant/25 bg-white text-sm font-korean focus:outline-none focus:border-amber-500"
                >
                  {ALL_SEAL_FONTS.map((f, i) => (
                    <option key={i} value={i}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs font-medium text-on-surface-variant/70 font-korean mb-1.5">도장 모양</p>
                <div className="flex gap-2">
                  {SHAPE_OPTIONS.map((s) => (
                    <button
                      key={s.value} type="button"
                      onClick={() => setShape(s.value)}
                      className={`flex-1 h-9 rounded-lg text-xs font-korean flex items-center justify-center gap-1 border transition-all ${
                        shape === s.value
                          ? 'border-amber-500 bg-amber-50 text-amber-700 font-bold'
                          : 'border-outline-variant/20 text-on-surface-variant hover:border-amber-400/50'
                      }`}
                    >
                      <span>{s.icon}</span> {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 우측: 슬라이더 */}
            <div className="space-y-2.5">
              <Slider label="글씨 크기" value={fontSize} min={50} max={150} step={5} unit="%" onChange={setFontSize} />
              <Slider label="글자 간격" value={letterSpacing} min={50} max={150} step={5} unit="%" onChange={setLetterSpacing} />
              <Slider label="도장 크기" value={sealSize} min={100} max={400} step={10} unit="px" onChange={setSealSize} />
            </div>
          </div>

          {/* 옵션 토글 */}
          <div className="flex items-center gap-5 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div role="switch" aria-checked={useHanja} onClick={() => handleHanjaToggle(!useHanja)}
                className={`relative w-10 h-[22px] rounded-full transition-colors ${useHanja ? 'bg-amber-500' : 'bg-gray-300'}`}>
                <div className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${useHanja ? 'translate-x-[20px]' : 'translate-x-[2px]'}`} />
              </div>
              <span className="text-sm text-on-surface font-korean">한자 변환</span>
            </label>
            <label
              className={`flex items-center gap-2 select-none ${useHanja ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
              title={useHanja ? '천자문 모드 — 전서체 자동 적용' : '먼저 한자 변환을 켜주세요'}
            >
              <div role="switch" aria-checked={useThousandChar}
                onClick={() => useHanja && handleThousandCharToggle(!useThousandChar)}
                className={`relative w-10 h-[22px] rounded-full transition-colors ${useThousandChar ? 'bg-amber-700' : 'bg-gray-300'}`}>
                <div className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${useThousandChar ? 'translate-x-[20px]' : 'translate-x-[2px]'}`} />
              </div>
              <span className="text-sm text-on-surface font-korean">
                천자문 ({getThousandCharacterCount()}자)
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div role="switch" aria-checked={showDot} onClick={() => setShowDot(!showDot)}
                className={`relative w-10 h-[22px] rounded-full transition-colors ${showDot ? 'bg-amber-500' : 'bg-gray-300'}`}>
                <div className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${showDot ? 'translate-x-[20px]' : 'translate-x-[2px]'}`} />
              </div>
              <span className="text-sm text-on-surface font-korean">글자 사이 점(·)</span>
            </label>
          </div>

          {/* 한자 후보 선택 UI */}
          {useHanja && nameText.trim() && hanjaOverride && (
            <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/40 space-y-2">
              <p className="text-xs text-on-surface-variant/70 font-korean">
                한자 미리보기 (글자를 클릭하면 다른 한자로 변경)
                {useThousandChar && (
                  <span className="ml-2 text-[10px] text-amber-700">
                    · <span className="font-data">千</span> 표시 = 천자문 본문 한자
                  </span>
                )}
              </p>
              <div className="flex items-center gap-1">
                {Array.from(hanjaOverride).map((char, idx) => {
                  const candidates = getHanjaCandidates(nameText.trim()[idx] || '', { preferThousandChar: useThousandChar })
                  const hasCandidates = candidates.length > 1
                  const charInClassic = isInThousandCharacterClassic(char)
                  return (
                    <div key={idx} className="relative">
                      <button type="button"
                        onClick={() => hasCandidates && setEditingCharIdx(editingCharIdx === idx ? null : idx)}
                        className={`relative w-10 h-10 rounded-lg border text-lg font-bold flex items-center justify-center transition-all ${
                          hasCandidates ? 'border-amber-400 hover:bg-amber-100 cursor-pointer' : 'border-gray-200 bg-gray-50 cursor-default'
                        } ${editingCharIdx === idx ? 'bg-amber-100 ring-2 ring-amber-400' : ''}`}
                      >
                        {char}
                        {useThousandChar && charInClassic && (
                          <span className="absolute -top-1 -right-1 text-[8px] font-data text-amber-700 bg-white rounded-full px-1 leading-tight border border-amber-300">千</span>
                        )}
                      </button>
                      {editingCharIdx === idx && hasCandidates && (
                        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-amber-200 rounded-lg shadow-lg p-1.5 flex flex-wrap gap-1 min-w-[120px]">
                          {candidates.map((c) => {
                            const isClassic = isInThousandCharacterClassic(c)
                            return (
                              <button key={c} type="button" onClick={() => handleHanjaCharSelect(idx, c)}
                                className={`relative w-9 h-9 rounded text-base font-bold flex items-center justify-center transition-colors ${
                                  c === char ? 'bg-amber-500 text-white' : 'hover:bg-amber-50 text-on-surface'
                                } ${isClassic && c !== char ? 'ring-1 ring-amber-300' : ''}`}
                                title={isClassic ? '천자문 본문 한자' : ''}
                              >
                                {c}
                                {isClassic && (
                                  <span className={`absolute -top-1 -right-1 text-[8px] font-data leading-tight ${
                                    c === char ? 'text-white' : 'text-amber-700'
                                  }`}>千</span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
                <span className="ml-2 text-xs text-on-surface-variant/50 font-korean">{nameText.trim()} → {hanjaOverride}</span>
              </div>
            </div>
          )}

          {/* ── 실시간 도장 미리보기 (큰 단일 이미지) ── */}
          <div className="flex flex-col items-center py-6">
            {previewUri ? (
              <>
                <div className="p-4 rounded-2xl border border-outline-variant/20 bg-white shadow-sm"
                  style={{ width: Math.min(sealSize + 40, 440), height: Math.min(sealSize + 40, 440), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URI from canvas, next/image not applicable */}
                  <img src={previewUri} alt="도장 미리보기" style={{ maxWidth: sealSize, maxHeight: sealSize }} className="object-contain" />
                </div>
                <p className="mt-3 text-xs text-on-surface-variant/60 font-korean">
                  {ALL_SEAL_FONTS[fontIdx]?.label} · {SHAPE_OPTIONS.find(s => s.value === shape)?.label} · {sealSize}px
                </p>
              </>
            ) : (
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto rounded-full bg-red-50 flex items-center justify-center mb-4">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#C42B2B" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="9"/><path d="M12 8v4m0 2v.5"/>
                  </svg>
                </div>
                <p className="text-sm text-on-surface-variant font-korean">
                  {activeTab === 'corporate' ? '회사명을 입력하면 실시간 미리보기가 표시됩니다' : '이름을 입력하면 실시간 미리보기가 표시됩니다'}
                </p>
              </div>
            )}
          </div>

          {/* 등록 버튼 */}
          {previewUri && (
            <div className="flex justify-end gap-3 pt-1">
              {onCancel && (
                <button type="button" onClick={onCancel} className="h-10 px-5 rounded-xl border border-outline-variant/30 text-sm text-on-surface-variant font-korean hover:bg-surface-container-low transition-colors">
                  취소
                </button>
              )}
              <button type="button" onClick={handleSubmit}
                className="h-10 px-6 rounded-xl bg-primary text-white text-sm font-semibold font-korean hover:bg-primary/90 transition-colors">
                등록하기
              </button>
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
                <p className="text-sm font-semibold text-on-surface font-korean">{processing ? '배경 제거 처리 중...' : '도장 이미지를 업로드하세요'}</p>
                <p className="text-[11px] text-on-surface-variant/50 font-korean mt-1">흰 종이에 찍은 도장 스캔 → 배경이 자동으로 제거됩니다</p>
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
              <p className="text-center text-[11px] text-on-surface-variant/60 font-korean">배경이 자동으로 제거되었습니다 (체크무늬 = 투명)</p>
              <input type="text" value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="도장 이름 (선택)"
                className="w-full h-10 px-4 rounded-xl border border-outline-variant/30 bg-surface text-sm text-on-surface font-korean focus:outline-none focus:border-primary/60" />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setUploadPreview(null)}
                  className="h-10 px-5 rounded-xl border border-outline-variant/30 text-sm text-on-surface-variant font-korean hover:bg-surface-container-low">다시 업로드</button>
                {onCancel && (
                  <button type="button" onClick={onCancel} className="h-10 px-5 rounded-xl border border-outline-variant/30 text-sm text-on-surface-variant font-korean hover:bg-surface-container-low">취소</button>
                )}
                <button type="button" onClick={handleSubmit}
                  className="h-10 px-6 rounded-xl bg-primary text-white text-sm font-semibold font-korean hover:bg-primary/90 transition-colors">등록하기</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
