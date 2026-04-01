'use client'

import { useState } from 'react'
import {
  GOVERNMENT_FORM_TEMPLATE_IDS,
  previewGovernmentFormPdf,
} from '@/services/government-form-pdf.service'
import type { ContractBindingData } from '@/services/contract.service'

/**
 * 관공서 서류 미리보기 / 테스트 페이지
 * 바인딩 데이터를 입력하고 원본 PDF에 오버레이된 결과를 미리볼 수 있음
 */

const SAMPLE_DATA: Partial<ContractBindingData> = {
  기사명: '홍길동',
  주민등록번호: '900101-1234567',
  주소: '서울특별시 강남구 테헤란로 123',
  전화번호: '010-1234-5678',
  택배사업자명: '롯데글로벌로지스㈜',
  대리점명: '강남대리점',
  대리점대표자: '김대표',
  대리점주소: '서울특별시 강남구 역삼동 456-7',
  대리점연락처: '02-1234-5678',
  대리점사업자번호: '123-45-67890',
  전속계약기간: '2',
  계약시작일: '2025-04-01',
  계약종료일: '2027-03-31',
  경력기간: '3',
  경력시작: '2022-01-01',
  경력종료: '2024-12-31',
  연료종류: '경유',
  차명: '포터2',
  연식: '2024',
  최대적재량: '1000',
  차량형태: '탑형',
  면허번호: '서울-12-345678-90',
  면허종류: '1종 보통',
  자격증번호: 'HF-2023-12345',
  자격취득일: '2023-06-15',
  생년월일: '1990-01-01',
  관할법원: '서울중앙',
  계약일: '2025-04-01',
  사번: 'D001',
}

const TEMPLATE_OPTIONS = [
  { id: 'a1b2c3d4-1111-4aaa-bbbb-000000000001', label: '1. 신규허가 신청서' },
  { id: 'a1b2c3d4-2222-4aaa-bbbb-000000000002', label: '2. 전속 운송 계약서' },
  { id: 'a1b2c3d4-3333-4aaa-bbbb-000000000003', label: '3. 개인정보활용 동의서' },
]

export default function PreviewFormPage() {
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATE_OPTIONS[0].id)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    setPdfUrl(null)

    try {
      const url = await previewGovernmentFormPdf(
        selectedTemplate,
        SAMPLE_DATA as ContractBindingData
      )
      setPdfUrl(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF 생성 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold mb-4 font-korean">관공서 서류 미리보기</h1>
      <p className="text-sm text-on-surface-variant mb-6 font-korean">
        원본 PDF 레이아웃에 바인딩 데이터가 올바르게 오버레이되는지 확인합니다.
      </p>

      <div className="flex items-center gap-4 mb-6">
        <select
          value={selectedTemplate}
          onChange={(e) => setSelectedTemplate(e.target.value)}
          className="h-10 px-4 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean"
        >
          {TEMPLATE_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="px-6 h-10 rounded-xl bg-primary text-on-primary text-sm font-medium font-korean hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? '생성 중...' : 'PDF 미리보기'}
        </button>

        {pdfUrl && (
          <a
            href={pdfUrl}
            download="preview.pdf"
            className="px-6 h-10 flex items-center rounded-xl bg-secondary-container text-on-secondary-container text-sm font-medium font-korean hover:bg-secondary-container/80 transition-colors"
          >
            다운로드
          </a>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-error-container text-on-error-container text-sm mb-4 font-korean">
          {error}
        </div>
      )}

      {pdfUrl && (
        <div className="border border-outline-variant rounded-xl overflow-hidden" style={{ height: '80vh' }}>
          <iframe
            src={pdfUrl}
            className="w-full h-full"
            title="PDF Preview"
          />
        </div>
      )}

      <div className="mt-6 p-4 rounded-xl bg-surface-container-low">
        <h3 className="text-sm font-medium text-on-surface mb-2 font-korean">샘플 바인딩 데이터:</h3>
        <pre className="text-xs text-on-surface-variant overflow-auto max-h-60">
          {JSON.stringify(SAMPLE_DATA, null, 2)}
        </pre>
      </div>
    </div>
  )
}
