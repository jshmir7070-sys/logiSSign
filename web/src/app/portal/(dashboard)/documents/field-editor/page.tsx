'use client'

/**
 * 臾몄꽌 ?쒕챸 ?꾨뱶 諛곗튂 ?먮뵒?? *
 * PDF 誘몃━蹂닿린 ?꾩뿉 ?쒕챸/?꾩옣/泥댄겕/?좎쭨/?띿뒪???꾨뱶瑜? * ?쒕옒洹??쒕∼?쇰줈 諛곗튂??????ν븳??
 *
 * URL: /portal/documents/field-editor?docId=xxxx
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import {
  type SignFieldInput,
  type SignFieldType,
  FIELD_TYPE_META,
  getSignFields,
  saveSignFields,
} from '@/services/document-sign-field.service'

/* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 ????먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */

interface LocalField extends SignFieldInput {
  _id: string   // ?대씪?댁뼵???꾩떆 ID
}

function isPlaceholderDocumentTitle(title: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.pdf$/i.test(title.trim())
}

/* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 硫붿씤 而댄룷?뚰듃 ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */

export default function FieldEditorPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const docId = searchParams.get('docId') ?? ''
  const isDraftSession = searchParams.get('draft') === '1'
  const returnTarget = searchParams.get('from') === 'templates'
    ? '/portal/contracts/templates'
    : '/portal/documents'

  const [docTitle, setDocTitle] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  const [fields, setFields] = useState<LocalField[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, _setTotalPages] = useState(1)
  const [zoom, setZoom] = useState(100)
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [savedSnapshot, setSavedSnapshot] = useState('')

  const containerRef = useRef<HTMLDivElement>(null)
  const cleanedUpRef = useRef(false)
  const savedRef = useRef(false)

  const createSnapshot = useCallback((title: string, nextFields: LocalField[]) => (
    JSON.stringify({
      title: title.trim(),
      fields: nextFields.map((field, index) => ({
        field_type: field.field_type,
        page_number: field.page_number,
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        label: field.label ?? '',
        required: field.required,
        sort_order: index,
        default_value: field.default_value ?? '',
      })),
    })
  ), [])

  const cleanupDraft = useCallback(async (keepalive = false) => {
    if (!isDraftSession || !docId || cleanedUpRef.current || savedRef.current) return
    cleanedUpRef.current = true

    try {
      await fetch(`/api/documents/draft?docId=${docId}`, {
        method: 'DELETE',
        keepalive,
      })
    } catch (error) {
      console.error('임시 문서 정리 실패:', error)
    }
  }, [docId, isDraftSession])

  // ?? ?곗씠??濡쒕뱶 ??
  useEffect(() => {
    if (!docId) return
    ;(async () => {
      const supabase = createBrowserSupabaseClient()

      // 臾몄꽌 ?뺣낫
      const { data: doc } = await supabase
        .from('document_files')
        .select('title, file_url')
        .eq('id', docId)
        .single()

      if (doc) {
        setDocTitle(doc.title)
        // file_url??Storage path媛 ??λ맖 ??signed URL ?앹꽦
        const storagePath = doc.file_url as string
        if (storagePath && !storagePath.startsWith('http')) {
          const { data: signedData } = await supabase.storage
            .from('documents')
            .createSignedUrl(storagePath, 3600)
          setPdfUrl(signedData?.signedUrl ?? '')
        } else if (storagePath) {
          // ?댁쟾 諛⑹떇 (full URL ??λ맂 寃쎌슦)
          const pathPart = storagePath.split('/documents/')[1]
          if (pathPart) {
            const { data: signedData } = await supabase.storage
              .from('documents')
              .createSignedUrl(decodeURIComponent(pathPart), 3600)
            setPdfUrl(signedData?.signedUrl ?? storagePath)
          } else {
            setPdfUrl(storagePath)
          }
        }
      }

      // 湲곗〈 ?꾨뱶
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
      setSavedSnapshot(createSnapshot(doc?.title ?? '', existing.map(f => ({
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
      }))))

      setLoading(false)
    })()
  }, [docId, createSnapshot])

  useEffect(() => {
    if (loading) return
    setHasUnsavedChanges(createSnapshot(docTitle, fields) !== savedSnapshot)
  }, [createSnapshot, docTitle, fields, loading, savedSnapshot])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges && !isDraftSession) return
      event.preventDefault()
      event.returnValue = ''
    }

    const handlePageHide = () => {
      if (isDraftSession && !savedRef.current) {
        void cleanupDraft(true)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handlePageHide)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [cleanupDraft, hasUnsavedChanges, isDraftSession])

  useEffect(() => (
    () => {
      if (isDraftSession && !savedRef.current) {
        void cleanupDraft(true)
      }
    }
  ), [cleanupDraft, isDraftSession])

  // ?? ?꾨뱶 異붽? ??
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

  // ?? ?꾨뱶 蹂듭젣 ??
  const duplicateField = useCallback((id: string) => {
    const source = fields.find(f => f._id === id)
    if (!source) return
    const cloned: LocalField = {
      ...source,
      _id: `new_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: `${source.label || FIELD_TYPE_META[source.field_type].label} (蹂듭궗)`,
      // ?댁쭩 ?ㅽ봽?뗭쓣 以섏꽌 寃뱀튂吏 ?딄쾶
      x: Math.min(95, source.x + 2),
      y: Math.min(95, source.y + 2),
      sort_order: fields.length,
    }
    setFields(prev => [...prev, cloned])
    setSelectedId(cloned._id)
  }, [fields])

  // ?? ?꾨뱶 ??젣 ??
  const removeField = useCallback((id: string) => {
    setFields(prev => prev.filter(f => f._id !== id))
    if (selectedId === id) setSelectedId(null)
  }, [selectedId])

  // ?? ?꾨뱶 ?띿꽦 ?섏젙 ??
  const updateField = useCallback((id: string, patch: Partial<LocalField>) => {
    setFields(prev => prev.map(f => f._id === id ? { ...f, ...patch } : f))
  }, [])

  // ?? 留덉슦???쒕옒洹???
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

  // ?? ?????
  const handleSave = useCallback(async () => {
    if (!docId) return
    const trimmedTitle = docTitle.trim()
    if (!trimmedTitle) {
      alert('\uBB38\uC11C \uC774\uB984\uC744 \uC785\uB825\uD55C \uB4A4 \uC800\uC7A5\uD574 \uC8FC\uC138\uC694.')
      return
    }
    if (isPlaceholderDocumentTitle(trimmedTitle)) {
      alert('\uBB38\uC11C \uC774\uB984\uC774 \uC784\uC2DC \uD30C\uC77C\uBA85\uC73C\uB85C \uBCF4\uC785\uB2C8\uB2E4. \uC2E4\uC81C \uBB38\uC11C \uC774\uB984\uC73C\uB85C \uBC14\uAFBC \uB4A4 \uC800\uC7A5\uD574 \uC8FC\uC138\uC694.')
      return
    }
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

    // ?꾨뱶 ????깃났 ??臾몄꽌 ?곹깭瑜?'ready'濡?蹂寃?
    if (!error) {
      const supabase = createBrowserSupabaseClient()
      await supabase
        .from('document_files')
        .update({ title: trimmedTitle, status: 'ready' })
        .eq('id', docId)
    }

    setSaving(false)
    if (error) {
      alert(`????ㅽ뙣: ${error}`)
    } else {
      savedRef.current = true
      setSavedSnapshot(createSnapshot(trimmedTitle, fields))
      setHasUnsavedChanges(false)
      alert('필드가 저장되었습니다. 내 문서함으로 이동합니다.')
      router.push('/portal/documents')
    }
  }, [docId, docTitle, fields, router, createSnapshot])

  const handleExit = useCallback(async () => {
    if (hasUnsavedChanges || isDraftSession) {
      const confirmed = confirm('저장하지 않은 변경사항이 있습니다. 저장하지 않고 나가시겠습니까?')
      if (!confirmed) return
    }

    if (isDraftSession && !savedRef.current) {
      await cleanupDraft()
    }

    router.push(returnTarget)
  }, [cleanupDraft, hasUnsavedChanges, isDraftSession, returnTarget, router])

  // ?? ?꾩옱 ?섏씠吏 ?꾨뱶留??쒖떆 ??
  const pageFields = fields.filter(f => f.page_number === currentPage)
  const selectedField = fields.find(f => f._id === selectedId)

  if (loading) {
    return <div className="flex items-center justify-center h-96 text-on-surface-variant/60 font-korean">濡쒕뵫 以?..</div>
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 -mx-8 -mt-8" style={{ width: 'calc(100% + 4rem)' }}>
      {/* ?먥븧?먥븧?먥븧 醫뚯륫: PDF 誘몃━蹂닿린 + ?꾨뱶 ?ㅻ쾭?덉씠 ?먥븧?먥븧?먥븧 */}
      <div className="flex-1 flex flex-col bg-neutral-100 overflow-hidden">
        {/* ?곷떒 諛?*/}
        <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-outline-variant/20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                void handleExit()
              }}
              className="text-sm text-on-surface-variant/60 hover:text-on-surface font-korean"
            >
              {'\uB4A4\uB85C'}
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-bold text-on-surface font-korean shrink-0">
                {'\uBB38\uC11C \uC774\uB984'}
              </span>
              <input
                type="text"
                value={docTitle}
                onChange={(event) => setDocTitle(event.target.value)}
                placeholder={'\uBB38\uC11C \uC774\uB984\uC744 \uC785\uB825\uD574 \uC8FC\uC138\uC694'}
                className="h-9 w-72 max-w-full rounded-lg border border-outline-variant/30 bg-white px-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-amber-300/50 font-korean"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom((value) => Math.max(50, value - 10))}
              className="px-2 py-1 text-xs rounded border border-outline-variant/30 hover:bg-surface-variant/30"
            >
              -
            </button>
            <span className="text-xs font-data text-on-surface-variant w-10 text-center">{zoom}%</span>
            <button
              onClick={() => setZoom((value) => Math.min(200, value + 10))}
              className="px-2 py-1 text-xs rounded border border-outline-variant/30 hover:bg-surface-variant/30"
            >
              +
            </button>
            <span className="mx-1 text-outline-variant/30">|</span>
            <button
              onClick={() => setCurrentPage((value) => Math.max(1, value - 1))}
              disabled={currentPage <= 1}
              className="px-2 py-1 text-xs rounded border border-outline-variant/30 disabled:opacity-30"
            >
              {'\uC774\uC804'}
            </button>
            <span className="text-xs font-korean text-on-surface-variant">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((value) => Math.min(totalPages, value + 1))}
              disabled={currentPage >= totalPages}
              className="px-2 py-1 text-xs rounded border border-outline-variant/30 disabled:opacity-30"
            >
              {'\uB2E4\uC74C'}
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-amber-500 text-white text-sm font-bold font-korean rounded-lg hover:bg-amber-600 disabled:opacity-50"
          >
            {saving ? '\uC800\uC7A5 \uC911...' : '\uD544\uB4DC \uC800\uC7A5'}
          </button>
        </div>

        {/* PDF + ?ㅻ쾭?덉씠 */}
        <div className="flex-1 overflow-auto p-4 flex justify-center">
          <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}>
          <div
            ref={containerRef}
            className="relative bg-white shadow-lg"
            style={{ width: 794, height: 1123, minWidth: 794 }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={() => setSelectedId(null)}
          >
            {/* PDF 諛곌꼍 (iframe ?먮뒗 ?대?吏) */}
            {pdfUrl && (
              <iframe
                src={`${pdfUrl}#page=${currentPage}`}
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ border: 'none' }}
              />
            )}

            {/* ?꾨뱶 ?ㅻ쾭?덉씠 */}
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
                  onContextMenu={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    duplicateField(field._id)
                  }}
                >
                  {/* ?꾩씠肄섎쭔 ?쒖떆 (?띿뒪???쒓굅) */}
                  <span style={{ color: meta.color, fontSize: '0.7rem', opacity: 0.7 }}>
                    {meta.icon}
                  </span>
                  {/* 由ъ궗?댁쫰 ?몃뱾 (?좏깮???꾨뱶留? */}
                  {isSelected && (
                    <div
                      className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize"
                      style={{ backgroundColor: meta.color, borderRadius: '0 0 3px 0' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const rect = containerRef.current?.getBoundingClientRect()
                        if (!rect) return
                        const startX = e.clientX
                        const startY = e.clientY
                        const startW = field.width
                        const startH = field.height
                        const onMove = (ev: MouseEvent) => {
                          const dxPct = ((ev.clientX - startX) / rect.width) * 100 / (zoom / 100)
                          const dyPct = ((ev.clientY - startY) / rect.height) * 100 / (zoom / 100)
                          updateField(field._id, {
                            width: Math.max(1, Math.round((startW + dxPct) * 10) / 10),
                            height: Math.max(1, Math.round((startH + dyPct) * 10) / 10),
                          })
                        }
                        const onUp = () => {
                          window.removeEventListener('mousemove', onMove)
                          window.removeEventListener('mouseup', onUp)
                        }
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
          </div>
      </div>

      {/* ?먥븧?먥븧?먥븧 ?곗륫: ?꾧뎄 ?⑤꼸 ?먥븧?먥븧?먥븧 */}
      <div className="w-64 bg-white border-l border-outline-variant/20 flex flex-col shrink-0">
        {/* ?꾨뱶 異붽? 踰꾪듉??*/}
        <div className="p-4 border-b border-outline-variant/20">
          <h2 className="text-xs font-bold text-on-surface-variant/60 mb-3 font-korean">?꾨뱶 異붽?</h2>
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

        {/* 諛곗튂???꾨뱶 紐⑸줉 */}
        <div className="flex-1 overflow-auto p-4">
          <h2 className="text-xs font-bold text-on-surface-variant/60 mb-2 font-korean">
            諛곗튂???꾨뱶 ({fields.length}媛?
          </h2>
          {fields.length === 0 ? (
            <p className="text-xs text-on-surface-variant/40 font-korean">
              ?쇱そ ?꾩쓽 踰꾪듉?쇰줈 ?꾨뱶瑜?異붽??섏꽭??            </p>
          ) : (
            <div className="space-y-1.5">
              {fields.map((f) => {
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
                    <div className="flex items-center gap-0.5 shrink-0 ml-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); duplicateField(f._id) }}
                        className="text-blue-400 hover:text-blue-600 p-0.5"
                        title="蹂듭젣"
                      >
                        樹?                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeField(f._id) }}
                        className="text-red-400 hover:text-red-600 p-0.5"
                        title="??젣"
                      >
                        ??                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ?좏깮???꾨뱶 ?띿꽦 ?몄쭛 */}
        {selectedField && (
          <div className="p-4 border-t border-outline-variant/20 space-y-3">
            <h2 className="text-xs font-bold text-on-surface-variant/60 font-korean">?꾨뱶 ?띿꽦</h2>

            <label className="block">
              <span className="text-[0.65rem] text-on-surface-variant/60 font-korean">?쇰꺼</span>
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
                <span className="text-[0.65rem] text-on-surface-variant/60 font-korean">?덈퉬 (%)</span>
                <input
                  type="number"
                  min={1} max={50} step={0.5}
                  value={selectedField.width}
                  onChange={e => updateField(selectedField._id, { width: +e.target.value })}
                  className="w-full mt-0.5 px-2 py-1.5 text-xs rounded border border-outline-variant/30"
                />
              </label>
              <label className="block">
                <span className="text-[0.65rem] text-on-surface-variant/60 font-korean">?믪씠 (%)</span>
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
              <span className="text-xs font-korean text-on-surface-variant">?꾩닔 ??ぉ</span>
            </label>

            {/* 蹂듭젣 + ??젣 踰꾪듉 */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => duplicateField(selectedField._id)}
                className="flex-1 px-3 py-1.5 text-xs font-korean rounded-lg border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors"
              >
                樹?蹂듭젣
              </button>
              <button
                onClick={() => removeField(selectedField._id)}
                className="flex-1 px-3 py-1.5 text-xs font-korean rounded-lg border border-red-300 text-red-500 hover:bg-red-50 transition-colors"
              >
                ????젣
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

