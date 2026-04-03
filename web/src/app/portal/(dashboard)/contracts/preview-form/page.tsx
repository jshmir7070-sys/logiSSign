'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import {
  getContractTemplates,
  bindContractVariables,
  type ContractTemplate,
  type ContractBindingData,
} from '@/services/contract.service'
import { isGovernmentFormTemplate, previewGovernmentFormPdf } from '@/services/government-form-pdf.service'
import Badge from '@/components/shared/Badge'

interface DriverOption {
  id: string
  name: string
  phone: string | null
  address: string | null
  employee_code: string | null
  delivery_area: string | null
  birth_date: string | null
  vehicle_number: string | null
  vehicle_type: string | null
  vehicle_year: string | null
  vehicle_vin: string | null
  vehicle_mileage: number | null
  vehicle_rent_monthly: number | null
  vehicle_deposit: number | null
  vehicle_insurance_by: string | null
  is_business_owner: boolean
  business_reg_number: string | null
  representative_name: string | null
  business_address: string | null
  license_number: string | null
  principal_id: string | null
  principals: { name: string } | null
}

interface AgencyInfo {
  name: string
  business_number: string | null
  owner_name: string | null
  phone: string | null
  address: string | null
  address_detail: string | null
}

interface SealInfo {
  image_data: string | null
}

export default function PreviewFormPage() {
  const [drivers, setDrivers] = useState<DriverOption[]>([])
  const [templates, setTemplates] = useState<ContractTemplate[]>([])
  const [agency, setAgency] = useState<AgencyInfo | null>(null)
  const [seal, setSeal] = useState<SealInfo | null>(null)
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [initLoading, setInitLoading] = useState(true)

  // Load drivers, templates, agency info
  useEffect(() => {
    async function init() {
      const supabase = createBrowserSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      const agencyId = user?.app_metadata?.agency_id
      if (!agencyId) { setInitLoading(false); return }

      const [driversRes, agencyRes, sealRes, templatesRes] = await Promise.all([
        supabase.from('drivers')
          .select('id, name, phone, address, employee_code, delivery_area, birth_date, vehicle_number, vehicle_type, vehicle_year, vehicle_vin, vehicle_mileage, vehicle_rent_monthly, vehicle_deposit, vehicle_insurance_by, is_business_owner, business_reg_number, representative_name, business_address, license_number, principal_id, principals(name)')
          .eq('agency_id', agencyId)
          .eq('status', 'active')
          .order('name'),
        supabase.from('agencies')
          .select('name, business_number, owner_name, phone, address, address_detail')
          .eq('id', agencyId)
          .single(),
        supabase.from('seals')
          .select('image_data')
          .eq('owner_type', 'agency')
          .eq('owner_id', agencyId)
          .limit(1)
          .maybeSingle(),
        getContractTemplates(agencyId),
      ])

      setDrivers((driversRes.data ?? []) as unknown as DriverOption[])
      if (agencyRes.data) setAgency(agencyRes.data as unknown as AgencyInfo)
      if (sealRes.data) setSeal(sealRes.data as unknown as SealInfo)
      if (templatesRes.data) setTemplates(templatesRes.data)
      setInitLoading(false)
    }
    init()
  }, [])

  // Build binding data from selected driver + agency
  const buildBindingData = useCallback((): ContractBindingData => {
    const driver = drivers.find(d => d.id === selectedDriverId)
    const data: ContractBindingData = {}
    const today = new Date().toISOString().split('T')[0]

    if (driver) {
      data['기사명'] = driver.name
      data['전화번호'] = driver.phone ?? ''
      data['주소'] = driver.address ?? ''
      data['사번'] = driver.employee_code ?? ''
      data['배송지역'] = driver.delivery_area ?? ''
      data['생년월일'] = driver.birth_date ?? ''
      data['차량번호'] = driver.vehicle_number ?? ''
      data['차종'] = driver.vehicle_type ?? ''
      data['차명'] = driver.vehicle_type ?? ''
      data['연식'] = driver.vehicle_year ?? ''
      data['차대번호'] = driver.vehicle_vin ?? ''
      data['인도시주행거리'] = driver.vehicle_mileage?.toString() ?? ''
      data['월임대료'] = driver.vehicle_rent_monthly?.toLocaleString() ?? ''
      data['보증금'] = driver.vehicle_deposit?.toLocaleString() ?? ''
      data['보험부담'] = driver.vehicle_insurance_by === 'lessor' ? '임대인' : '임차인'
      data['면허번호'] = driver.license_number ?? ''
      data['사업자번호'] = driver.business_reg_number ?? ''
      data['대표자명'] = driver.representative_name ?? ''
      data['사업장주소'] = driver.business_address ?? ''
      data['카테고리명'] = driver.principals?.name ?? ''
    }

    if (agency) {
      data['대리점명'] = agency.name
      data['대리점사업자번호'] = agency.business_number ?? ''
      data['대리점대표자'] = agency.owner_name ?? ''
      data['대리점주소'] = [agency.address, agency.address_detail].filter(Boolean).join(' ')
      data['대리점연락처'] = agency.phone ?? ''
    }

    data['계약일'] = today
    data['계약시작일'] = today
    return data
  }, [selectedDriverId, drivers, agency])

  const handlePreview = async () => {
    if (!selectedTemplateId) return
    setLoading(true)
    setPreview(null)
    setPdfUrl(null)

    try {
      const bindingData = buildBindingData()

      if (isGovernmentFormTemplate(selectedTemplateId)) {
        // Government form: PDF overlay
        const url = await previewGovernmentFormPdf(selectedTemplateId, bindingData)
        setPdfUrl(url)
      } else {
        // Regular template: HTML text with variable substitution
        const template = templates.find(t => t.id === selectedTemplateId)
        if (template) {
          const rendered = bindContractVariables(template.content, bindingData)
          setPreview(rendered)
        }
      }
    } catch (err) {
      setPreview(`미리보기 생성 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
    } finally {
      setLoading(false)
    }
  }

  const selectedDriver = drivers.find(d => d.id === selectedDriverId)

  if (initLoading) {
    return <div className="p-6 text-center text-on-surface-variant">불러오는 중...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-headline font-bold text-on-surface font-korean">계약서 미리보기</h1>
        <p className="mt-1 text-sm text-on-surface-variant font-korean">
          기사 정보 + 운영사 정보가 자동 기입된 계약서를 미리 확인합니다
        </p>
      </div>

      {/* Controls */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Driver select */}
          <div>
            <label className="block text-xs font-label font-semibold text-on-surface-variant mb-1.5 font-korean">기사 선택</label>
            <select
              value={selectedDriverId}
              onChange={e => setSelectedDriverId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean border border-outline-variant/30"
            >
              <option value="">기사를 선택하세요</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.employee_code || d.phone || '-'})</option>
              ))}
            </select>
          </div>

          {/* Template select */}
          <div>
            <label className="block text-xs font-label font-semibold text-on-surface-variant mb-1.5 font-korean">계약서 양식</label>
            <select
              value={selectedTemplateId}
              onChange={e => setSelectedTemplateId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean border border-outline-variant/30"
            >
              <option value="">양식을 선택하세요</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePreview}
            disabled={loading || !selectedTemplateId}
            className="px-6 h-10 rounded-xl bg-primary text-on-primary text-sm font-medium font-korean hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? '생성 중...' : '미리보기'}
          </button>
          {pdfUrl && (
            <a
              href={pdfUrl}
              download="preview.pdf"
              className="px-6 h-10 flex items-center rounded-xl bg-secondary-container text-on-secondary-container text-sm font-medium font-korean"
            >
              PDF 다운로드
            </a>
          )}
        </div>
      </div>

      {/* Driver info card */}
      {selectedDriver && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
          <h3 className="text-sm font-headline font-bold text-on-surface mb-3 font-korean">기입 정보 확인</h3>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <InfoRow label="기사명" value={selectedDriver.name} />
            <InfoRow label="연락처" value={selectedDriver.phone} />
            <InfoRow label="주소" value={selectedDriver.address} />
            <InfoRow label="사번" value={selectedDriver.employee_code} />
            <InfoRow label="차량번호" value={selectedDriver.vehicle_number} />
            <InfoRow label="차종" value={selectedDriver.vehicle_type} />
            <InfoRow label="사업자번호" value={selectedDriver.business_reg_number} />
            <InfoRow label="면허번호" value={selectedDriver.license_number} />
            <InfoRow label="원청사" value={selectedDriver.principals?.name} />
          </div>
          {agency && (
            <>
              <div className="border-t border-outline-variant/20 my-3" />
              <div className="grid grid-cols-3 gap-3 text-sm">
                <InfoRow label="대리점명" value={agency.name} />
                <InfoRow label="대리점 사업자번호" value={agency.business_number} />
                <InfoRow label="대표자" value={agency.owner_name} />
              </div>
            </>
          )}
          {seal?.image_data && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-on-surface-variant font-korean">도장:</span>
              <Badge label="등록됨" variant="success" />
            </div>
          )}
        </div>
      )}

      {/* Preview area: PDF or Text */}
      {pdfUrl && (
        <div className="border border-outline-variant rounded-2xl overflow-hidden" style={{ height: '80vh' }}>
          <iframe src={pdfUrl} className="w-full h-full" title="PDF Preview" />
        </div>
      )}

      {preview && !pdfUrl && (
        <div className="bg-white rounded-2xl shadow-ambient p-8 border border-outline-variant/30">
          <div
            className="prose prose-sm max-w-none font-korean whitespace-pre-wrap"
            style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
          >
            {preview}
          </div>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <span className="text-xs text-on-surface-variant font-korean">{label}</span>
      <p className="text-sm text-on-surface font-korean mt-0.5">{value || <span className="text-on-surface-variant/50">미입력</span>}</p>
    </div>
  )
}
