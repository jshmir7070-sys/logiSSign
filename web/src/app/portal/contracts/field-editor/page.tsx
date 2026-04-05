'use client'

/**
 * 계약서 템플릿 필드 배치 에디터 — 모두싸인 스타일 풀스크린
 *
 * 필드 소유자 구분:
 *  - sender (발송인/대리점): 전송 시 자동 채움 (도장, 대리점명, 대표자명 등)
 *  - receiver (수신자/기사): 기사가 직접 입력 (서명, 체크, 텍스트 등)
 *
 * 레이아웃:
 *  ┌─────────────────────────────────────────────────────────────────┐
 *  │  [← 뒤로]  제목                           [문서교체] [저장]     │
 *  ├──────┬───────────────────────────────────────────┬──────────────┤
 *  │ 발송인│                                           │ 필드 목록    │
 *  │ +도장 │         PDF 미리보기                        │ ① 발송인도장 │
 *  │ +이름 │         (중앙, 크게)                        │ ② 기사서명  │
 *  │──────│                                           │ ③ 기사이름  │
 *  │ 수신자│                                           │             │
 *  │ +서명 │                                           │ [필드 설정]  │
 *  │ +도장 │                                           │ 소유자/라벨  │
 *  │ +이름 │                                           │ 바인딩      │
 *  │ +날짜 │                                           │ X/Y/W/H    │
 *  ├──────┴───────────────────────────────────────────┴──────────────┤
 *  │  [1] [2] [3] ...  페이지                                        │
 *  └─────────────────────────────────────────────────────────────────┘
 */

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { type SignFieldType, FIELD_TYPE_META } from '@/services/document-sign-field.service'

/* ── 타입 ── */

type FieldOwner = 'sender' | 'receiver'

interface SignFieldInput {
  field_type: SignFieldType
  field_owner: FieldOwner
  page_number: number
  x: number; y: number; width: number; height: number
  label?: string
  required: boolean
  sort_order: number
  default_value?: string
  binding_var?: string
}

interface LocalField extends SignFieldInput { _id: string }

interface SealRecord {
  id: string
  seal_image_url: string | null
  seal_data_uri: string | null
  name_text: string | null
  category: string
  is_default: boolean
}

/* ── 발송인(대리점) 바인딩 변수 ── */
const SENDER_BINDING_OPTIONS = [
  { value: '', label: '직접 입력' },
  { value: '대리점명', label: '대리점명' },
  { value: '대표자명_대리점', label: '대표자명' },
  { value: '대리점사업자번호', label: '사업자번호' },
  { value: '대리점주소', label: '대리점 주소' },
  { value: '대리점전화', label: '대리점 전화' },
  { value: '대리점이메일', label: '대리점 이메일' },
  { value: '업태', label: '업태' },
  { value: '종목', label: '종목' },
  { value: '대리점도장', label: '대리점 도장 (이미지)' },
]

/* ── 수신자(기사) 바인딩 변수 ── */
const RECEIVER_BINDING_OPTIONS = [
  { value: '', label: '직접 입력' },
  { value: '기사명', label: '기사명' },
  { value: '전화번호', label: '전화번호' },
  { value: '주소', label: '주소' },
  { value: '생년월일', label: '생년월일' },
  { value: '사번', label: '사번' },
  { value: '배송지역', label: '배송지역' },
  { value: '배송단가', label: '배송단가' },
  { value: '반품단가', label: '반품단가' },
  { value: '집하단가', label: '집하단가' },
  { value: '노선별단가', label: '노선별 단가 (전체)' },
  { value: '계좌번호', label: '계좌번호' },
  { value: '은행명', label: '은행명' },
  { value: '예금주', label: '예금주' },
  { value: '차량번호', label: '차량번호' },
  { value: '차량종류', label: '차량종류' },
  { value: '차량소유', label: '차량소유 (자차/회사차)' },
  { value: '사업자번호', label: '사업자번호 (기사)' },
  { value: '대표자명', label: '대표자명 (기사)' },
  { value: '세금처리', label: '세금처리 방식' },
  { value: '부가세구분', label: 'VAT 포함/별도' },
  { value: '공제항목', label: '공제항목 (전체)' },
  { value: '계약시작일', label: '계약시작일' },
  { value: '계약종료일', label: '계약종료일' },
  { value: '캠프명', label: '캠프명' },
]

/* ── 소유자별 색상/라벨 ── */
const OWNER_META: Record<FieldOwner, { label: string; color: string; bgColor: string }> = {
  sender: { label: '발송인', color: '#E11D48', bgColor: '#FFF1F2' },    // rose
  receiver: { label: '수신자', color: '#2563EB', bgColor: '#EFF6FF' },   // blue
}

/* ── 메인 ── */

export default function ContractFieldEditorPageWrapper() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-neutral-500 font-korean">로딩 중...</span>
        </div>
      </div>
    }>
      <ContractFieldEditorPage />
    </Suspense>
  )
}

function ContractFieldEditorPage() {
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

  // 대리점 도장 목록
  const [agencySeals, setAgencySeals] = useState<SealRecord[]>([])
  const [showSealPicker, setShowSealPicker] = useState(false)

  // 내 문서함
  const [showDocBox, setShowDocBox] = useState(false)
  const [docBoxItems, setDocBoxItems] = useState<{ name: string; path: string; url: string }[]>([])
  const [loadingDocBox, setLoadingDocBox] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── 데이터 로드 ──
  useEffect(() => {
    if (!templateId) return
    ;(async () => {
      const supabase = createBrowserSupabaseClient()

      // 1) 템플릿 정보
      const { data: tmpl } = await supabase
        .from('contract_templates')
        .select('title, template_pdf_url, sign_fields, agency_id')
        .eq('id', templateId)
        .single()

      if (tmpl) {
        const t = tmpl as Record<string, unknown>
        setTitle(t.title as string || '')
        const pdfPath = t.template_pdf_url as string
        if (pdfPath) {
          if (pdfPath.startsWith('http')) { setPdfUrl(pdfPath) }
          else {
            const { data: signed } = await supabase.storage.from('contracts').createSignedUrl(pdfPath, 3600)
            setPdfUrl(signed?.signedUrl ?? '')
          }
        }
        const existing = t.sign_fields as SignFieldInput[] | null
        if (existing && Array.isArray(existing)) {
          setFields(existing.map((f, i) => ({
            ...f,
            field_owner: f.field_owner || 'receiver', // 기존 데이터 호환
            _id: `f_${i}_${Date.now()}`,
          })))
        }

        // 2) 대리점 도장 목록 조회
        const agencyId = t.agency_id as string
        if (agencyId) {
          const { data: seals } = await supabase
            .from('seals')
            .select('id, seal_image_url, seal_data_uri, name_text, category, is_default')
            .eq('owner_type', 'agency')
            .eq('owner_id', agencyId)
            .order('is_default', { ascending: false })
          if (seals) setAgencySeals(seals as SealRecord[])
        } else {
          // agency_id 없으면 현재 사용자 기준 조회
          const { data: { user } } = await supabase.auth.getUser()
          const aid = user?.app_metadata?.agency_id as string
          if (aid) {
            const { data: seals } = await supabase
              .from('seals')
              .select('id, seal_image_url, seal_data_uri, name_text, category, is_default')
              .eq('owner_type', 'agency')
              .eq('owner_id', aid)
              .order('is_default', { ascending: false })
            if (seals) setAgencySeals(seals as SealRecord[])
          }
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

  // ── 내 문서함 로드 ──
  const handleOpenDocBox = useCallback(async () => {
    setShowDocBox(true)
    setLoadingDocBox(true)
    try {
      const supabase = createBrowserSupabaseClient()
      // 1) contracts 버킷의 templates 폴더에서 기존 PDF 조회
      const { data: storageFiles } = await supabase.storage.from('contracts').list('templates', { limit: 50, sortBy: { column: 'created_at', order: 'desc' } })
      // 2) documents 버킷에서도 기존 업로드 문서 조회
      const { data: { user } } = await supabase.auth.getUser()
      const aid = user?.app_metadata?.agency_id as string
      const { data: docFiles } = aid
        ? await supabase.from('document_files').select('id, title, file_url').eq('agency_id', aid).order('created_at', { ascending: false }).limit(20)
        : { data: null }

      const items: { name: string; path: string; url: string }[] = []

      // Storage 파일들
      if (storageFiles) {
        for (const f of storageFiles) {
          if (f.name.endsWith('.pdf')) {
            const { data: signed } = await supabase.storage.from('contracts').createSignedUrl(`templates/${f.name}`, 3600)
            if (signed?.signedUrl) items.push({ name: f.name, path: `templates/${f.name}`, url: signed.signedUrl })
          }
        }
      }
      // 문서함 파일들
      if (docFiles) {
        for (const doc of docFiles as { id: string; title: string; file_url: string }[]) {
          if (doc.file_url) {
            const storagePath = doc.file_url.startsWith('http') ? doc.file_url.split('/documents/')[1] : doc.file_url
            if (storagePath) {
              const { data: signed } = await supabase.storage.from('documents').createSignedUrl(decodeURIComponent(storagePath), 3600)
              if (signed?.signedUrl) items.push({ name: doc.title, path: doc.file_url, url: signed.signedUrl })
            }
          }
        }
      }
      setDocBoxItems(items)
    } catch (err) {
      console.error('문서함 로드 실패:', err)
    }
    setLoadingDocBox(false)
  }, [])

  // 내 문서함에서 선택 → 해당 PDF를 현재 템플릿에 적용
  const handleSelectDocBoxItem = useCallback(async (item: { name: string; path: string; url: string }) => {
    if (!templateId) return
    setUploading(true)
    setShowDocBox(false)
    try {
      // 선택한 PDF를 다운로드 후 contracts 버킷에 복사
      const res = await fetch(item.url)
      const blob = await res.blob()
      const supabase = createBrowserSupabaseClient()
      const path = `templates/${templateId}.pdf`
      await supabase.storage.from('contracts').upload(path, blob, { upsert: true, contentType: 'application/pdf' })
      await supabase.from('contract_templates').update({ template_pdf_url: path, template_type: 'pdf' }).eq('id', templateId)
      const { data: signed } = await supabase.storage.from('contracts').createSignedUrl(path, 3600)
      setPdfUrl(signed?.signedUrl ?? '')
    } catch { alert('문서 불러오기 실패') }
    setUploading(false)
  }, [templateId])

  // ── 필드 CRUD ──
  const addField = useCallback((type: SignFieldType, owner: FieldOwner, bindingVar?: string, label?: string) => {
    const meta = FIELD_TYPE_META[type]
    const newField: LocalField = {
      _id: `new_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      field_type: type, field_owner: owner, page_number: currentPage,
      x: 50, y: 10 + ((fields.length + 1) * 6) % 70,
      width: type === 'checkbox' ? 3 : type === 'seal' ? 10 : type === 'signature' ? 18 : 22,
      height: type === 'checkbox' ? 3 : type === 'seal' ? 10 : type === 'signature' ? 7 : 3,
      label: label ?? meta.label,
      required: owner === 'receiver', // sender 필드는 자동이므로 required 아님
      sort_order: fields.length, binding_var: bindingVar,
    }
    setFields(prev => [...prev, newField])
    setSelectedId(newField._id)
  }, [currentPage, fields.length])

  // 대리점 도장 추가
  const addSealField = useCallback((seal: SealRecord) => {
    const newField: LocalField = {
      _id: `new_seal_${Date.now()}`,
      field_type: 'seal', field_owner: 'sender', page_number: currentPage,
      x: 70, y: 75, width: 10, height: 10,
      label: '대리점 도장',
      required: false, sort_order: fields.length,
      binding_var: '대리점도장',
      default_value: seal.seal_data_uri || seal.seal_image_url || '',
    }
    setFields(prev => [...prev, newField])
    setSelectedId(newField._id)
    setShowSealPicker(false)
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
      field_type: f.field_type, field_owner: f.field_owner, page_number: f.page_number,
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
  const senderFields = fields.filter(f => f.field_owner === 'sender')
  const receiverFields = fields.filter(f => f.field_owner === 'receiver')

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
        <div className="flex items-center px-6 h-14 border-b border-neutral-200/60 bg-white/80 backdrop-blur shrink-0">
          <button onClick={() => router.push('/portal/contracts/templates')}
            className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-800 font-korean transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            돌아가기
          </button>
          <div className="ml-4 text-sm font-bold text-neutral-700 font-korean">{title || '템플릿 만들기'}</div>
        </div>
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
              <button onClick={handleOpenDocBox}
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

        {/* ── 내 문서함 모달 ── */}
        {showDocBox && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowDocBox(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
                <h3 className="text-base font-bold text-neutral-800 font-korean">내 문서함</h3>
                <button onClick={() => setShowDocBox(false)} className="text-neutral-400 hover:text-neutral-700">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {loadingDocBox ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                    <span className="ml-2 text-sm text-neutral-500 font-korean">문서 목록 불러오는 중...</span>
                  </div>
                ) : docBoxItems.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-3xl mb-3">📁</div>
                    <p className="text-sm text-neutral-500 font-korean">업로드된 문서가 없습니다</p>
                    <p className="text-xs text-neutral-400 font-korean mt-1">&quot;내 컴퓨터&quot;에서 파일을 먼저 업로드하세요</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {docBoxItems.map((item, idx) => (
                      <button key={idx} onClick={() => handleSelectDocBoxItem(item)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-purple-50 transition-colors text-left group">
                        <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-neutral-700 font-korean truncate">{item.name}</p>
                          <p className="text-[11px] text-neutral-400 font-korean">PDF 문서</p>
                        </div>
                        <span className="text-xs text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity font-korean">선택</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  /* ════════════════════════════════════════════
     메인 에디터
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
          <span className="text-[10px] text-neutral-400 font-korean">
            발송인 <span className="font-bold text-rose-500">{senderFields.length}</span> &middot; 수신자 <span className="font-bold text-blue-600">{receiverFields.length}</span>
          </span>
          <div className="w-px h-5 bg-neutral-200" />
          <button onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg font-korean transition-colors">문서 교체</button>
          <input ref={fileInputRef} type="file" accept=".pdf,.docx,.hwp,.hwpx,.jpg,.jpeg,.png,.bmp,.gif,.tiff,.tif,.webp" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadFile(f) }} />
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-1.5 bg-blue-600 text-white text-sm font-bold font-korean rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* ══ 메인 ══ */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* ── 좌측: 도구 패널 ── */}
        <div className="w-[190px] bg-white border-r border-neutral-200 flex flex-col shrink-0 overflow-y-auto">

          {/* ▸ 발송인 (대리점) 필드 */}
          <div className="p-3 border-b border-neutral-100">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest font-korean">발송인 (대리점)</p>
            </div>

            {/* 도장 가져오기 */}
            <button onClick={() => setShowSealPicker(!showSealPicker)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-korean rounded-lg bg-rose-50 hover:bg-rose-100 transition-colors text-left mb-1 border border-rose-200">
              <span className="text-base">🔴</span>
              <span className="text-rose-700 font-bold">도장 가져오기</span>
            </button>

            {/* 도장 선택 팝업 */}
            {showSealPicker && (
              <div className="mb-2 p-2 rounded-lg border border-rose-200 bg-rose-50/50 space-y-1">
                {agencySeals.length === 0 ? (
                  <p className="text-[10px] text-neutral-400 font-korean text-center py-2">
                    등록된 도장이 없습니다<br/>
                    <a href="/portal/seals" className="text-rose-500 underline">도장 등록하기</a>
                  </p>
                ) : (
                  agencySeals.map(seal => (
                    <button key={seal.id} onClick={() => addSealField(seal)}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white transition-colors text-left">
                      {seal.seal_data_uri ? (
                        <img src={seal.seal_data_uri} alt="" className="w-8 h-8 object-contain rounded" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-rose-100 flex items-center justify-center text-rose-400 text-xs">인</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-neutral-700 truncate font-korean">{seal.name_text || '도장'}</p>
                        <p className="text-[8px] text-neutral-400">{seal.is_default ? '기본 도장' : seal.category}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            <div className="space-y-0.5">
              {[
                { label: '대리점명', type: 'text' as SignFieldType, bind: '대리점명' },
                { label: '대표자명', type: 'text' as SignFieldType, bind: '대표자명_대리점' },
                { label: '사업자번호', type: 'text' as SignFieldType, bind: '대리점사업자번호' },
                { label: '주소', type: 'text' as SignFieldType, bind: '대리점주소' },
                { label: '날짜', type: 'date' as SignFieldType, bind: undefined },
              ].map(item => (
                <button key={`s_${item.label}`} onClick={() => addField(item.type, 'sender', item.bind, item.label)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-korean rounded-lg hover:bg-rose-50 transition-colors text-left text-rose-700">
                  <span className="text-rose-400">+</span> {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* ▸ 수신자 (기사) 필드 */}
          <div className="p-3 border-b border-neutral-100">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest font-korean">수신자 (기사)</p>
            </div>
            <div className="space-y-0.5">
              {(Object.keys(FIELD_TYPE_META) as SignFieldType[]).map(type => {
                const meta = FIELD_TYPE_META[type]
                return (
                  <button key={type} onClick={() => addField(type, 'receiver')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-korean rounded-lg hover:bg-blue-50 transition-colors group text-left">
                    <span className="w-6 h-6 rounded-md flex items-center justify-center text-sm shrink-0"
                      style={{ backgroundColor: `${meta.color}15`, color: meta.color }}>
                      {meta.icon}
                    </span>
                    <span className="text-neutral-700 group-hover:text-neutral-900">{meta.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 빠른 추가 (수신자) */}
          <div className="p-3">
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2 font-korean">빠른 추가</p>
            <div className="grid grid-cols-2 gap-0.5">
              {[
                { label: '이름', type: 'text' as SignFieldType, bind: '기사명' },
                { label: '날짜', type: 'date' as SignFieldType, bind: undefined },
                { label: '생년월일', type: 'text' as SignFieldType, bind: '생년월일' },
                { label: '연락처', type: 'text' as SignFieldType, bind: '전화번호' },
                { label: '주소', type: 'text' as SignFieldType, bind: '주소' },
                { label: '배송지역', type: 'text' as SignFieldType, bind: '배송지역' },
                { label: '배송단가', type: 'text' as SignFieldType, bind: '배송단가' },
                { label: '반품단가', type: 'text' as SignFieldType, bind: '반품단가' },
                { label: '차량번호', type: 'text' as SignFieldType, bind: '차량번호' },
                { label: '계좌', type: 'text' as SignFieldType, bind: '계좌번호' },
              ].map(item => (
                <button key={item.label} onClick={() => addField(item.type, 'receiver', item.bind, item.label)}
                  className="px-2 py-1.5 text-[10px] font-korean rounded-lg text-left hover:bg-blue-50 transition-colors text-blue-600">
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
              const ownerMeta = OWNER_META[field.field_owner]
              const isSelected = selectedId === field._id
              const num = fields.indexOf(field) + 1
              const displayLabel = field.label || meta.label
              const borderColor = isSelected ? '#3B82F6' : ownerMeta.color

              return (
                <div
                  key={field._id}
                  className={`absolute cursor-move flex items-center justify-center border-2 rounded select-none transition-shadow ${
                    isSelected ? 'shadow-xl ring-2 ring-blue-400 ring-offset-1 z-50' : 'shadow-sm hover:shadow-md z-10'
                  }`}
                  style={{
                    left: `${field.x}%`, top: `${field.y}%`,
                    width: `${field.width}%`, height: `${field.height}%`,
                    borderColor,
                    backgroundColor: isSelected ? `${ownerMeta.color}20` : `${ownerMeta.color}10`,
                    minWidth: 32, minHeight: 18,
                  }}
                  onMouseDown={(e) => handleMouseDown(e, field._id)}
                  onClick={(e) => { e.stopPropagation(); setSelectedId(field._id) }}
                >
                  {/* 넘버링 라벨 태그 — 발송인은 빨강, 수신자는 파랑 */}
                  <div className="absolute -top-[18px] left-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-t text-white text-[10px] font-bold whitespace-nowrap leading-none"
                    style={{ backgroundColor: ownerMeta.color }}>
                    {num}. {displayLabel}
                    {field.binding_var && <span className="ml-1 opacity-70">&rarr;자동</span>}
                  </div>

                  {/* 도장 미리보기 (sender seal) */}
                  {field.field_owner === 'sender' && field.field_type === 'seal' && field.default_value ? (
                    <img src={field.default_value} alt="도장" className="max-w-full max-h-full object-contain opacity-70" />
                  ) : (
                    <span style={{ color: ownerMeta.color, fontSize: '0.85rem' }}>{meta.icon}</span>
                  )}

                  {/* 리사이즈 핸들 */}
                  {isSelected && (
                    <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize rounded-tl-sm"
                      style={{ backgroundColor: ownerMeta.color }}
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

        {/* ── 우측: 필드 목록 + 속성 ── */}
        <div className="w-[260px] bg-white border-l border-neutral-200 flex flex-col shrink-0 overflow-y-auto">

          {/* 발송인 필드 목록 */}
          <div className="p-3 border-b border-neutral-100">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <p className="text-[10px] font-bold text-rose-500 tracking-widest font-korean">발송인 필드</p>
              <span className="text-[10px] text-neutral-400 ml-auto">{senderFields.length}개</span>
            </div>
            {senderFields.length === 0 ? (
              <p className="text-[10px] text-neutral-300 font-korean py-1">없음</p>
            ) : (
              <div className="space-y-0.5">
                {senderFields.map((f) => {
                  const meta = FIELD_TYPE_META[f.field_type]
                  const isSelected = selectedId === f._id
                  const num = fields.indexOf(f) + 1
                  return (
                    <div key={f._id}
                      onClick={() => { setSelectedId(f._id); setCurrentPage(f.page_number) }}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-korean cursor-pointer transition-all ${
                        isSelected ? 'bg-rose-50 ring-1 ring-rose-300' : 'hover:bg-neutral-50'
                      }`}>
                      <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white shrink-0 bg-rose-500">{num}</span>
                      <span className="text-sm shrink-0">{meta.icon}</span>
                      <span className="flex-1 truncate text-neutral-700">{f.label || meta.label}</span>
                      {f.binding_var && <span className="text-[8px] px-1 rounded bg-rose-100 text-rose-600 shrink-0">자동</span>}
                      <button onClick={(e) => { e.stopPropagation(); removeField(f._id) }}
                        className="text-neutral-300 hover:text-red-500 shrink-0">&times;</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 수신자 필드 목록 */}
          <div className="p-3 border-b border-neutral-100">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <p className="text-[10px] font-bold text-blue-500 tracking-widest font-korean">수신자 필드</p>
              <span className="text-[10px] text-neutral-400 ml-auto">{receiverFields.length}개</span>
            </div>
            {receiverFields.length === 0 ? (
              <p className="text-[10px] text-neutral-300 font-korean py-1">없음</p>
            ) : (
              <div className="space-y-0.5 max-h-[180px] overflow-y-auto">
                {receiverFields.map((f) => {
                  const meta = FIELD_TYPE_META[f.field_type]
                  const isSelected = selectedId === f._id
                  const num = fields.indexOf(f) + 1
                  return (
                    <div key={f._id}
                      onClick={() => { setSelectedId(f._id); setCurrentPage(f.page_number) }}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-korean cursor-pointer transition-all ${
                        isSelected ? 'bg-blue-50 ring-1 ring-blue-300' : 'hover:bg-neutral-50'
                      }`}>
                      <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white shrink-0 bg-blue-500">{num}</span>
                      <span className="text-sm shrink-0">{meta.icon}</span>
                      <span className="flex-1 truncate text-neutral-700">{f.label || meta.label}</span>
                      {f.binding_var && <span className="text-[8px] px-1 rounded bg-green-100 text-green-700 shrink-0">자동</span>}
                      <button onClick={(e) => { e.stopPropagation(); removeField(f._id) }}
                        className="text-neutral-300 hover:text-red-500 shrink-0">&times;</button>
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

              {/* 소유자 전환 */}
              <div>
                <label className="text-[10px] text-neutral-500 font-bold font-korean">소유자</label>
                <div className="flex gap-1 mt-1">
                  {(['sender', 'receiver'] as FieldOwner[]).map(owner => (
                    <button key={owner}
                      onClick={() => updateField(selectedField._id, {
                        field_owner: owner,
                        required: owner === 'receiver',
                        binding_var: undefined,
                      })}
                      className={`flex-1 py-1.5 text-[10px] font-bold font-korean rounded-lg border transition-all ${
                        selectedField.field_owner === owner
                          ? `border-current text-white`
                          : 'border-neutral-200 text-neutral-400 hover:border-neutral-300'
                      }`}
                      style={selectedField.field_owner === owner ? { backgroundColor: OWNER_META[owner].color } : {}}>
                      {OWNER_META[owner].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 순번 + 타입 */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 flex items-center justify-center rounded-lg text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: OWNER_META[selectedField.field_owner].color }}>
                  {fields.indexOf(selectedField) + 1}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-neutral-800 font-korean">{FIELD_TYPE_META[selectedField.field_type].label}</p>
                  <p className="text-[10px] text-neutral-400">P{selectedField.page_number} &middot; {OWNER_META[selectedField.field_owner].label}</p>
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

              {/* 바인딩 변수 (텍스트/날짜 필드만) */}
              {(selectedField.field_type === 'text' || selectedField.field_type === 'date') && (
                <div>
                  <label className="text-[10px] text-neutral-500 font-bold font-korean">자동 입력 (바인딩)</label>
                  <select value={selectedField.binding_var ?? ''}
                    onChange={e => updateField(selectedField._id, { binding_var: e.target.value || undefined })}
                    className="w-full h-8 px-2 mt-1 text-xs rounded-lg border border-neutral-200 font-korean focus:ring-2 focus:ring-blue-300 outline-none bg-white">
                    {(selectedField.field_owner === 'sender' ? SENDER_BINDING_OPTIONS : RECEIVER_BINDING_OPTIONS).map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  {selectedField.binding_var && (
                    <p className="text-[9px] text-green-600 mt-1 font-korean">
                      &check; &ldquo;{selectedField.binding_var}&rdquo;
                      {selectedField.field_owner === 'sender' ? ' — 전송 시 자동 채움' : ' — 기사별 자동 입력'}
                    </p>
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
                  <span className="text-[10px] font-korean text-neutral-600">필수</span>
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

      {/* ══ 하단: 페이지 네비게이션 ══ */}
      <div className="h-12 bg-white border-t border-neutral-200 flex items-center px-4 gap-3 shrink-0 shadow-inner">
        <span className="text-[10px] text-neutral-400 font-bold shrink-0 font-korean">페이지</span>
        <div className="flex items-center gap-1 overflow-x-auto flex-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(pg => (
            <button key={pg} onClick={() => setCurrentPage(pg)}
              className={`w-8 h-8 rounded-lg text-xs font-bold shrink-0 transition-all ${
                currentPage === pg ? 'bg-blue-600 text-white shadow-md' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
              }`}>
              {pg}
            </button>
          ))}
          <button onClick={() => setTotalPages(p => p + 1)}
            className="w-8 h-8 rounded-lg text-xs text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 shrink-0 transition-colors" title="페이지 추가">+</button>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-neutral-400 shrink-0">
          <span className="font-korean">{fields.length}개 필드</span>
          <span>&middot;</span>
          <span>{currentPage} / {totalPages}</span>
        </div>
      </div>
    </div>
  )
}
