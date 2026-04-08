'use client'

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Badge from '@/components/shared/Badge'

interface AdminSystemTemplate {
  id: string
  title: string
  category: string | null
  is_active: boolean
  created_at: string
  template_pdf_url: string | null
  template_type: string | null
  is_system: boolean | null
}

const CATEGORY_OPTIONS = [
  { value: '', label: '전체 공통' },
  { value: '택배', label: '택배' },
  { value: '화물', label: '화물' },
  { value: '위수탁', label: '위수탁' },
  { value: '정산', label: '정산' },
  { value: '기타', label: '기타' },
] as const

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ko-KR')
}

export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<AdminSystemTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const sortedTemplates = useMemo(
    () => [...templates].sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.title.localeCompare(b.title)),
    [templates],
  )

  const resetForm = useCallback(() => {
    setTitle('')
    setCategory('')
    setSelectedFile(null)
  }, [])

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/templates', { cache: 'no-store' })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '기본 템플릿 목록을 불러오지 못했습니다.')
      }

      setTemplates((result.templates ?? []) as AdminSystemTemplate[])
    } catch (error) {
      console.error('기본 템플릿 목록 조회 실패:', error)
      alert(error instanceof Error ? error.message : '기본 템플릿 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTemplates()
  }, [loadTemplates])

  async function handleUpload() {
    if (!title.trim()) {
      alert('템플릿 이름을 입력해 주세요.')
      return
    }

    if (!selectedFile) {
      alert('PDF 파일을 선택해 주세요.')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('title', title.trim())
      formData.append('category', category)
      formData.append('file', selectedFile)

      const response = await fetch('/api/admin/templates', {
        method: 'POST',
        body: formData,
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '기본 템플릿을 등록하지 못했습니다.')
      }

      resetForm()
      await loadTemplates()
      alert('기본 템플릿을 등록했습니다. 고객사는 템플릿 만들기 메뉴에서 편집해 사용할 수 있습니다.')
    } catch (error) {
      console.error('기본 템플릿 업로드 실패:', error)
      alert(error instanceof Error ? error.message : '기본 템플릿을 등록하지 못했습니다.')
    } finally {
      setUploading(false)
    }
  }

  async function handleToggle(template: AdminSystemTemplate) {
    try {
      const response = await fetch('/api/admin/templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: template.id,
          is_active: !template.is_active,
        }),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '템플릿 상태를 변경하지 못했습니다.')
      }

      setTemplates((prev) => prev.map((item) => (item.id === template.id ? { ...item, is_active: !item.is_active } : item)))
    } catch (error) {
      alert(error instanceof Error ? error.message : '템플릿 상태를 변경하지 못했습니다.')
    }
  }

  async function handleRename(template: AdminSystemTemplate) {
    const nextTitle = window.prompt('새 템플릿 이름을 입력해 주세요.', template.title)?.trim()
    if (!nextTitle || nextTitle === template.title) return

    const nextCategory = window.prompt('카테고리를 입력해 주세요. (비워 두면 전체 공통)', template.category ?? '') ?? ''

    try {
      const response = await fetch('/api/admin/templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: template.id,
          title: nextTitle,
          category: nextCategory,
        }),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '템플릿 정보를 수정하지 못했습니다.')
      }

      setTemplates((prev) =>
        prev.map((item) =>
          item.id === template.id
            ? {
                ...item,
                title: nextTitle,
                category: nextCategory.trim() || null,
              }
            : item,
        ),
      )
    } catch (error) {
      alert(error instanceof Error ? error.message : '템플릿 정보를 수정하지 못했습니다.')
    }
  }

  async function handleDelete(template: AdminSystemTemplate) {
    if (!window.confirm(`"${template.title}" 기본 템플릿을 삭제하시겠습니까?\n\n고객사가 이미 복제해 편집한 템플릿은 유지됩니다.`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/templates?id=${template.id}`, {
        method: 'DELETE',
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '템플릿을 삭제하지 못했습니다.')
      }

      setTemplates((prev) => prev.filter((item) => item.id !== template.id))
    } catch (error) {
      alert(error instanceof Error ? error.message : '템플릿을 삭제하지 못했습니다.')
    }
  }

  function handleSelectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setSelectedFile(file)
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-headline font-bold text-on-surface font-korean">기본 템플릿 업로드</h1>
          <p className="mt-1 text-sm text-on-surface-variant font-korean">
            관리자가 계약서 PDF를 올리면 고객사가 템플릿 만들기 메뉴에서 편집해 자기 템플릿으로 복제해 사용합니다.
          </p>
          <p className="mt-0.5 text-xs text-on-surface-variant/60 font-korean">
            관리자 화면에서는 기본 템플릿 목록만 관리하고, 필드 편집 작업은 고객사에서 진행합니다.
          </p>
        </div>
        <Badge label={`기본 템플릿 ${templates.length}개`} variant="info" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-6">
        <section className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 space-y-4">
          <div>
            <h2 className="text-lg font-headline font-bold text-on-surface font-korean">새 기본 템플릿 등록</h2>
            <p className="mt-1 text-xs text-on-surface-variant font-korean">
              PDF로 등록한 기본 템플릿은 고객사 템플릿 만들기 목록에 자동으로 노출됩니다.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1.5 font-korean">템플릿 이름</label>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="예: 택배용 화물자동차 전속 운송 계약서"
                className="w-full h-11 rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 text-sm font-korean outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1.5 font-korean">카테고리</label>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full h-11 rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 text-sm font-korean outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1.5 font-korean">계약서 PDF</label>
              <label className="flex h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant/30 bg-surface-container-low text-center transition-colors hover:border-primary/30 hover:bg-surface-container-high">
                <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleSelectFile} />
                <span className="text-2xl">📄</span>
                <span className="mt-2 text-sm font-semibold text-on-surface font-korean">
                  {selectedFile ? selectedFile.name : 'PDF 파일 선택'}
                </span>
                <span className="mt-1 text-xs text-on-surface-variant font-korean">20MB 이하 PDF만 업로드할 수 있습니다.</span>
              </label>
            </div>

            <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
              <p className="text-xs font-semibold text-primary font-korean">등록 후 동작</p>
              <ol className="mt-2 space-y-1.5 text-xs text-on-surface-variant font-korean">
                <li>1. 고객사 템플릿 만들기 목록에 기본 템플릿으로 보입니다.</li>
                <li>2. 고객사가 편집 시작을 누르면 자기 고객사 전용 복사본이 생성됩니다.</li>
                <li>3. 고객사는 그 복사본에서 필드를 편집하고 발송에 사용합니다.</li>
              </ol>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleUpload()}
              disabled={uploading}
              className="h-11 flex-1 rounded-xl bg-power-gradient text-white text-sm font-semibold font-korean disabled:opacity-50"
            >
              {uploading ? '등록 중...' : '기본 템플릿 등록'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="h-11 rounded-xl border border-outline-variant/20 px-4 text-sm text-on-surface-variant font-korean hover:bg-surface-container-low"
            >
              초기화
            </button>
          </div>
        </section>

        <section className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
            <div>
              <h2 className="text-lg font-headline font-bold text-on-surface font-korean">기본 템플릿 목록</h2>
              <p className="mt-1 text-xs text-on-surface-variant font-korean">
                고객사가 템플릿 만들기 메뉴에서 공유받는 기본 템플릿입니다.
              </p>
            </div>
            <Badge label={`활성 ${templates.filter((template) => template.is_active).length}개`} variant="success" />
          </div>

          {loading ? (
            <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-10 text-center text-sm text-on-surface-variant font-korean">
              불러오는 중...
            </div>
          ) : sortedTemplates.length === 0 ? (
            <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-10 text-center space-y-2">
              <div className="text-3xl">🗂️</div>
              <p className="text-sm text-on-surface-variant font-korean">등록된 기본 템플릿이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedTemplates.map((template) => (
                <div
                  key={template.id}
                  className={`rounded-2xl border p-4 transition-colors ${
                    template.is_active
                      ? 'border-outline-variant/15 bg-surface-container-low'
                      : 'border-outline-variant/10 bg-surface-container-low opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-semibold text-on-surface font-korean truncate">{template.title}</p>
                        <Badge label="기본 템플릿" variant="warning" />
                        <Badge label={template.is_active ? '활성' : '비활성'} variant={template.is_active ? 'success' : 'default'} />
                        {template.category && <Badge label={template.category} variant="info" />}
                      </div>
                      <p className="mt-1 text-xs text-on-surface-variant font-korean">
                        등록일 {formatDate(template.created_at)} · 고객사가 편집용으로 복제해 사용
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      <button
                        type="button"
                        onClick={() => void handleToggle(template)}
                        className="h-9 rounded-xl border border-outline-variant/20 px-4 text-xs font-semibold text-on-surface-variant font-korean hover:bg-surface-container-high"
                      >
                        {template.is_active ? '비활성화' : '활성화'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRename(template)}
                        className="h-9 rounded-xl bg-primary/10 px-4 text-xs font-semibold text-primary font-korean hover:bg-primary/20"
                      >
                        이름/카테고리 수정
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(template)}
                        className="h-9 rounded-xl px-4 text-xs font-semibold text-error font-korean hover:bg-error/10"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
