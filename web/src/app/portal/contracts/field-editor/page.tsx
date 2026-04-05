'use client'

/**
 * 계약서 템플릿 필드 배치 에디터 — 모두싸인 스타일 풀스크린
 *
 * 이 페이지는 (dashboard) 라우트 그룹 바깥에 위치하여
 * 사이드바 없이 전체 화면을 사용합니다.
 *
 * 레이아웃:
 *  ┌─────────────────────────────────────────────────────────────────┐
 *  │  [← 뒤로]  제목                           [문서교체] [저장]     │  상단 바
 *  ├──────┬───────────────────────────────────────────┬──────────────┤
 *  │ 도구 │                                           │ 필드 속성    │
 *  │      │         PDF 미리보기                        │ ① 이름→자동  │
 *  │ +서명 │         (중앙, 크게)                        │ ② 날짜      │  메인
 *  │ +도장 │                                           │ ③ 서명      │
 *  │ +이름 │                                           │ ④ 도장      │
 *  │ +날짜 │                                           │ X/Y/W/H    │
 *  │ +체크 │                                           │ 바인딩      │
 *  ├──────┴───────────────────────────────────────────┴──────────────┤
 *  │  [p1] [p2] [p3] ...  페이지 썸네일 (다중 페이지 시)              │  하단
 *  └─────────────────────────────────────────────────────────────────┘
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { type SignFieldType, FIELD_TYPE_META } from '@/services/document-sign-field.service'

/* ── 타입 ── */

interface SignFieldInput {
  field_type: SignFieldType
  page_number: number
  x: number; y: number; width: number; height: number
  label?: string
  required: boolean
  sort_order: number
  default_value?: string
  binding_var?: string
}

interface LocalField extends SignFieldInput { _id: string }

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

/* ── 메인 ── */

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
  const [totalPages, setTotalPages] = useState(1)
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
          if (pdfPath.startsWith('http')) { setPdfUrl(pdfPath) }
          else {
            const { data: signed } = await supabase.storage.from('contracts').createSignedUrl(pdfPath, 3600)
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

  // ── PDF 페이지 수 감지 ──
  useEffect(() => {
    if (!pdfUrl) return
    // pdf.js가 없으므로 iframe 기반으로는 페이지 수를 알기 어려움
    // 간단히 fetch로 PDF 크기 체크 (향후 pdf.js 연동 가능)
    setTotalPages(1) // 기본 1페이지, 사용자가 수동 추가
  }, [pdfUrl])

  // ── 파일 업로드 ──
  const handleUploadFile = useCallback(async (file: File) => {
    if (!templateId) return
    setUploading(true)
    try {
      const ext = (file.name.split('.').pop() || '').toLowerCase()
      let pdfBlob: Blob
      if (ext === 'pdf') { pdfBlob = file }
      else {
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
      const { error: uploadErr } = await supabase.storage.from('contracts').upload(path, pdfBlob, { upsert: true, contentType: 'application/pdf' })
      if (uploadErr) { alert('업로드 실패: ' + uploadErr.message); setUploading(false); return }
      await supabase.from('contract_templates').update({ template_pdf_url: path, template_type: 'pdf' }).eq('id', templateId)
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
      field_type: type, page_number: currentPage,
      x: 50, y: 10 + (num * 6) % 70,
      width: type === 'checkbox' ? 3 : type === 'seal' ? 10 : type === 'signature' ? 18 : 22,
      height: type === 'checkbox' ? 3 : type === 'seal' ? 10 : type === 'signature' ? 7 : 3,
      label: label ?? `${meta.label}`,
      required: true, sort_order: fields.length, binding_var: bindingVar,
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
    setDragging({ id: fieldId, offsetX: e.clientX - rect.left - (field.x / 100) * rect.width, offsetY: e.clientY - rect.top - (field.y / 100) * rect.height })
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

  const pageFields = fields.filter(f => f.page_number === currentPage)
  const selectedField = fields.find(f => f._id === selectedId)

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-neutral-500 font-korean">로딩 중...</span>
        </div>
      </div>
    )
  }

  /* ════════════════════════════════════════════
     첫 화면: 내 컴퓨터 / 내 문서함 선택
     ════════════════════════════════════════════ */
  if (!pdfUrl) {
    return (
      <div className="h-screen w-screen flex flex-col bg-gradient-to-br from-slate-50 to-blue-50/30">
        {/* 상단 */}
        <div className="flex items-center px-6 h-14 border-b border-neutral-200/60 bg-white/80 backdrop-blur shrink-0">
          <button onClick={() => router.push('/portal/contracts/templates')}
            className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-800 font-korean transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            돌아가기
          </button>
          <div className="ml-4 text-sm font-bold text-neutral-700 font-korean">{title || '템플릿 만들기'}</div>
        </div>

        {/* 중앙 */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-lg px-6">
            <div className="text-center mb-10">
              <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/20">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-neutral-800 font-korean">문서를 불러오세요</h1>
              <p className="text-sm text-neutral-500 font-korean mt-2">계약서 문서를 선택하면 서명 필드를 배치할 수 있습니다</p>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <button onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-white border-2 border-transparent hover:border-blue-400 shadow-sm hover:shadow-xl transition-all group">
                <div className="w-14 h-14 rounded-xl bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-neutral-800 font-korean">내 컴퓨터</p>
                  <p className="text-xs text-neutral-400 font-korean mt-1">PDF, 워드, 이미지</p>
                </div>
              </button>

              <button onClick={() => alert('문서함 연동 기능은 준비 중입니다.\n내 컴퓨터에서 파일을 업로드해주세요.')}
                className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-white border-2 border-transparent hover:border-purple-400 shadow-sm hover:shadow-xl transition-all group">
                <div className="w-14 h-14 rounded-xl bg-purple-50 group-hover:bg-purple-100 flex items-center justify-center transition-colors">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2">
                    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-neutral-800 font-korean">내 문서함</p>
                  <p className="text-xs text-neutral-400 font-korean mt-1">기존 업로드 문서</p>
                </div>
              </button>
            </div>

            <p className="text-center text-xs text-neutral-400 font-korean mt-8">
              지원: PDF, DOCX, JPG, PNG &nbsp;&middot;&nbsp; HWP는 PDF 변환 후 업로드
            </p>

            {uploading && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-blue-600 font-korean">파일 처리 중...</span>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept=".pdf,.docx,.hwp,.hwpx,.jpg,.jpeg,.png,.bmp,.gif,.tiff,.tif,.webp" className="hidden"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUploadFile(file) }} />
          </div>
        </div>
      </div>
    )
  }

  /* ════════════════════════════════════════════
     메인 에디터: 좌측 도구 | 중앙 PDF | 우측 필드속성 | 하단 페이지
     ════════════════════════════════════════════ */
  return (
    <div className="h-screen w-screen flex flex-col bg-neutral-100 overflow-hidden">

      {/* ══ 상단 바 ══ */}
      <div className="flex items-center justify-between px-4 h-12 bg-white border-b border-neutral-200 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/portal/contracts/templates')}
            className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 font-korean">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            뒤로
          </button>
          <div className="w-px h-5 bg-neutral-200" />
          <span className="text-sm font-bold text-neutral-800 font-korean truncate max-w-[280px]">{title || '템플릿 만들기'}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg font-korean transition-colors">문서 교체</button>
          <input ref={fileInputRef} type="file" accept=".pdf,.docx,.hwp,.hwpx,.jpg,.jpeg,.png,.bmp,.gif,.tiff,.tif,.webp" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadFile(f) }} />
          <div className="w-px h-5 bg-neutral-200" />
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-1.5 bg-blue-600 text-white text-sm font-bold font-korean rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* ══ 메인: 좌측 도구 + 중앙 PDF + 우측 필드속성 ══ */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* ── 좌측: 도구 패널 ── */}
        <div className="w-[180px] bg-white border-r border-neutral-200 flex flex-col shrink-0 overflow-y-auto">

          {/* 필드 타입 */}
          <div className="p-3 border-b border-neutral-100">
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2 font-korean">입력 필드</p>
            <div className="space-y-0.5">
              {(Object.keys(FIELD_TYPE_META) as SignFieldType[]).map(type => {
                const meta = FIELD_TYPE_META[type]
                return (
                  <button key={type} onClick={() => addField(type)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-korean rounded-lg hover:bg-neutral-50 transition-colors group text-left">
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
                      style={{ backgroundColor: `${meta.color}12`, color: meta.color }}>
                      {meta.icon}
                    </span>
                    <span className="text-neutral-700 group-hover:text-neutral-900">{meta.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 자주 쓰는 항목 */}
          <div className="p-3">
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2 font-korean">빠른 추가</p>
            <div className="grid grid-cols-2 gap-0.5">
              {[
                { label: '이름', type: 'text' as SignFieldType, bind: '기사명', color: '#2563EB' },
                { label: '날짜', type: 'date' as SignFieldType, bind: undefined, color: '#059669' },
                { label: '생년월일', type: 'text' as SignFieldType, bind: '생년월일', color: '#2563EB' },
                { label: '주소', type: 'text' as SignFieldType, bind: '주소', color: '#2563EB' },
                { label: '연락처', type: 'text' as SignFieldType, bind: '전화번호', color: '#2563EB' },
                { label: '사번', type: 'text' as SignFieldType, bind: '사번', color: '#D97706' },
                { label: '차량번호', type: 'text' as SignFieldType, bind: '차량번호', color: '#D97706' },
                { label: '계좌', type: 'text' as SignFieldType, bind: '계좌번호', color: '#D97706' },
              ].map(item => (
                <button key={item.label} onClick={() => addField(item.type, item.bind, item.label)}
                  className="px-2 py-1.5 text-[10px] font-korean rounded-lg text-left hover:bg-neutral-50 transition-colors"
                  style={{ color: item.color }}>
                  + {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── 중앙: PDF 미리보기 ── */}
        <div className="flex-1 overflow-auto flex items-start justify-center py-4 px-4 bg-neutral-200/40 min-w-0">
          <div
            ref={containerRef}
            className="relative bg-white shadow-2xl rounded"
            style={{ width: '100%', maxWidth: 850, aspectRatio: '595 / 841' }}
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
              const displayLabel = field.label || meta.label
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
                  {/* 넘버링 라벨 태그 */}
                  <div className="absolute -top-[18px] left-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-t text-white text-[10px] font-bold whitespace-nowrap leading-none"
                    style={{ backgroundColor: meta.color }}>
                    {num}. {displayLabel}
                    {field.binding_var && <span className="ml-1 opacity-60">&rarr;자동</span>}
                  </div>
                  <span style={{ color: meta.color, fontSize: '0.85rem' }}>{meta.icon}</span>

                  {/* 리사이즈 핸들 (우하단) */}
                  {isSelected && (
                    <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-blue-500 rounded-tl-sm"
                      onMouseDown={(e) => {
                        e.preventDefault(); e.stopPropagation()
                        const rect = containerRef.current?.getBoundingClientRect()
                        if (!rect) return
                        const startX = e.clientX, startY = e.clientY, startW = field.width, startH = field.height
                        const onMove = (ev: MouseEvent) => {
                          updateField(field._id, {
                            width: Math.max(2, Math.round((startW + ((ev.clientX - startX) / rect.width) * 100) * 10) / 10),
                            height: Math.max(1.5, Math.round((startH + ((ev.clientY - startY) / rect.height) * 100) * 10) / 10),
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

        {/* ── 우측: 필드 목록 + 선택 필드 속성 ── */}
        <div className="w-[260px] bg-white border-l border-neutral-200 flex flex-col shrink-0 overflow-y-auto">

          {/* 배치된 필드 넘버링 목록 */}
          <div className="p-3 border-b border-neutral-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest font-korean">배치된 필드</p>
              <span className="text-[10px] text-neutral-400 font-bold">{fields.length}개</span>
            </div>
            {fields.length === 0 ? (
              <p className="text-xs text-neutral-300 font-korean py-4 text-center">좌측 도구에서 필드를 추가하세요</p>
            ) : (
              <div className="space-y-0.5 max-h-[240px] overflow-y-auto">
                {fields.map((f, idx) => {
                  const meta = FIELD_TYPE_META[f.field_type]
                  const isSelected = selectedId === f._id
                  return (
                    <div key={f._id}
                      onClick={() => { setSelectedId(f._id); setCurrentPage(f.page_number) }}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-korean cursor-pointer transition-all ${
                        isSelected ? 'bg-blue-50 ring-1 ring-blue-300' : 'hover:bg-neutral-50'
                      }`}>
                      <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                        style={{ backgroundColor: meta.color }}>{idx + 1}</span>
                      <span className="text-sm shrink-0">{meta.icon}</span>
                      <span className="flex-1 truncate text-neutral-700">{f.label || meta.label}</span>
                      {f.binding_var && <span className="text-[8px] px-1 rounded bg-green-100 text-green-700 shrink-0">자동</span>}
                      <button onClick={(e) => { e.stopPropagation(); removeField(f._id) }}
                        className="text-neutral-300 hover:text-red-500 shrink-0 text-sm">&times;</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 선택 필드 속성 */}
          {selectedField ? (
            <div className="p-3 space-y-3 flex-1">
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest font-korean">필드 설정</p>

              {/* 순번 + 타입 */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 flex items-center justify-center rounded-lg text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: FIELD_TYPE_META[selectedField.field_type].color }}>
                  {fields.indexOf(selectedField) + 1}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-neutral-800 font-korean">{FIELD_TYPE_META[selectedField.field_type].label}</p>
                  <p className="text-[10px] text-neutral-400">P{selectedField.page_number}</p>
                </div>
              </div>

              {/* 라벨 */}
              <div>
                <label className="text-[10px] text-neutral-500 font-bold font-korean">라벨명</label>
                <input type="text" value={selectedField.label ?? ''}
                  onChange={e => updateField(selectedField._id, { label: e.target.value })}
                  placeholder="라벨명 입력"
                  className="w-full h-8 px-2.5 mt-1 text-xs rounded-lg border border-neutral-200 font-korean focus:ring-2 focus:ring-blue-300 outline-none" />
              </div>

              {/* 바인딩 변수 */}
              {(selectedField.field_type === 'text' || selectedField.field_type === 'date') && (
                <div>
                  <label className="text-[10px] text-neutral-500 font-bold font-korean">자동 입력 (바인딩)</label>
                  <select value={selectedField.binding_var ?? ''}
                    onChange={e => updateField(selectedField._id, { binding_var: e.target.value || undefined })}
                    className="w-full h-8 px-2 mt-1 text-xs rounded-lg border border-neutral-200 font-korean focus:ring-2 focus:ring-blue-300 outline-none bg-white">
                    {BINDING_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  {selectedField.binding_var && (
                    <p className="text-[9px] text-green-600 mt-1 font-korean">&check; &ldquo;{selectedField.binding_var}&rdquo; 자동 입력됩니다</p>
                  )}
                </div>
              )}

              {/* 위치 / 크기 */}
              <div>
                <label className="text-[10px] text-neutral-500 font-bold font-korean">위치 / 크기 (%)</label>
                <div className="grid grid-cols-4 gap-1.5 mt-1">
                  {([['X', 'x'], ['Y', 'y'], ['W', 'width'], ['H', 'height']] as const).map(([lbl, key]) => (
                    <div key={key} className="relative">
                      <span className="absolute top-1 left-1.5 text-[8px] text-neutral-400 font-bold">{lbl}</span>
                      <input type="number" min={0} max={100} step={0.5}
                        value={(selectedField as unknown as Record<string, number>)[key]}
                        onChange={e => updateField(selectedField._id, { [key]: +e.target.value })}
                        className="w-full h-8 pl-6 pr-1 text-[10px] rounded-lg border border-neutral-200 focus:ring-1 focus:ring-blue-300 outline-none" />
                    </div>
                  ))}
                </div>
              </div>

              {/* 필수 / 삭제 */}
              <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={selectedField.required ?? true}
                    onChange={e => updateField(selectedField._id, { required: e.target.checked })}
                    className="rounded border-neutral-300 text-blue-600 w-3.5 h-3.5" />
                  <span className="text-[10px] font-korean text-neutral-600">필수 입력</span>
                </label>
                <button onClick={() => removeField(selectedField._id)}
                  className="text-[10px] text-red-400 hover:text-red-600 font-korean px-2 py-1 rounded hover:bg-red-50 transition-colors">삭제</button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-4">
              <p className="text-xs text-neutral-300 font-korean text-center">
                PDF 위의 필드를 클릭하면<br/>설정을 편집할 수 있습니다
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ══ 하단: 페이지 네비게이션 + 썸네일 ══ */}
      <div className="h-12 bg-white border-t border-neutral-200 flex items-center px-4 gap-3 shrink-0 shadow-inner">
        <span className="text-[10px] text-neutral-400 font-bold shrink-0 font-korean">페이지</span>
        <div className="flex items-center gap-1 overflow-x-auto flex-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(pg => (
            <button key={pg} onClick={() => setCurrentPage(pg)}
              className={`w-8 h-8 rounded-lg text-xs font-bold shrink-0 transition-all ${
                currentPage === pg
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
              }`}>
              {pg}
            </button>
          ))}
          <button onClick={() => setTotalPages(p => p + 1)}
            className="w-8 h-8 rounded-lg text-xs text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 shrink-0 transition-colors"
            title="페이지 추가">+</button>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-neutral-400 shrink-0">
          <span className="font-korean">{fields.length}개 필드</span>
          <span>&middot;</span>
          <span>{currentPage} / {totalPages} 페이지</span>
        </div>
      </div>
    </div>
  )
}
