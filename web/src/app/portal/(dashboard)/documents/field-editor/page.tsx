'use client'

/**
 * 문서 서명 필드 배치 에디터
 *
 * PDF 미리보기 위에 서명/도장/체크/날짜/텍스트 필드를
 * 드래그&드롭으로 배치한 뒤 저장한다.
 *
 * URL: /portal/documents/field-editor?docId=xxxx
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import {
  type SignField,
  type SignFieldInput,
  type SignFieldType,
  FIELD_TYPE_META,
  getSignFields,
  saveSignFields,
} from '@/services/document-sign-field.service'

/* ══════════════════════ 타입 ══════════════════════ */

interface LocalField extends SignFieldInput {
  _id: string   // 클라이언트 임시 ID
}

/* ══════════════════════ 메인 컴포넌트 ══════════════════════ */

export default function FieldEditorPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const docId = searchParams.get('docId') ?? ''

  const [docTitle, setDocTitle] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  const [fields, setFields] = useState<LocalField[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)

  // ── 데이터 로드 ──
  useEffect(() => {
    if (!docId) return
    ;(async () => {
      const supabase = createBrowserSupabaseClient()

      // 문서 정보
      const { data: doc } = await supabase
        .from('document_files')
        .select('title, file_url')
        .eq('id', docId)
        .single()

      if (doc) {
        setDocTitle(doc.title)
        setPdfUrl(doc.file_url)
      }

      // 기존 필드
      const existing = await getSignFields(docId)
      setFields(existing.map(f => ({
        _id: f.id,
        field_type: f.field_type,
        page_number: f.page_number,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        label: f.label ?? undefined,
        required: f.required,
        sort_order: f.sort_order,
        default_value: f.default_value ?? undefined,
      })))

      setLoading(false)
    })()
  }, [docId])

  // ── 필드 추가 ──
  const addField = useCallback((type: SignFieldType) => {
    const meta = FIELD_TYPE_META[type]
    const newField: LocalField = {
      _id: `new_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      field_type: type,
      page_number: currentPage,
      x: 40,
      y: 40,
      width: meta.defaultWidth,
      height: meta.defaultHeight,
      label: meta.label,
      required: true,
      sort_order: fields.length,
    }
    setFields(prev => [...prev, newField])
    setSelectedId(newField._id)
  }, [currentPage, fields.length])

  // ── 필드 삭제 ──
  const removeField = useCallback((id: string) => {
    setFields(prev => prev.filter(f => f._id !== id))
    if (selectedId === id) setSelectedId(null)
  }, [selectedId])

  // ── 필드 속성 수정 ──
  const updateField = useCallback((id: string, patch: Partial<LocalField>) => {
    setFields(prev => prev.map(f => f._id === id ? { ...f, ...patch } : f))
  }, [])

  // ── 마우스 드래그 ──
  const handleMouseDown = useCallback((e: React.MouseEvent, fieldId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedId(fieldId)
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const field = fields.find(f => f._id === fieldId)
    if (!field) return
    const fieldPxX = (field.x / 100) * rect.width
    const fieldPxY = (field.y / 100) * rect.height
    setDragging({
      id: fieldId,
      offsetX: e.clientX - rect.left - fieldPxX,
      offsetY: e.clientY - rect.top - fieldPxY,
    })
  }, [fields])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const newX = Math.max(0, Math.min(95, ((e.clientX - rect.left - dragging.offsetX) / rect.width) * 100))
    const newY = Math.max(0, Math.min(95, ((e.clientY - rect.top - dragging.offsetY) / rect.height) * 100))
    updateField(dragging.id, { x: Math.round(newX * 10) / 10, y: Math.round(newY * 10) / 10 })
  }, [dragging, updateField])

  const handleMouseUp = useCallback(() => {
    setDragging(null)
  }, [])

  // ── 저장 ──
  const handleSave = useCallback(async () => {
    if (!docId) return
    setSaving(true)
    const inputs: SignFieldInput[] = fields.map((f, i) => ({
      field_type: f.field_type,
      page_number: f.page_number,
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
      label: f.label,
      required: f.required,
      sort_order: i,
      default_value: f.default_value,
    }))
    const { error } = await saveSignFields(docId, inputs)
    setSaving(false)
    if (error) {
      alert(`저장 실패: ${error}`)
    } else {
      alert('필드 배치가 저장되었습니다.')
    }
  }, [docId, fields])

  // ── 현재 페이지 필드만 표시 ──
  const pageFields = fields.filter(f => f.page_number === currentPage)
  const selectedField = fields.find(f => f._id === selectedId)

  if (loading) {
    return <div className="flex items-center justify-center h-96 text-on-surface-variant/60 font-korean">로딩 중...</div>
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0">
      {/* ══════ 좌측: PDF 미리보기 + 필드 오버레이 ══════ */}
      <div className="flex-1 flex flex-col bg-neutral-100 overflow-hidden">
        {/* 상단 바 */}
        <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-outline-variant/20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="text-sm text-on-surface-variant/60 hover:text-on-surface font-korean"
            >
              ← 뒤로
            </button>
            <h1 className="text-sm font-bold text-on-surface font-korean truncate max-w-xs">
              {docTitle || '문서 필드 배치'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* 페이지 네비 */}
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-2 py-1 text-xs rounded border border-outline-variant/30 disabled:opacity-30"
            >
              ◀
            </button>
            <span className="text-xs font-korean text-on-surface-variant">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-2 py-1 text-xs rounded border border-outline-variant/30 disabled:opacity-30"
            >
              ▶
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-amber-500 text-white text-sm font-bold font-korean rounded-lg hover:bg-amber-600 disabled:opacity-50"
          >
            {saving ? '저장 중...' : '필드 저장'}
          </button>
        </div>

        {/* PDF + 오버레이 */}
        <div className="flex-1 overflow-auto p-4 flex justify-center">
          <div
            ref={containerRef}
            className="relative bg-white shadow-lg"
            style={{ width: 595, height: 841, minWidth: 595 }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={() => setSelectedId(null)}
          >
            {/* PDF 배경 (iframe 또는 이미지) */}
            {pdfUrl && (
              <iframe
                src={`${pdfUrl}#page=${currentPage}`}
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ border: 'none' }}
              />
            )}

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
                    left: `${field.x}%`,
                    top: `${field.y}%`,
                    width: `${field.width}%`,
                    height: `${field.height}%`,
                    borderColor: meta.color,
                    backgroundColor: `${meta.color}18`,
                    outlineColor: meta.color,
                    zIndex: isSelected ? 50 : 10,
                  }}
                  onMouseDown={(e) => handleMouseDown(e, field._id)}
                  onClick={(e) => { e.stopPropagation(); setSelectedId(field._id) }}
                >
                  <span style={{ color: meta.color, fontSize: '0.65rem' }}>
                    {meta.icon} {field.label || meta.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ══════ 우측: 도구 패널 ══════ */}
      <div className="w-72 bg-white border-l border-outline-variant/20 flex flex-col">
        {/* 필드 추가 버튼들 */}
        <div className="p-4 border-b border-outline-variant/20">
          <h2 className="text-xs font-bold text-on-surface-variant/60 mb-3 font-korean">필드 추가</h2>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(FIELD_TYPE_META) as SignFieldType[]).map(type => {
              const meta = FIELD_TYPE_META[type]
              return (
                <button
                  key={type}
                  onClick={() => addField(type)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-korean rounded-lg border border-outline-variant/20 hover:bg-surface-variant/30 transition-colors"
                  style={{ borderColor: `${meta.color}40` }}
                >
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
            <p className="text-xs text-on-surface-variant/40 font-korean">
              왼쪽 위의 버튼으로 필드를 추가하세요
            </p>
          ) : (
            <div className="space-y-1.5">
              {fields.map((f, i) => {
                const meta = FIELD_TYPE_META[f.field_type]
                const isSelected = selectedId === f._id
                return (
                  <div
                    key={f._id}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-korean cursor-pointer transition-colors ${
                      isSelected ? 'bg-amber-50 border border-amber-300' : 'bg-surface-variant/20 hover:bg-surface-variant/40'
                    }`}
                    onClick={() => setSelectedId(f._id)}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span>{meta.icon}</span>
                      <span className="truncate">{f.label || meta.label}</span>
                      <span className="text-on-surface-variant/40">p{f.page_number}</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeField(f._id) }}
                      className="text-red-400 hover:text-red-600 ml-1 shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 선택된 필드 속성 편집 */}
        {selectedField && (
          <div className="p-4 border-t border-outline-variant/20 space-y-3">
            <h2 className="text-xs font-bold text-on-surface-variant/60 font-korean">필드 속성</h2>

            <label className="block">
              <span className="text-[0.65rem] text-on-surface-variant/60 font-korean">라벨</span>
              <input
                type="text"
                value={selectedField.label ?? ''}
                onChange={e => updateField(selectedField._id, { label: e.target.value })}
                className="w-full mt-0.5 px-2 py-1.5 text-xs rounded border border-outline-variant/30 font-korean"
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[0.65rem] text-on-surface-variant/60 font-korean">X (%)</span>
                <input
                  type="number"
                  min={0} max={100} step={0.5}
                  value={selectedField.x}
                  onChange={e => updateField(selectedField._id, { x: +e.target.value })}
                  className="w-full mt-0.5 px-2 py-1.5 text-xs rounded border border-outline-variant/30"
                />
              </label>
              <label className="block">
                <span className="text-[0.65rem] text-on-surface-variant/60 font-korean">Y (%)</span>
                <input
                  type="number"
                  min={0} max={100} step={0.5}
                  value={selectedField.y}
                  onChange={e => updateField(selectedField._id, { y: +e.target.value })}
                  className="w-full mt-0.5 px-2 py-1.5 text-xs rounded border border-outline-variant/30"
                />
              </label>
              <label className="block">
                <span className="text-[0.65rem] text-on-surface-variant/60 font-korean">너비 (%)</span>
                <input
                  type="number"
                  min={1} max={50} step={0.5}
                  value={selectedField.width}
                  onChange={e => updateField(selectedField._id, { width: +e.target.value })}
                  className="w-full mt-0.5 px-2 py-1.5 text-xs rounded border border-outline-variant/30"
                />
              </label>
              <label className="block">
                <span className="text-[0.65rem] text-on-surface-variant/60 font-korean">높이 (%)</span>
                <input
                  type="number"
                  min={1} max={50} step={0.5}
                  value={selectedField.height}
                  onChange={e => updateField(selectedField._id, { height: +e.target.value })}
                  className="w-full mt-0.5 px-2 py-1.5 text-xs rounded border border-outline-variant/30"
                />
              </label>
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedField.required ?? true}
                onChange={e => updateField(selectedField._id, { required: e.target.checked })}
                className="rounded"
              />
              <span className="text-xs font-korean text-on-surface-variant">필수 항목</span>
            </label>
          </div>
        )}
      </div>
    </div>
  )
}
