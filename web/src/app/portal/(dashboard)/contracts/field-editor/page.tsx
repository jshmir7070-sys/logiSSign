'use client'

/**
 * 계약서 템플릿 필드 배치 에디터 — 단독 풀스크린 UI
 *
 * 레이아웃:
 *  ┌──────────────────────────────────────────┐
 *  │  [← 뒤로]  제목              [저장] 버튼  │  ← 상단 바
 *  ├──────────────────────┬───────────────────┤
 *  │                      │  입력 필드 설정     │
 *  │   PDF 미리보기        │  1. 이름 → 자동    │  ← 메인 영역
 *  │   (중앙 배치)         │  2. 날짜           │
 *  │                      │  3. 생년월일        │
 *  │                      │  [+ 필드 추가]      │
 *  ├──────────────────────┴───────────────────┤
 *  │  배치된 필드 목록 (가로 스크롤)              │  ← 하단 바
 *  └──────────────────────────────────────────┘
 *
 * 첫 화면: 내 문서함 / 내 컴퓨터 선택
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { type SignFieldType, FIELD_TYPE_META } from '@/services/document-sign-field.service'

/* ── 타입 ── */

interface SignFieldInput {
  field_type: SignFieldType
  page_number: number
  x: number
  y: number
  width: number
  height: number
  label?: string
  required: boolean
  sort_order: number
  default_value?: string
  binding_var?: string
}

interface LocalField extends SignFieldInput {
  _id: string
}

/* ── 바인딩 변수 옵션 ── */

const BINDING_OPTIONS = [
  { value: '', label: '직접 입력' },
  { value: '기사명', label: '기사명' },
  { value: '전화번호', label: '전화번호' },
  { value: '주소', label: '주소' },
  { value: '생년월일', label: '생년월일' },
  { value: '사번', label: '사번' },
  { value: '배송지역', label: '배송지역' },
  { value: '사업자번호', label: '사업자번호' },
  { value: '대표자명', label: '대표자명' },
  { value: '배송단가', label: '배송단가' },
  { value: '반품단가', label: '반품단가' },
  { value: '계좌번호', label: '계좌번호' },
  { value: '은행명', label: '은행명' },
  { value: '예금주', label: '예금주' },
  { value: '차량번호', label: '차량번호' },
  { value: '계약시작일', label: '계약시작일' },
  { value: '계약종료일', label: '계약종료일' },
  { value: '대리점명', label: '대리점명' },
]

/* ── 메인 컴포넌트 ── */

export default function ContractFieldEditorPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const templateId = searchParams.get('templateId') ?? ''

  const [title, setTitle] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  const [fields, setFields] = useState<LocalField[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages] = useState(1)
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── 데이터 로드 ──
  useEffect(() => {
    if (!templateId) return
    ;(async () => {
      const supabase = createBrowserSupabaseClient()
      const { data: tmpl } = await supabase
        .from('contract_templates')
        .select('title, template_pdf_url, sign_fields')
        .eq('id', templateId)
        .single()

      if (tmpl) {
        setTitle((tmpl as Record<string, string>).title || '')
        const pdfPath = (tmpl as Record<string, string>).template_pdf_url
        if (pdfPath) {
          if (pdfPath.startsWith('http')) {
            setPdfUrl(pdfPath)
          } else {
            const { data: signed } = await supabase.storage
              .from('contracts')
              .createSignedUrl(pdfPath, 3600)
            setPdfUrl(signed?.signedUrl ?? '')
          }
        }
        const existing = (tmpl as Record<string, unknown>).sign_fields as SignFieldInput[] | null
        if (existing && Array.isArray(existing)) {
          setFields(existing.map((f, i) => ({ ...f, _id: `f_${i}_${Date.now()}` })))
        }
      }
      setLoading(false)
    })()
  }, [templateId])

  // ── 파일 업로드 ──
  const handleUploadFile = useCallback(async (file: File) => {
    if (!templateId) return
    setUploading(true)
    try {
      const ext = (file.name.split('.').pop() || '').toLowerCase()
      let pdfBlob: Blob

      if (ext === 'pdf') {
        pdfBlob = file
      } else {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/contracts/convert', { method: 'POST', body: formData })
        const result = await res.json()
        if (!res.ok) { alert(result.error || '파일 변환 실패'); setUploading(false); return }
        if (result.message) alert(result.message)
        const binaryStr = atob(result.pdfBase64)
        const bytes = new Uint8Array(binaryStr.length)
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
        pdfBlob = new Blob([bytes], { type: 'application/pdf' })
      }

      const supabase = createBrowserSupabaseClient()
      const path = `templates/${templateId}.pdf`
      const { error: uploadErr } = await supabase.storage
        .from('contracts')
        .upload(path, pdfBlob, { upsert: true, contentType: 'application/pdf' })
      if (uploadErr) { alert('업로드 실패: ' + uploadErr.message); setUploading(false); return }

      await supabase.from('contract_templates')
        .update({ template_pdf_url: path, template_type: 'pdf' })
        .eq('id', templateId)

      const { data: signed } = await supabase.storage.from('contracts').createSignedUrl(path, 3600)
      setPdfUrl(signed?.signedUrl ?? '')
    } catch { alert('업로드 중 오류가 발생했습니다') }
    setUploading(false)
  }, [templateId])

  // ── 필드 CRUD ──
  const addField = useCallback((type: SignFieldType, bindingVar?: string, label?: string) => {
    const meta = FIELD_TYPE_META[type]
    const num = fields.length + 1
    const newField: LocalField = {
      _id: `new_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      field_type: type,
      page_number: currentPage,
      x: 50, y: 10 + (num * 6) % 70,
      width: type === 'checkbox' ? 3 : type === 'seal' ? 10 : type === 'signature' ? 18 : 22,
      height: type === 'checkbox' ? 3 : type === 'seal' ? 10 : type === 'signature' ? 7 : 3,
      label: label ?? `${num}. ${meta.label}`,
      required: true,
      sort_order: fields.length,
      binding_var: bindingVar,
    }
    setFields(prev => [...prev, newField])
    setSelectedId(newField._id)
  }, [currentPage, fields.length])

  const removeField = useCallback((id: string) => {
    setFields(prev => prev.filter(f => f._id !== id))
    if (selectedId === id) setSelectedId(null)
  }, [selectedId])

  const updateField = useCallback((id: string, patch: Partial<LocalField>) => {
    setFields(prev => prev.map(f => f._id === id ? { ...f, ...patch } : f))
  }, [])

  // ── 드래그 ──
  const handleMouseDown = useCallback((e: React.MouseEvent, fieldId: string) => {
    e.preventDefault(); e.stopPropagation()
    setSelectedId(fieldId)
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const field = fields.find(f => f._id === fieldId)
    if (!field) return
    setDragging({
      id: fieldId,
      offsetX: e.clientX - rect.left - (field.x / 100) * rect.width,
      offsetY: e.clientY - rect.top - (field.y / 100) * rect.height,
    })
  }, [fields])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const newX = Math.max(0, Math.min(95, ((e.clientX - rect.left - dragging.offsetX) / rect.width) * 100))
    const newY = Math.max(0, Math.min(95, ((e.clientY - rect.top - dragging.offsetY) / rect.height) * 100))
    updateField(dragging.id, { x: Math.round(newX * 10) / 10, y: Math.round(newY * 10) / 10 })
  }, [dragging, updateField])

  const handleMouseUp = useCallback(() => { setDragging(null) }, [])

  // ── 저장 ──
  const handleSave = useCallback(async () => {
    if (!templateId) return
    setSaving(true)
    const signFields: SignFieldInput[] = fields.map((f, i) => ({
      field_type: f.field_type, page_number: f.page_number,
      x: f.x, y: f.y, width: f.width, height: f.height,
      label: f.label, required: f.required, sort_order: i,
      default_value: f.default_value, binding_var: f.binding_var,
    }))
    const supabase = createBrowserSupabaseClient()
    const { error } = await supabase.from('contract_templates')
      .update({ sign_fields: signFields as unknown as Record<string, unknown>[], template_type: 'pdf' })
      .eq('id', templateId)
    setSaving(false)
    if (error) alert('저장 실패: ' + error.message)
    else alert('필드 배치가 저장되었습니다.')
  }, [templateId, fields])

  // ── 파생 데이터 ──
  const pageFields = fields.filter(f => f.page_number === currentPage)
  const selectedField = fields.find(f => f._id === selectedId)

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-neutral-500 font-korean">로딩 중...</span>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════
  // 첫 화면: PDF 미업로드 → 문서 소스 선택
  // ════════════════════════════════════════════
  if (!pdfUrl) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        {/* 뒤로가기 */}
        <button onClick={() => router.back()}
          className="absolute top-6 left-6 flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-800 font-korean transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          돌아가기
        </button>

        <div className="w-full max-w-xl px-6">
          {/* 타이틀 */}
          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/20">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-neutral-800 font-korean">
              {title || '계약서 필드 배치'}
            </h1>
            <p className="text-sm text-neutral-500 font-korean mt-2">
              계약서 문서를 불러온 후 서명 필드를 배치하세요
            </p>
          </div>

          {/* 소스 선택 카드 */}
          <div className="grid grid-cols-2 gap-4">
            {/* 내 컴퓨터 */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-white border-2 border-transparent hover:border-blue-400 shadow-sm hover:shadow-lg transition-all group"
            >
              <div className="w-14 h-14 rounded-xl bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-neutral-800 font-korean">내 컴퓨터</p>
                <p className="text-xs text-neutral-500 font-korean mt-1">PDF, 워드, 이미지 파일</p>
              </div>
            </button>

            {/* 내 문서함 */}
            <button
              onClick={() => alert('문서함 연동 기능은 준비 중입니다.\n내 컴퓨터에서 파일을 업로드해주세요.')}
              className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-white border-2 border-transparent hover:border-purple-400 shadow-sm hover:shadow-lg transition-all group"
            >
              <div className="w-14 h-14 rounded-xl bg-purple-50 group-hover:bg-purple-100 flex items-center justify-center transition-colors">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2">
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                </svg>
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-neutral-800 font-korean">내 문서함</p>
                <p className="text-xs text-neutral-500 font-korean mt-1">기존 업로드 문서</p>
              </div>
            </button>
          </div>

          <p className="text-center text-xs text-neutral-400 font-korean mt-6">
            지원 형식: PDF, DOCX, JPG, PNG &nbsp;|&nbsp; 한글(HWP)은 PDF 변환 후 업로드
          </p>

          {uploading && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-blue-600 font-korean">파일 처리 중...</span>
            </div>
          )}

          <input ref={fileInputRef} type="file"
            accept=".pdf,.docx,.hwp,.hwpx,.jpg,.jpeg,.png,.bmp,.gif,.tiff,.tif,.webp"
            className="hidden"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUploadFile(file) }}
          />
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════
  // 메인 에디터: PDF(좌) + 설정(우) + 필드목록(하단)
  // ════════════════════════════════════════════
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-100">

      {/* ══════ 상단 바 ══════ */}
      <div className="flex items-center justify-between px-5 h-12 bg-white border-b border-neutral-200 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 font-korean transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            뒤로
          </button>
          <div className="w-px h-5 bg-neutral-200" />
          <h1 className="text-sm font-bold text-neutral-800 font-korean truncate max-w-[300px]">
            {title || '계약서 필드 배치'}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* 페이지 */}
          <div className="flex items-center gap-1 bg-neutral-50 rounded-lg px-2 py-1">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}
              className="w-6 h-6 flex items-center justify-center rounded text-neutral-400 hover:text-neutral-700 disabled:opacity-30">◀</button>
            <span className="text-xs text-neutral-600 font-medium px-1">{currentPage} / {totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}
              className="w-6 h-6 flex items-center justify-center rounded text-neutral-400 hover:text-neutral-700 disabled:opacity-30">▶</button>
          </div>

          {/* 문서 교체 */}
          <button onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-800 rounded-lg hover:bg-neutral-100 font-korean transition-colors">
            문서 교체
          </button>
          <input ref={fileInputRef} type="file"
            accept=".pdf,.docx,.hwp,.hwpx,.jpg,.jpeg,.png,.bmp,.gif,.tiff,.tif,.webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadFile(f) }}
          />

          <div className="w-px h-5 bg-neutral-200" />

          <button onClick={handleSave} disabled={saving}
            className="px-5 py-1.5 bg-blue-600 text-white text-sm font-bold font-korean rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* ══════ 메인 영역: PDF(좌측 중앙) + 설정 패널(우측) ══════ */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── PDF 미리보기 (좌측, 중앙 정렬) ── */}
        <div className="flex-1 overflow-auto flex items-start justify-center py-4 px-4 bg-neutral-200/50">
          <div
            ref={containerRef}
            className="relative bg-white shadow-2xl rounded"
            style={{ width: '100%', maxWidth: 820, aspectRatio: '595 / 841' }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={() => setSelectedId(null)}
          >
            <iframe
              src={`${pdfUrl}#page=${currentPage}`}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ border: 'none' }}
            />

            {/* 필드 오버레이 */}
            {pageFields.map((field) => {
              const meta = FIELD_TYPE_META[field.field_type]
              const isSelected = selectedId === field._id
              const num = fields.indexOf(field) + 1
              return (
                <div
                  key={field._id}
                  className={`absolute cursor-move flex items-center justify-center border-2 rounded select-none transition-shadow ${
                    isSelected ? 'shadow-xl ring-2 ring-blue-400 ring-offset-1 z-50' : 'shadow-sm hover:shadow-md z-10'
                  }`}
                  style={{
                    left: `${field.x}%`, top: `${field.y}%`,
                    width: `${field.width}%`, height: `${field.height}%`,
                    borderColor: isSelected ? '#3B82F6' : meta.color,
                    backgroundColor: isSelected ? `${meta.color}25` : `${meta.color}12`,
                    minWidth: 32, minHeight: 18,
                  }}
                  onMouseDown={(e) => handleMouseDown(e, field._id)}
                  onClick={(e) => { e.stopPropagation(); setSelectedId(field._id) }}
                >
                  {/* 라벨 태그 */}
                  <div className="absolute -top-[18px] left-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-t text-white text-[10px] font-bold whitespace-nowrap leading-none"
                    style={{ backgroundColor: meta.color }}>
                    <span>{num}.</span>
                    <span>{field.label?.replace(/^\d+\.\s*/, '') || meta.label}</span>
                    {field.binding_var && <span className="opacity-60 ml-0.5">→자동</span>}
                  </div>

                  <span style={{ color: meta.color, fontSize: '0.85rem' }}>{meta.icon}</span>

                  {/* 리사이즈 핸들 */}
                  {isSelected && (
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 cursor-se-resize"
                      style={{ backgroundColor: meta.color, borderRadius: '4px 0 2px 0' }}
                      onMouseDown={(e) => {
                        e.preventDefault(); e.stopPropagation()
                        const rect = containerRef.current?.getBoundingClientRect()
                        if (!rect) return
                        const startX = e.clientX, startY = e.clientY
                        const startW = field.width, startH = field.height
                        const onMove = (ev: MouseEvent) => {
                          const dxPct = ((ev.clientX - startX) / rect.width) * 100
                          const dyPct = ((ev.clientY - startY) / rect.height) * 100
                          updateField(field._id, {
                            width: Math.max(2, Math.round((startW + dxPct) * 10) / 10),
                            height: Math.max(1.5, Math.round((startH + dyPct) * 10) / 10),
                          })
                        }
                        const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
                        window.addEventListener('mousemove', onMove)
                        window.addEventListener('mouseup', onUp)
                      }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── 우측 패널: 입력 필드 설정 ── */}
        <div className="w-[320px] bg-white border-l border-neutral-200 flex flex-col shrink-0 overflow-hidden">

          {/* 빠른 추가 */}
          <div className="p-4 border-b border-neutral-100">
            <h2 className="text-[11px] font-bold text-neutral-400 mb-3 font-korean uppercase tracking-widest">필드 추가</h2>
            <div className="grid grid-cols-3 gap-1.5">
              {(Object.keys(FIELD_TYPE_META) as SignFieldType[]).map(type => {
                const meta = FIELD_TYPE_META[type]
                return (
                  <button key={type} onClick={() => addField(type)}
                    className="flex flex-col items-center gap-1 py-2.5 px-1 text-[10px] font-korean rounded-lg border border-neutral-100 hover:border-blue-300 hover:bg-blue-50/50 transition-all"
                    style={{ borderColor: `${meta.color}25` }}>
                    <span className="text-base">{meta.icon}</span>
                    <span className="text-neutral-600">{meta.label}</span>
                  </button>
                )
              })}
            </div>

            {/* 자주 쓰는 조합 */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button onClick={() => { addField('text', '기사명', '이름'); }}
                className="px-2.5 py-1 text-[10px] font-korean rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                + 이름
              </button>
              <button onClick={() => { addField('date', undefined, '날짜'); }}
                className="px-2.5 py-1 text-[10px] font-korean rounded-full bg-green-50 text-green-700 hover:bg-green-100 transition-colors">
                + 날짜
              </button>
              <button onClick={() => { addField('text', '생년월일', '생년월일'); }}
                className="px-2.5 py-1 text-[10px] font-korean rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                + 생년월일
              </button>
              <button onClick={() => { addField('text', '주소', '주소'); }}
                className="px-2.5 py-1 text-[10px] font-korean rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                + 주소
              </button>
              <button onClick={() => { addField('text', '전화번호', '연락처'); }}
                className="px-2.5 py-1 text-[10px] font-korean rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                + 연락처
              </button>
              <button onClick={() => { addField('signature'); }}
                className="px-2.5 py-1 text-[10px] font-korean rounded-full bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors">
                + 서명
              </button>
              <button onClick={() => { addField('seal'); }}
                className="px-2.5 py-1 text-[10px] font-korean rounded-full bg-red-50 text-red-700 hover:bg-red-100 transition-colors">
                + 도장
              </button>
              <button onClick={() => { addField('checkbox', undefined, '동의'); }}
                className="px-2.5 py-1 text-[10px] font-korean rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors">
                + 체크
              </button>
            </div>
          </div>

          {/* 선택된 필드 속성 편집 */}
          {selectedField ? (
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-bold text-neutral-400 font-korean uppercase tracking-widest">필드 설정</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold text-white"
                  style={{ backgroundColor: FIELD_TYPE_META[selectedField.field_type].color }}>
                  {FIELD_TYPE_META[selectedField.field_type].label}
                </span>
              </div>

              {/* 순번 + 라벨 */}
              <div>
                <label className="text-[11px] text-neutral-500 font-korean font-medium">순번 / 라벨</label>
                <div className="flex gap-2 mt-1">
                  <div className="w-12 h-9 flex items-center justify-center rounded-lg bg-neutral-100 text-sm font-bold text-neutral-600">
                    {fields.indexOf(selectedField) + 1}
                  </div>
                  <input type="text" value={selectedField.label ?? ''}
                    onChange={e => updateField(selectedField._id, { label: e.target.value })}
                    placeholder="예: 이름"
                    className="flex-1 h-9 px-3 text-sm rounded-lg border border-neutral-200 font-korean focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none" />
                </div>
              </div>

              {/* 바인딩 변수 */}
              {(selectedField.field_type === 'text' || selectedField.field_type === 'date') && (
                <div>
                  <label className="text-[11px] text-neutral-500 font-korean font-medium">자동 입력값 (바인딩)</label>
                  <select value={selectedField.binding_var ?? ''}
                    onChange={e => updateField(selectedField._id, { binding_var: e.target.value || undefined })}
                    className="w-full mt-1 h-9 px-3 text-sm rounded-lg border border-neutral-200 font-korean focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none">
                    {BINDING_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  {selectedField.binding_var && (
                    <p className="text-[10px] text-green-600 mt-1.5 font-korean flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      기사 서명 시 &ldquo;{selectedField.binding_var}&rdquo; 자동 기입
                    </p>
                  )}
                </div>
              )}

              {/* 위치/크기 */}
              <div>
                <label className="text-[11px] text-neutral-500 font-korean font-medium">위치 / 크기 (%)</label>
                <div className="grid grid-cols-4 gap-1.5 mt-1">
                  {[
                    { label: 'X', key: 'x' },
                    { label: 'Y', key: 'y' },
                    { label: 'W', key: 'width' },
                    { label: 'H', key: 'height' },
                  ].map(({ label, key }) => (
                    <div key={key} className="relative">
                      <span className="absolute top-1.5 left-2 text-[9px] text-neutral-400 font-bold">{label}</span>
                      <input type="number" min={0} max={100} step={0.5}
                        value={(selectedField as unknown as Record<string, number>)[key]}
                        onChange={e => updateField(selectedField._id, { [key]: +e.target.value })}
                        className="w-full h-9 pl-7 pr-1 text-xs rounded-lg border border-neutral-200 focus:ring-2 focus:ring-blue-200 outline-none" />
                    </div>
                  ))}
                </div>
              </div>

              {/* 옵션 */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={selectedField.required ?? true}
                    onChange={e => updateField(selectedField._id, { required: e.target.checked })}
                    className="rounded border-neutral-300 text-blue-600 focus:ring-blue-200" />
                  <span className="text-xs font-korean text-neutral-600">필수 항목</span>
                </label>

                <button onClick={() => removeField(selectedField._id)}
                  className="text-xs text-red-400 hover:text-red-600 font-korean transition-colors">
                  삭제
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center mx-auto mb-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                    <path d="M12 3v18M3 12h18"/>
                  </svg>
                </div>
                <p className="text-xs text-neutral-400 font-korean">
                  PDF 위의 필드를 클릭하거나<br />위에서 필드를 추가하세요
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════ 하단 바: 배치된 필드 목록 ══════ */}
      <div className="h-16 bg-white border-t border-neutral-200 flex items-center px-4 gap-2 shrink-0 overflow-x-auto">
        <span className="text-[10px] text-neutral-400 font-korean font-bold shrink-0 mr-1 uppercase tracking-wider">
          필드 {fields.length}개
        </span>

        {fields.length === 0 ? (
          <span className="text-xs text-neutral-300 font-korean">우측 패널에서 필드를 추가하세요</span>
        ) : (
          fields.map((f, idx) => {
            const meta = FIELD_TYPE_META[f.field_type]
            const isSelected = selectedId === f._id
            return (
              <button
                key={f._id}
                onClick={() => setSelectedId(f._id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-korean shrink-0 transition-all border ${
                  isSelected
                    ? 'bg-blue-50 border-blue-300 text-blue-800 shadow-sm'
                    : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                <span className="text-[10px] font-bold text-neutral-400">{idx + 1}</span>
                <span>{meta.icon}</span>
                <span className="truncate max-w-[100px]">{f.label?.replace(/^\d+\.\s*/, '') || meta.label}</span>
                {f.binding_var && (
                  <span className="text-[9px] px-1 py-0 rounded bg-green-100 text-green-700">자동</span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); removeField(f._id) }}
                  className="text-neutral-300 hover:text-red-500 transition-colors ml-0.5">×</button>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
