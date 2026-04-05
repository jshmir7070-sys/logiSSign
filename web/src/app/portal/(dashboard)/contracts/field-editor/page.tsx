'use client'

/**
 * 계약서 템플릿 필드 배치 에디터
 *
 * PDF 업로드 후 서명/도장/체크/날짜/텍스트 필드를
 * 드래그&드롭으로 배치 → contract_templates.sign_fields에 저장
 *
 * URL: /portal/contracts/field-editor?templateId=xxxx
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { type SignFieldType, FIELD_TYPE_META } from '@/services/document-sign-field.service'

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
  binding_var?: string // {{기사명}} 등 자동 바인딩 변수
}

interface LocalField extends SignFieldInput {
  _id: string
}

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
  const [zoom, setZoom] = useState(100)
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

  // ── PDF 업로드 ──
  const handleUploadPdf = useCallback(async (file: File) => {
    if (!templateId) return
    setUploading(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const ext = file.name.split('.').pop() || 'pdf'
      const path = `templates/${templateId}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('contracts')
        .upload(path, file, { upsert: true, contentType: 'application/pdf' })

      if (uploadErr) {
        alert('PDF 업로드 실패: ' + uploadErr.message)
        setUploading(false)
        return
      }

      // DB 업데이트
      await supabase
        .from('contract_templates')
        .update({ template_pdf_url: path, template_type: 'pdf' })
        .eq('id', templateId)

      // signed URL 재생성
      const { data: signed } = await supabase.storage
        .from('contracts')
        .createSignedUrl(path, 3600)
      setPdfUrl(signed?.signedUrl ?? '')
    } catch {
      alert('업로드 중 오류')
    }
    setUploading(false)
  }, [templateId])

  // ── 필드 추가 ──
  const addField = useCallback((type: SignFieldType) => {
    const meta = FIELD_TYPE_META[type]
    const newField: LocalField = {
      _id: `new_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      field_type: type,
      page_number: currentPage,
      x: 40, y: 40,
      width: meta.defaultWidth,
      height: meta.defaultHeight,
      label: meta.label,
      required: true,
      sort_order: fields.length,
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
    e.preventDefault()
    e.stopPropagation()
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

  // ── 저장 (contract_templates.sign_fields) ──
  const handleSave = useCallback(async () => {
    if (!templateId) return
    setSaving(true)
    const signFields: SignFieldInput[] = fields.map((f, i) => ({
      field_type: f.field_type,
      page_number: f.page_number,
      x: f.x, y: f.y,
      width: f.width, height: f.height,
      label: f.label,
      required: f.required,
      sort_order: i,
      default_value: f.default_value,
      binding_var: f.binding_var,
    }))

    const supabase = createBrowserSupabaseClient()
    const { error } = await supabase
      .from('contract_templates')
      .update({ sign_fields: signFields as unknown as Record<string, unknown>[], template_type: 'pdf' })
      .eq('id', templateId)

    setSaving(false)
    if (error) {
      alert('저장 실패: ' + error.message)
    } else {
      alert('필드 배치가 저장되었습니다.')
    }
  }, [templateId, fields])

  const pageFields = fields.filter(f => f.page_number === currentPage)
  const selectedField = fields.find(f => f._id === selectedId)

  if (loading) {
    return <div className="flex items-center justify-center h-96 text-on-surface-variant/60 font-korean">로딩 중...</div>
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 -mx-8 -mt-8" style={{ width: 'calc(100% + 4rem)' }}>
      {/* ══════ 좌측: PDF 미리보기 + 필드 오버레이 ══════ */}
      <div className="flex-1 flex flex-col bg-neutral-100 overflow-hidden">
        {/* 상단 바 */}
        <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-outline-variant/20">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()}
              className="text-sm text-on-surface-variant/60 hover:text-on-surface font-korean">← 뒤로</button>
            <h1 className="text-sm font-bold text-on-surface font-korean truncate max-w-xs">
              {title || '계약서 필드 배치'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setZoom(z => Math.max(50, z - 10))} className="px-2 py-1 text-xs rounded border border-outline-variant/30 hover:bg-surface-variant/30">−</button>
            <span className="text-xs font-data text-on-surface-variant w-10 text-center">{zoom}%</span>
            <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="px-2 py-1 text-xs rounded border border-outline-variant/30 hover:bg-surface-variant/30">+</button>
            <span className="mx-1 text-outline-variant/30">|</span>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}
              className="px-2 py-1 text-xs rounded border border-outline-variant/30 disabled:opacity-30">◀</button>
            <span className="text-xs font-korean text-on-surface-variant">{currentPage} / {totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}
              className="px-2 py-1 text-xs rounded border border-outline-variant/30 disabled:opacity-30">▶</button>
          </div>

          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 bg-primary text-white text-sm font-bold font-korean rounded-lg hover:bg-primary/90 disabled:opacity-50">
            {saving ? '저장 중...' : '필드 저장'}
          </button>
        </div>

        {/* PDF + 오버레이 */}
        <div className="flex-1 overflow-auto p-4 flex justify-center">
          <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}>
            {!pdfUrl ? (
              /* PDF 미업로드 시 업로드 안내 */
              <div
                className="relative bg-white shadow-lg flex flex-col items-center justify-center cursor-pointer hover:bg-surface-container-low/50 transition-colors"
                style={{ width: 794, height: 1123 }}
                onClick={() => fileInputRef.current?.click()}
              >
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-on-surface-variant/30 mb-4">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="12" y2="12"/>
                  <line x1="15" y1="15" x2="12" y2="12"/>
                </svg>
                <p className="text-sm text-on-surface-variant font-korean">PDF 파일을 업로드하세요</p>
                <p className="text-xs text-on-surface-variant/50 mt-1 font-korean">클릭하여 파일 선택</p>
                <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleUploadPdf(file)
                  }} />
                {uploading && <p className="text-xs text-primary mt-3 font-korean">업로드 중...</p>}
              </div>
            ) : (
              <div
                ref={containerRef}
                className="relative bg-white shadow-lg"
                style={{ width: 794, height: 1123, minWidth: 794 }}
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
                {pageFields.map(field => {
                  const meta = FIELD_TYPE_META[field.field_type]
                  const isSelected = selectedId === field._id
                  return (
                    <div
                      key={field._id}
                      className={`absolute cursor-move flex items-center justify-center text-xs font-korean border-2 rounded transition-shadow ${
                        isSelected ? 'shadow-lg ring-2 ring-offset-1' : 'shadow-sm'
                      }`}
                      style={{
                        left: `${field.x}%`, top: `${field.y}%`,
                        width: `${field.width}%`, height: `${field.height}%`,
                        borderColor: meta.color,
                        backgroundColor: `${meta.color}18`,
                        zIndex: isSelected ? 50 : 10,
                      }}
                      onMouseDown={(e) => handleMouseDown(e, field._id)}
                      onClick={(e) => { e.stopPropagation(); setSelectedId(field._id) }}
                    >
                      <span style={{ color: meta.color, fontSize: '0.7rem', opacity: 0.7 }}>{meta.icon}</span>
                      {isSelected && (
                        <div
                          className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize"
                          style={{ backgroundColor: meta.color, borderRadius: '0 0 3px 0' }}
                          onMouseDown={(e) => {
                            e.preventDefault(); e.stopPropagation()
                            const rect = containerRef.current?.getBoundingClientRect()
                            if (!rect) return
                            const startX = e.clientX, startY = e.clientY
                            const startW = field.width, startH = field.height
                            const onMove = (ev: MouseEvent) => {
                              const dxPct = ((ev.clientX - startX) / rect.width) * 100 / (zoom / 100)
                              const dyPct = ((ev.clientY - startY) / rect.height) * 100 / (zoom / 100)
                              updateField(field._id, {
                                width: Math.max(1, Math.round((startW + dxPct) * 10) / 10),
                                height: Math.max(1, Math.round((startH + dyPct) * 10) / 10),
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
            )}
          </div>
        </div>
      </div>

      {/* ══════ 우측: 도구 패널 ══════ */}
      <div className="w-72 bg-white border-l border-outline-variant/20 flex flex-col shrink-0">
        {/* PDF 교체 */}
        {pdfUrl && (
          <div className="p-4 border-b border-outline-variant/20">
            <button onClick={() => fileInputRef.current?.click()}
              className="w-full h-9 rounded-lg bg-surface-container-high text-on-surface-variant text-xs font-korean hover:bg-surface-container-highest transition-colors">
              PDF 교체
            </button>
            <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadPdf(f) }} />
          </div>
        )}

        {/* 필드 추가 */}
        <div className="p-4 border-b border-outline-variant/20">
          <h2 className="text-xs font-bold text-on-surface-variant/60 mb-3 font-korean">입력 필드 추가</h2>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(FIELD_TYPE_META) as SignFieldType[]).map(type => {
              const meta = FIELD_TYPE_META[type]
              return (
                <button key={type} onClick={() => addField(type)}
                  className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-korean rounded-lg border border-outline-variant/20 hover:bg-surface-variant/30 transition-colors"
                  style={{ borderColor: `${meta.color}40` }}>
                  <span>{meta.icon}</span>
                  <span>{meta.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 배치된 필드 목록 */}
        <div className="flex-1 overflow-auto p-4">
          <h2 className="text-xs font-bold text-on-surface-variant/60 mb-2 font-korean">
            배치된 필드 ({fields.length}개)
          </h2>
          {fields.length === 0 ? (
            <p className="text-xs text-on-surface-variant/40 font-korean">위 버튼으로 필드를 추가하세요</p>
          ) : (
            <div className="space-y-1.5">
              {fields.map(f => {
                const meta = FIELD_TYPE_META[f.field_type]
                const isSelected = selectedId === f._id
                return (
                  <div key={f._id}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-korean cursor-pointer transition-colors ${
                      isSelected ? 'bg-primary/10 border border-primary/30' : 'bg-surface-variant/20 hover:bg-surface-variant/40'
                    }`}
                    onClick={() => setSelectedId(f._id)}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span>{meta.icon}</span>
                      <span className="truncate">{f.label || meta.label}</span>
                      <span className="text-on-surface-variant/40">p{f.page_number}</span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); removeField(f._id) }}
                      className="text-red-400 hover:text-red-600 ml-1 shrink-0">✕</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 선택된 필드 속성 */}
        {selectedField && (
          <div className="p-4 border-t border-outline-variant/20 space-y-3">
            <h2 className="text-xs font-bold text-on-surface-variant/60 font-korean">필드 속성</h2>
            <label className="block">
              <span className="text-[0.65rem] text-on-surface-variant/60 font-korean">라벨</span>
              <input type="text" value={selectedField.label ?? ''}
                onChange={e => updateField(selectedField._id, { label: e.target.value })}
                className="w-full mt-0.5 px-2 py-1.5 text-xs rounded border border-outline-variant/30 font-korean" />
            </label>
            {selectedField.field_type === 'text' && (
              <label className="block">
                <span className="text-[0.65rem] text-on-surface-variant/60 font-korean">자동 바인딩 변수</span>
                <select value={selectedField.binding_var ?? ''}
                  onChange={e => updateField(selectedField._id, { binding_var: e.target.value || undefined })}
                  className="w-full mt-0.5 px-2 py-1.5 text-xs rounded border border-outline-variant/30 font-korean">
                  <option value="">직접 입력 (바인딩 없음)</option>
                  <option value="기사명">기사명</option>
                  <option value="전화번호">전화번호</option>
                  <option value="주소">주소</option>
                  <option value="사번">사번</option>
                  <option value="배송지역">배송지역</option>
                  <option value="생년월일">생년월일</option>
                  <option value="사업자번호">사업자번호</option>
                  <option value="대표자명">대표자명</option>
                  <option value="배송단가">배송단가</option>
                  <option value="반품단가">반품단가</option>
                  <option value="계좌번호">계좌번호</option>
                  <option value="은행명">은행명</option>
                  <option value="예금주">예금주</option>
                  <option value="차량번호">차량번호</option>
                  <option value="계약시작일">계약시작일</option>
                  <option value="계약종료일">계약종료일</option>
                  <option value="대리점명">대리점명</option>
                </select>
              </label>
            )}
            <div className="grid grid-cols-2 gap-2">
              {[['X (%)', 'x'], ['Y (%)', 'y'], ['너비 (%)', 'width'], ['높이 (%)', 'height']].map(([lbl, key]) => (
                <label key={key} className="block">
                  <span className="text-[0.65rem] text-on-surface-variant/60 font-korean">{lbl}</span>
                  <input type="number" min={0} max={100} step={0.5}
                    value={(selectedField as unknown as Record<string, number>)[key]}
                    onChange={e => updateField(selectedField._id, { [key]: +e.target.value })}
                    className="w-full mt-0.5 px-2 py-1.5 text-xs rounded border border-outline-variant/30" />
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={selectedField.required ?? true}
                onChange={e => updateField(selectedField._id, { required: e.target.checked })} className="rounded" />
              <span className="text-xs font-korean text-on-surface-variant">필수 항목</span>
            </label>
          </div>
        )}
      </div>
    </div>
  )
}
