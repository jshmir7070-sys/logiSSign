'use client'

/* eslint-disable @next/next/no-img-element */

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
import * as pdfjsLib from 'pdfjs-dist'

// PDF.js worker 설정 (로컬 파일 — CSP 차단 방지)
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
}

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

interface FieldPreset {
  label: string
  bindingVar?: string
  fieldType: 'text' | 'date'
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
const OWNER_META: Record<FieldOwner, { label: string; color: string; bgColor: string; textColor: string }> = {
  sender: { label: '발송인', color: '#E11D48', bgColor: '#FFF1F2', textColor: '#111111' },    // 라벨=rose, 텍스트=검정
  receiver: { label: '수신자', color: '#2563EB', bgColor: '#EFF6FF', textColor: '#2563EB' },   // 라벨=blue, 텍스트=파랑
}

const SENDER_FIELD_PRESETS: FieldPreset[] = [
  { label: '대리점명', bindingVar: '대리점명', fieldType: 'text' },
  { label: '대표자명', bindingVar: '대표자명_대리점', fieldType: 'text' },
  { label: '사업자번호', bindingVar: '대리점사업자번호', fieldType: 'text' },
  { label: '주소', bindingVar: '대리점주소', fieldType: 'text' },
  { label: '전화번호', bindingVar: '대리점전화', fieldType: 'text' },
  { label: '이메일', bindingVar: '대리점이메일', fieldType: 'text' },
  { label: '작성일', fieldType: 'date' },
]

const RECEIVER_FIELD_PRESETS: FieldPreset[] = [
  { label: '이름', bindingVar: '기사명', fieldType: 'text' },
  { label: '전화번호', bindingVar: '전화번호', fieldType: 'text' },
  { label: '주소', bindingVar: '주소', fieldType: 'text' },
  { label: '생년월일', bindingVar: '생년월일', fieldType: 'text' },
  { label: '차량번호', bindingVar: '차량번호', fieldType: 'text' },
  { label: '계좌번호', bindingVar: '계좌번호', fieldType: 'text' },
  { label: '예금주', bindingVar: '예금주', fieldType: 'text' },
  { label: '계약일', fieldType: 'date' },
]

const GUIDE_STORAGE_KEY = 'contract-field-editor-guide-v1'
const GUIDE_STEPS = [
  {
    title: '문서 불러오기',
    description: '내 컴퓨터 또는 내 문서함에서 실제 계약서를 먼저 불러옵니다.',
  },
  {
    title: '발송인 자동 항목',
    description: '대리점명, 대표자명, 도장처럼 자동으로 채워질 항목을 먼저 추가합니다.',
  },
  {
    title: '기사 입력 항목',
    description: '서명, 도장, 이름, 주소, 날짜 등 기사가 직접 입력할 필드를 넣습니다.',
  },
  {
    title: '순서와 위치 정리',
    description: '오른쪽 패널에서 입력 순서를 정하고, 문서 위에서 드래그해 위치를 맞춥니다.',
  },
  {
    title: '저장 후 발송 준비',
    description: '저장하면 템플릿으로 바로 사용 가능하며 기사에게 보낼 계약서로 이어집니다.',
  },
]

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
  const [contextMenu, setContextMenu] = useState<{ fieldId: string; x: number; y: number } | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [savedFields, setSavedFields] = useState<string>('[]') // 저장 시점 스냅샷 (JSON)

  // 대리점 도장 목록
  const [agencySeals, setAgencySeals] = useState<SealRecord[]>([])
  const [showSealPicker, setShowSealPicker] = useState(false)

  // 내 문서함
  const [showDocBox, setShowDocBox] = useState(false)
  const [docBoxItems, setDocBoxItems] = useState<{ name: string; path: string; url: string }[]>([])
  const [selectedDocBoxItem, setSelectedDocBoxItem] = useState<{ name: string; path: string; url: string } | null>(null)
  const [loadingDocBox, setLoadingDocBox] = useState(false)
  const [previewZoom, setPreviewZoom] = useState(1)
  const [showGuide, setShowGuide] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)

  const normalizeFieldOrder = useCallback((nextFields: LocalField[]) => (
    nextFields.map((field, index) => ({ ...field, sort_order: index }))
  ), [])

  const serializeFieldsSnapshot = useCallback((nextFields: LocalField[]) => (
    JSON.stringify(nextFields.map((field, index) => ({
      field_type: field.field_type,
      field_owner: field.field_owner,
      page_number: field.page_number,
      x: field.x,
      y: field.y,
      width: field.width,
      height: field.height,
      label: field.label,
      required: field.required,
      sort_order: index,
      default_value: field.default_value,
      binding_var: field.binding_var,
    })))
  ), [])

  // ── PDF 캔버스 렌더링 ──
  const renderPdfPage = useCallback(async (pageNum: number) => {
    if (!pdfDocRef.current || !canvasRef.current) return
    try {
      const page = await pdfDocRef.current.getPage(pageNum)
      const viewport = page.getViewport({ scale: 1.5 })
      const canvas = canvasRef.current
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      await page.render({ canvasContext: ctx, viewport }).promise
    } catch (err) {
      console.error('PDF 페이지 렌더링 실패:', err)
    }
  }, [])

  // PDF URL 변경 시 문서 로드
  useEffect(() => {
    if (!pdfUrl) return
    ;(async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/cmaps/',
          cMapPacked: true,
          withCredentials: false,
        })
        const doc = await loadingTask.promise
        pdfDocRef.current = doc
        setTotalPages(doc.numPages)
        renderPdfPage(currentPage)
      } catch (err) {
        console.error('PDF 로드 실패:', err)
        alert('PDF 로드에 실패했습니다. 문서를 다시 업로드해주세요.')
      }
    })()
  }, [pdfUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  // 페이지 변경 시 다시 렌더링
  useEffect(() => {
    if (pdfDocRef.current) renderPdfPage(currentPage)
  }, [currentPage, renderPdfPage])

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
          const loaded = normalizeFieldOrder([...existing].sort((a, b) => (
            (a.sort_order - b.sort_order) || (a.page_number - b.page_number) || (a.y - b.y) || (a.x - b.x)
          )).map((f, i) => ({
            ...f,
            field_owner: f.field_owner || 'receiver', // 기존 데이터 호환
            _id: `f_${i}_${Date.now()}`,
          })))
          setFields(loaded)
          setSavedFields(serializeFieldsSnapshot(loaded))
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
  }, [templateId, normalizeFieldOrder, serializeFieldsSnapshot])

  // ── 변경 감지 ──
  useEffect(() => {
    const currentSnapshot = serializeFieldsSnapshot(fields)
    setHasUnsavedChanges(currentSnapshot !== savedFields)
  }, [fields, savedFields, serializeFieldsSnapshot])

  // ── 브라우저 닫기/새로고침 시 경고 ──
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsavedChanges])

  useEffect(() => {
    if (!contextMenu) return

    const handleClickAway = () => setContextMenu(null)
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContextMenu(null)
    }

    window.addEventListener('click', handleClickAway)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('click', handleClickAway)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [contextMenu])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const seenGuide = window.localStorage.getItem(GUIDE_STORAGE_KEY)
    if (!seenGuide) setShowGuide(true)
  }, [])

  const closeGuide = useCallback((persist = true) => {
    setShowGuide(false)
    if (persist && typeof window !== 'undefined') {
      window.localStorage.setItem(GUIDE_STORAGE_KEY, 'seen')
    }
  }, [])


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
        ? await supabase.from('document_files').select('id, title, file_url, status').eq('agency_id', aid).neq('status', 'deleted').order('created_at', { ascending: false }).limit(20)
        : { data: null }

      const items: { name: string; path: string; url: string }[] = []

      // Storage 파일들 (빈 폴더 플레이스홀더 제외)
      if (storageFiles) {
        for (const f of storageFiles) {
          if (f.name.endsWith('.pdf') && !f.name.startsWith('.')) {
            const { data: signed } = await supabase.storage.from('contracts').createSignedUrl(`templates/${f.name}`, 3600)
            if (signed?.signedUrl) items.push({ name: f.name, path: `templates/${f.name}`, url: signed.signedUrl })
          }
        }
      }
      const fieldCountMap = new Map<string, number>()
      if (docFiles && docFiles.length > 0) {
        const { data: fieldRows } = await supabase
          .from('document_sign_fields')
          .select('document_file_id')
          .in('document_file_id', docFiles.map((doc) => doc.id))
        for (const row of fieldRows ?? []) {
          fieldCountMap.set(row.document_file_id, (fieldCountMap.get(row.document_file_id) ?? 0) + 1)
        }
      }

      // 문서함 파일들 (삭제된 문서와 저장되지 않은 draft 제외)
      if (docFiles) {
        for (const doc of docFiles as { id: string; title: string; file_url: string; status: string }[]) {
          const fieldCount = fieldCountMap.get(doc.id) ?? 0
          if (doc.file_url && doc.status !== 'deleted' && !(doc.status === 'draft' && fieldCount === 0)) {
            const storagePath = doc.file_url.startsWith('http') ? doc.file_url.split('/documents/')[1] : doc.file_url
            if (storagePath) {
              const { data: signed } = await supabase.storage.from('documents').createSignedUrl(decodeURIComponent(storagePath), 3600)
              if (signed?.signedUrl) items.push({ name: doc.title, path: doc.file_url, url: signed.signedUrl })
            }
          }
        }
      }
      setDocBoxItems(items)
      setSelectedDocBoxItem(items[0] ?? null)
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
    setSelectedDocBoxItem(null)
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
    setFields(prev => normalizeFieldOrder([...prev, newField]))
    setSelectedId(newField._id)
  }, [currentPage, fields.length, normalizeFieldOrder])

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
    setFields(prev => normalizeFieldOrder([...prev, newField]))
    setSelectedId(newField._id)
    setShowSealPicker(false)
  }, [currentPage, fields.length, normalizeFieldOrder])

  const removeField = useCallback((id: string) => {
    setFields(prev => normalizeFieldOrder(prev.filter(f => f._id !== id)))
    if (selectedId === id) setSelectedId(null)
    if (contextMenu?.fieldId === id) setContextMenu(null)
  }, [selectedId, contextMenu, normalizeFieldOrder])

  const updateField = useCallback((id: string, patch: Partial<LocalField>) => {
    setFields(prev => prev.map(f => f._id === id ? { ...f, ...patch } : f))
  }, [])

  const moveField = useCallback((fieldId: string, direction: -1 | 1) => {
    setFields(prev => {
      const currentIndex = prev.findIndex((field) => field._id === fieldId)
      if (currentIndex === -1) return prev

      const nextIndex = currentIndex + direction
      if (nextIndex < 0 || nextIndex >= prev.length) return prev

      const reordered = [...prev]
      const [moved] = reordered.splice(currentIndex, 1)
      reordered.splice(nextIndex, 0, moved)
      return normalizeFieldOrder(reordered)
    })
  }, [normalizeFieldOrder])

  const setFieldOrder = useCallback((fieldId: string, nextOrder: number) => {
    setFields(prev => {
      const currentIndex = prev.findIndex((field) => field._id === fieldId)
      if (currentIndex === -1) return prev

      const targetIndex = Math.max(0, Math.min(prev.length - 1, nextOrder - 1))
      if (targetIndex === currentIndex) return prev

      const reordered = [...prev]
      const [moved] = reordered.splice(currentIndex, 1)
      reordered.splice(targetIndex, 0, moved)
      return normalizeFieldOrder(reordered)
    })
  }, [normalizeFieldOrder])

  const getFieldPresets = useCallback((field: LocalField | undefined | null): FieldPreset[] => {
    if (!field || (field.field_type !== 'text' && field.field_type !== 'date')) return []

    const presets = field.field_owner === 'sender'
      ? SENDER_FIELD_PRESETS
      : RECEIVER_FIELD_PRESETS

    return presets.filter((preset) => preset.fieldType === field.field_type)
  }, [])

  const applyFieldPreset = useCallback((fieldId: string, preset: FieldPreset) => {
    updateField(fieldId, {
      label: preset.label,
      binding_var: preset.bindingVar,
      default_value: preset.bindingVar ? undefined : '',
    })
    setContextMenu(null)
  }, [updateField])

  const openFieldContextMenu = useCallback((event: React.MouseEvent, fieldId: string) => {
    const field = fields.find((item) => item._id === fieldId)
    if (!field || getFieldPresets(field).length === 0) return

    event.preventDefault()
    event.stopPropagation()
    setSelectedId(fieldId)
    setContextMenu({ fieldId, x: event.clientX, y: event.clientY })
  }, [fields, getFieldPresets])

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
    const normalizedFields = normalizeFieldOrder(fields)
    setFields(normalizedFields)
    const signFields: SignFieldInput[] = normalizedFields.map((f, i) => ({
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
    if (error) {
      alert('저장 실패: ' + error.message)
    } else {
      setSavedFields(serializeFieldsSnapshot(normalizedFields))
      setHasUnsavedChanges(false)
      alert('필드 배치가 저장되었습니다.')
    }
  }, [templateId, fields, normalizeFieldOrder, serializeFieldsSnapshot])

  const pageFields = fields.filter(f => f.page_number === currentPage)
  const selectedField = fields.find(f => f._id === selectedId)
  const selectedFieldOrder = selectedField ? fields.findIndex((field) => field._id === selectedField._id) + 1 : 0
  const senderFields = fields.filter(f => f.field_owner === 'sender')
  const receiverFields = fields.filter(f => f.field_owner === 'receiver')
  const contextMenuField = contextMenu ? fields.find(f => f._id === contextMenu.fieldId) : null
  const contextMenuPresets = getFieldPresets(contextMenuField)
  const currentGuideStep = !pdfUrl
    ? 0
    : senderFields.length === 0
      ? 1
      : receiverFields.length === 0
        ? 2
        : !hasUnsavedChanges
          ? 4
          : 3

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
            <div className="mt-6 rounded-2xl border border-blue-100 bg-white/90 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-neutral-800 font-korean">처음 만드는 순서</p>
                  <p className="mt-1 text-xs text-neutral-500 font-korean">
                    실제 계약서를 보면서 따라 만들 수 있게 순서대로 안내해 드립니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuide(true)}
                  className="shrink-0 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 font-korean"
                >
                  자세히 보기
                </button>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-2">
                {GUIDE_STEPS.slice(0, 4).map((step, index) => (
                  <div key={step.title} className="flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-neutral-800 font-korean">{step.title}</p>
                      <p className="mt-0.5 text-[11px] text-neutral-500 font-korean">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
          <div
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => {
              setShowDocBox(false)
              setSelectedDocBoxItem(null)
            }}
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
                <h3 className="text-base font-bold text-neutral-800 font-korean">내 문서함</h3>
                <button
                  onClick={() => {
                    setShowDocBox(false)
                    setSelectedDocBoxItem(null)
                  }}
                  className="text-neutral-400 hover:text-neutral-700"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[340px_1fr]">
                {loadingDocBox ? (
                  <div className="lg:col-span-2 flex items-center justify-center py-12">
                    <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                    <span className="ml-2 text-sm text-neutral-500 font-korean">문서 목록 불러오는 중...</span>
                  </div>
                ) : docBoxItems.length === 0 ? (
                  <div className="lg:col-span-2 text-center py-12">
                    <div className="text-3xl mb-3">📁</div>
                    <p className="text-sm text-neutral-500 font-korean">업로드된 문서가 없습니다</p>
                    <p className="text-xs text-neutral-400 font-korean mt-1">&quot;내 컴퓨터&quot;에서 파일을 먼저 업로드하세요</p>
                  </div>
                ) : (
                  <>
                    <div className="border-r border-neutral-100 overflow-y-auto p-4 bg-slate-50/60">
                      <div className="grid grid-cols-2 gap-3">
                        {docBoxItems.map((item, idx) => {
                          const selected = selectedDocBoxItem?.path === item.path
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setSelectedDocBoxItem(item)}
                              className={`rounded-2xl border p-3 text-left transition-all ${selected ? 'border-blue-400 bg-blue-50 shadow-sm' : 'border-neutral-200 bg-white hover:border-blue-200 hover:bg-blue-50/40'}`}
                            >
                              <div className="aspect-[3/4] rounded-xl overflow-hidden border border-neutral-100 bg-white">
                                <iframe
                                  src={`${item.url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                                  className="h-full w-full pointer-events-none"
                                  style={{ transform: 'scale(0.88)', transformOrigin: 'top center' }}
                                  title={item.name}
                                />
                              </div>
                              <p className="mt-2 text-xs font-semibold text-neutral-700 font-korean line-clamp-2">{item.name}</p>
                              <p className="text-[11px] text-neutral-400 font-korean">PDF 문서</p>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="min-h-0 flex flex-col">
                      {selectedDocBoxItem ? (
                        <>
                          <div className="px-6 py-4 border-b border-neutral-100">
                            <p className="text-base font-bold text-neutral-800 font-korean">{selectedDocBoxItem.name}</p>
                            <p className="text-xs text-neutral-400 font-korean mt-1">미리보기 후 이 문서로 바로 템플릿을 만들 수 있습니다.</p>
                          </div>
                          <div className="flex-1 min-h-0 overflow-auto p-5 bg-slate-100">
                            <div className="mx-auto w-full max-w-[720px]">
                              <div className="aspect-[210/297] rounded-2xl overflow-hidden bg-white border border-neutral-200 shadow-sm">
                                <iframe
                                  src={`${selectedDocBoxItem.url}#toolbar=0&navpanes=0&view=FitH`}
                                  className="h-full w-full"
                                  title={selectedDocBoxItem.name}
                                />
                              </div>
                            </div>
                          </div>
                          <div className="px-6 py-4 border-t border-neutral-100 flex justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => window.open(selectedDocBoxItem.url, '_blank')}
                              className="px-4 py-2 rounded-xl bg-neutral-100 text-sm text-neutral-700 hover:bg-neutral-200 font-korean"
                            >
                              원본 보기
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectDocBoxItem(selectedDocBoxItem)}
                              className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 font-korean"
                            >
                              템플릿 만들기
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-sm text-neutral-400 font-korean">
                          왼쪽에서 문서를 선택해 주세요.
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {showGuide && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" onClick={() => closeGuide(true)}>
            <div
              className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl overflow-hidden"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
                <p className="text-xl font-bold font-korean">템플릿 만들기 사용 안내</p>
                <p className="mt-1 text-sm text-white/80 font-korean">
                  실제 서류를 보면서 바로 익힐 수 있도록 순서대로 안내합니다.
                </p>
              </div>
              <div className="space-y-4 p-6">
                {GUIDE_STEPS.map((step, index) => (
                  <div key={step.title} className="flex items-start gap-4 rounded-2xl border border-neutral-100 bg-slate-50 p-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-neutral-800 font-korean">{step.title}</p>
                      <p className="mt-1 text-xs leading-5 text-neutral-500 font-korean">{step.description}</p>
                    </div>
                  </div>
                ))}
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-bold text-amber-700 font-korean">실제 문서를 보며 익히는 팁</p>
                  <ul className="mt-2 space-y-1.5 text-xs leading-5 text-amber-700/90 font-korean">
                    <li>문서 확대/축소 버튼으로 글자가 잘 보이는 크기에서 배치하세요.</li>
                    <li>텍스트/날짜 필드는 우클릭하면 이름, 주소, 전화번호 같은 빠른 라벨을 바로 적용할 수 있습니다.</li>
                    <li>오른쪽의 입력 순서를 조정하면 기사 앱 입력 순서도 그대로 맞춰집니다.</li>
                  </ul>
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-neutral-100 px-6 py-4">
                <button
                  type="button"
                  onClick={() => closeGuide(false)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-neutral-600 hover:bg-slate-200 font-korean"
                >
                  나중에 다시 보기
                </button>
                <button
                  type="button"
                  onClick={() => closeGuide(true)}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 font-korean"
                >
                  확인하고 시작하기
                </button>
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
          <button onClick={() => {
              if (hasUnsavedChanges) {
                if (!confirm('저장하지 않은 변경사항이 있습니다. 저장하지 않고 나가시겠습니까?')) return
              }
              router.push('/portal/contracts/templates')
            }}
            className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 font-korean">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            뒤로
          </button>
          <div className="w-px h-5 bg-neutral-200" />
          <span className="text-sm font-bold text-neutral-800 font-korean truncate max-w-[280px]">{title || '템플릿 만들기'}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGuide(true)}
            className="px-3 py-1.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg font-korean transition-colors"
          >
            사용 가이드
          </button>
          <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-50 px-1 py-1">
            <button
              type="button"
              onClick={() => setPreviewZoom((prev) => Math.max(0.8, Number((prev - 0.1).toFixed(1))))}
              className="h-7 w-7 rounded-md text-sm text-neutral-500 hover:bg-white hover:text-neutral-800"
              title="문서 축소"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => setPreviewZoom(1)}
              className="min-w-[56px] rounded-md px-2 py-1 text-[11px] font-bold text-neutral-600 hover:bg-white font-korean"
              title="문서 크기 초기화"
            >
              {Math.round(previewZoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setPreviewZoom((prev) => Math.min(1.5, Number((prev + 0.1).toFixed(1))))}
              className="h-7 w-7 rounded-md text-sm text-neutral-500 hover:bg-white hover:text-neutral-800"
              title="문서 확대"
            >
              +
            </button>
          </div>
          <span className="text-[10px] text-neutral-400 font-korean">
            발송인 <span className="font-bold text-rose-500">{senderFields.length}</span> &middot; 수신자 <span className="font-bold text-blue-600">{receiverFields.length}</span>
          </span>
          <div className="w-px h-5 bg-neutral-200" />
          <button onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg font-korean transition-colors">문서 교체</button>
          <input ref={fileInputRef} type="file" accept=".pdf,.docx,.hwp,.hwpx,.jpg,.jpeg,.png,.bmp,.gif,.tiff,.tif,.webp" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadFile(f) }} />
          {hasUnsavedChanges && (
            <span className="text-[10px] text-amber-500 font-korean font-bold animate-pulse">변경사항 있음</span>
          )}
          <button onClick={handleSave} disabled={saving}
            className={`px-5 py-1.5 text-white text-sm font-bold font-korean rounded-lg disabled:opacity-50 transition-colors shrink-0 ${
              hasUnsavedChanges ? 'bg-amber-500 hover:bg-amber-600 ring-2 ring-amber-300' : 'bg-blue-600 hover:bg-blue-700'
            }`}>
            {saving ? '저장 중...' : hasUnsavedChanges ? '저장하기' : '저장됨'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto border-b border-neutral-200 bg-white px-4 py-2 shrink-0">
        {GUIDE_STEPS.map((step, index) => {
          const active = currentGuideStep === index
          const done = currentGuideStep > index
          return (
            <div
              key={step.title}
              className={`min-w-[170px] rounded-xl border px-3 py-2 transition-colors ${
                active
                  ? 'border-blue-300 bg-blue-50'
                  : done
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-neutral-200 bg-neutral-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                  active ? 'bg-blue-600 text-white' : done ? 'bg-emerald-600 text-white' : 'bg-white text-neutral-500 border border-neutral-200'
                }`}>
                  {index + 1}
                </div>
                <p className={`text-xs font-bold font-korean ${active ? 'text-blue-700' : done ? 'text-emerald-700' : 'text-neutral-700'}`}>
                  {step.title}
                </p>
              </div>
              <p className="mt-1 text-[10px] leading-4 text-neutral-500 font-korean">
                {step.description}
              </p>
            </div>
          )
        })}
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

        {/* ── 중앙: PDF 미리보기 (캔버스) ── */}
        <div className="flex-1 overflow-auto flex items-start justify-center py-4 px-4 bg-neutral-200/40 min-w-0">
          <div
            ref={containerRef}
            className="relative bg-white shadow-2xl rounded"
            style={{ width: '100%', maxWidth: Math.round(850 * previewZoom) }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={() => setSelectedId(null)}
          >
            <canvas ref={canvasRef} className="w-full h-auto block" />

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
                  onContextMenu={(e) => openFieldContextMenu(e, field._id)}
                >
                  {/* 넘버링 라벨 태그 — 발송인은 빨강, 수신자는 파랑 */}
                  <div className="absolute -top-[18px] left-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-t text-white text-[10px] font-bold whitespace-nowrap leading-none"
                    style={{ backgroundColor: ownerMeta.color }}>
                    {num}. {displayLabel}
                    {field.binding_var && <span className="ml-1 opacity-70">&rarr;자동</span>}
                  </div>

                  {/* 도장 미리보기 — 도장만 원본 색상 유지 */}
                  {field.field_type === 'seal' && field.default_value ? (
                    <img src={field.default_value} alt="도장" className="max-w-full max-h-full object-contain opacity-70" />
                  ) : (field.field_type === 'text' || field.field_type === 'date') && isSelected ? (
                    <input
                      type="text"
                      value={field.default_value ?? ''}
                      onChange={e => { e.stopPropagation(); updateField(field._id, { default_value: e.target.value }) }}
                      onClick={e => e.stopPropagation()}
                      onMouseDown={e => e.stopPropagation()}
                      placeholder={field.binding_var ? `자동: ${field.binding_var}` : field.label || meta.label}
                      className="w-full h-full text-[10px] px-1 bg-transparent outline-none border-none font-korean"
                      style={{ color: ownerMeta.textColor }}
                    />
                  ) : field.default_value && (field.field_type === 'text' || field.field_type === 'date') ? (
                    <span className="text-[10px] px-1 truncate font-korean" style={{ color: ownerMeta.textColor }}>{field.default_value}</span>
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
                      onContextMenu={(e) => openFieldContextMenu(e, f._id)}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-korean cursor-pointer transition-all ${
                        isSelected ? 'bg-rose-50 ring-1 ring-rose-300' : 'hover:bg-neutral-50'
                      }`}>
                      <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white shrink-0 bg-rose-500">{num}</span>
                      <span className="text-sm shrink-0">{meta.icon}</span>
                      <span className="flex-1 truncate text-neutral-700">{f.label || meta.label}</span>
                      {f.binding_var && <span className="text-[8px] px-1 rounded bg-rose-100 text-rose-600 shrink-0">자동</span>}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); moveField(f._id, -1) }}
                          disabled={num === 1}
                          className="w-5 h-5 rounded text-[10px] text-neutral-300 hover:text-neutral-600 hover:bg-white disabled:text-neutral-200 disabled:hover:bg-transparent"
                          title="위로"
                        >
                          ↑
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); moveField(f._id, 1) }}
                          disabled={num === fields.length}
                          className="w-5 h-5 rounded text-[10px] text-neutral-300 hover:text-neutral-600 hover:bg-white disabled:text-neutral-200 disabled:hover:bg-transparent"
                          title="아래로"
                        >
                          ↓
                        </button>
                      </div>
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
                      onContextMenu={(e) => openFieldContextMenu(e, f._id)}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-korean cursor-pointer transition-all ${
                        isSelected ? 'bg-blue-50 ring-1 ring-blue-300' : 'hover:bg-neutral-50'
                      }`}>
                      <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white shrink-0 bg-blue-500">{num}</span>
                      <span className="text-sm shrink-0">{meta.icon}</span>
                      <span className="flex-1 truncate text-neutral-700">{f.label || meta.label}</span>
                      {f.binding_var && <span className="text-[8px] px-1 rounded bg-green-100 text-green-700 shrink-0">자동</span>}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); moveField(f._id, -1) }}
                          disabled={num === 1}
                          className="w-5 h-5 rounded text-[10px] text-neutral-300 hover:text-neutral-600 hover:bg-white disabled:text-neutral-200 disabled:hover:bg-transparent"
                          title="위로"
                        >
                          ↑
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); moveField(f._id, 1) }}
                          disabled={num === fields.length}
                          className="w-5 h-5 rounded text-[10px] text-neutral-300 hover:text-neutral-600 hover:bg-white disabled:text-neutral-200 disabled:hover:bg-transparent"
                          title="아래로"
                        >
                          ↓
                        </button>
                      </div>
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
                  {selectedFieldOrder}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-neutral-800 font-korean">{FIELD_TYPE_META[selectedField.field_type].label}</p>
                  <p className="text-[10px] text-neutral-400">P{selectedField.page_number} &middot; {OWNER_META[selectedField.field_owner].label}</p>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-neutral-500 font-bold font-korean">입력 순서</label>
                <div className="mt-1 flex items-center gap-1.5">
                  <button
                    onClick={() => moveField(selectedField._id, -1)}
                    disabled={selectedFieldOrder <= 1}
                    className="w-8 h-8 rounded-lg border border-neutral-200 text-xs text-neutral-500 hover:border-neutral-300 hover:bg-neutral-50 disabled:text-neutral-300 disabled:hover:bg-transparent"
                    title="위로"
                  >
                    ↑
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={fields.length}
                    value={selectedFieldOrder}
                    onChange={(e) => setFieldOrder(selectedField._id, Number(e.target.value || 1))}
                    className="flex-1 h-8 px-2.5 text-xs rounded-lg border border-neutral-200 font-korean focus:ring-2 focus:ring-blue-300 outline-none"
                  />
                  <button
                    onClick={() => moveField(selectedField._id, 1)}
                    disabled={selectedFieldOrder >= fields.length}
                    className="w-8 h-8 rounded-lg border border-neutral-200 text-xs text-neutral-500 hover:border-neutral-300 hover:bg-neutral-50 disabled:text-neutral-300 disabled:hover:bg-transparent"
                    title="아래로"
                  >
                    ↓
                  </button>
                </div>
                <p className="mt-1 text-[9px] text-neutral-400 font-korean">
                  기사 앱의 텍스트 입력 이동 순서는 이 번호 기준으로 적용됩니다.
                </p>
              </div>

              {/* 라벨 */}
              <div>
                <label className="text-[10px] text-neutral-500 font-bold font-korean">라벨명</label>
                <input type="text" value={selectedField.label ?? ''}
                  onChange={e => updateField(selectedField._id, { label: e.target.value })}
                  placeholder="라벨명 입력"
                  className="w-full h-8 px-2.5 mt-1 text-xs rounded-lg border border-neutral-200 font-korean focus:ring-2 focus:ring-blue-300 outline-none" />
              </div>

              {/* 기본값 직접 입력 (텍스트/날짜 필드) */}
              {(selectedField.field_type === 'text' || selectedField.field_type === 'date') && (
                <div>
                  <label className="text-[10px] text-neutral-500 font-bold font-korean">
                    {selectedField.field_owner === 'sender' ? '발송인 입력값' : '기본값'}
                  </label>
                  <input type={selectedField.field_type === 'date' ? 'date' : 'text'}
                    value={selectedField.default_value ?? ''}
                    onChange={e => updateField(selectedField._id, { default_value: e.target.value })}
                    placeholder={selectedField.field_owner === 'sender' ? '발송인이 직접 입력할 값' : '기본값 (선택)'}
                    className="w-full h-8 px-2.5 mt-1 text-xs rounded-lg border border-neutral-200 font-korean focus:ring-2 focus:ring-blue-300 outline-none" />
                  {selectedField.field_owner === 'sender' && !selectedField.binding_var && (
                    <p className="text-[9px] text-amber-600 mt-1 font-korean">
                      &#9998; 직접 입력한 값이 계약서에 표시됩니다
                    </p>
                  )}
                  {selectedField.field_owner === 'sender' && selectedField.binding_var && selectedField.default_value && (
                    <p className="text-[9px] text-amber-600 mt-1 font-korean">
                      &#9888; 직접 입력값이 자동 바인딩보다 우선 적용됩니다
                    </p>
                  )}
                </div>
              )}

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
                  {selectedField.binding_var && (
                    <p className="text-[9px] text-neutral-400 mt-0.5 font-korean">
                      위에 직접 입력값이 있으면 바인딩 대신 입력값이 사용됩니다
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

      {contextMenu && contextMenuPresets.length > 0 && (
        <div
          className="fixed z-[100] min-w-[180px] rounded-xl border border-neutral-200 bg-white p-2 shadow-2xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="px-2 pb-1 text-[10px] font-bold text-neutral-400 font-korean">빠른 필드 적용</p>
          <div className="space-y-1">
            {contextMenuPresets.map((preset) => (
              <button
                key={`${contextMenu.fieldId}_${preset.fieldType}_${preset.label}`}
                onClick={() => applyFieldPreset(contextMenu.fieldId, preset)}
                className="w-full rounded-lg px-2 py-2 text-left text-[11px] font-korean text-neutral-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {showGuide && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" onClick={() => closeGuide(true)}>
          <div
            className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
              <p className="text-xl font-bold font-korean">템플릿 만들기 사용 안내</p>
              <p className="mt-1 text-sm text-white/80 font-korean">
                실제 서류를 보면서 순서대로 따라 만들 수 있도록 구성했습니다.
              </p>
            </div>
            <div className="space-y-4 p-6">
              {GUIDE_STEPS.map((step, index) => (
                <div key={step.title} className="flex items-start gap-4 rounded-2xl border border-neutral-100 bg-slate-50 p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-neutral-800 font-korean">{step.title}</p>
                    <p className="mt-1 text-xs leading-5 text-neutral-500 font-korean">{step.description}</p>
                  </div>
                </div>
              ))}
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-bold text-amber-700 font-korean">바로 체감되는 편집 팁</p>
                <ul className="mt-2 space-y-1.5 text-xs leading-5 text-amber-700/90 font-korean">
                  <li>상단의 확대/축소 버튼으로 실제 서류를 읽기 좋은 크기로 맞춘 뒤 배치하세요.</li>
                  <li>필드 위에서 우클릭하면 이름, 주소, 전화번호 같은 빠른 라벨을 즉시 적용할 수 있습니다.</li>
                  <li>오른쪽의 입력 순서를 바꾸면 기사 앱의 입력 순서도 같은 순서로 열립니다.</li>
                </ul>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-neutral-100 px-6 py-4">
              <button
                type="button"
                onClick={() => closeGuide(false)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-neutral-600 hover:bg-slate-200 font-korean"
              >
                나중에 다시 보기
              </button>
              <button
                type="button"
                onClick={() => closeGuide(true)}
                className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 font-korean"
              >
                확인하고 계속 만들기
              </button>
            </div>
          </div>
        </div>
      )}

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
