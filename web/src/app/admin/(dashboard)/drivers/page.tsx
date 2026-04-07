'use client'

import { useEffect, useMemo, useState } from 'react'
import Badge from '@/components/shared/Badge'

interface DriverRow {
  id: string
  agency_name: string
  name: string
  phone: string
  email: string | null
  employee_code: string | null
  driver_code: string | null
  delivery_area: string | null
  vehicle_number: string | null
  status: string
  linked: boolean
  push_enabled: boolean
  pending_contracts: number
  pending_documents: number
  latest_settlement_month: string | null
  last_activity_at: string | null
}

interface DriversResponse {
  drivers: DriverRow[]
  summary: {
    totalDrivers: number
    linkedDrivers: number
    pushEnabledDrivers: number
    pendingContracts: number
    pendingDocuments: number
  }
}

export default function AdminDriversPage() {
  const [data, setData] = useState<DriversResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'linked' | 'unlinked'>('all')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/drivers')
        const payload = await res.json()
        if (!res.ok) throw new Error(payload.error || '기사 운영 데이터를 불러오지 못했습니다.')
        setData(payload)
      } catch (error) {
        alert(error instanceof Error ? error.message : '기사 운영 데이터를 불러오지 못했습니다.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  const filtered = useMemo(() => {
    const rows = data?.drivers ?? []
    return rows.filter((driver) => {
      if (statusFilter === 'linked' && !driver.linked) return false
      if (statusFilter === 'unlinked' && driver.linked) return false
      if (!search.trim()) return true
      const needle = search.toLowerCase()
      return (
        driver.name.toLowerCase().includes(needle) ||
        driver.agency_name.toLowerCase().includes(needle) ||
        (driver.employee_code ?? '').toLowerCase().includes(needle) ||
        (driver.driver_code ?? '').toLowerCase().includes(needle) ||
        driver.phone.toLowerCase().includes(needle)
      )
    })
  }, [data?.drivers, search, statusFilter])

  const summary = data?.summary

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-headline text-on-surface text-[26px] font-bold tracking-tight">기사 운영</h2>
        <p className="font-body text-on-surface-variant text-[14px] mt-1">
          기사 가입 연결 상태, 푸시 상태, 미서명 계약/문서를 전사 기준으로 확인합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {[
          ['전체 기사', `${summary?.totalDrivers ?? 0}명`],
          ['가입 연결 완료', `${summary?.linkedDrivers ?? 0}명`],
          ['푸시 가능', `${summary?.pushEnabledDrivers ?? 0}명`],
          ['미서명 계약', `${summary?.pendingContracts ?? 0}건`],
          ['미완료 문서', `${summary?.pendingDocuments ?? 0}건`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-surface-container-lowest shadow-ambient p-5">
            <p className="text-xs text-on-surface-variant">{label}</p>
            <p className="text-2xl font-bold text-on-surface mt-2">{loading ? '...' : value}</p>
          </div>
        ))}
      </div>

      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[280px]">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="기사명, 고객사명, 사번, 기사고유코드, 전화번호 검색"
              className="w-full h-10 px-4 rounded-xl bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex gap-2">
            {[
              { id: 'all', label: '전체' },
              { id: 'linked', label: '가입 완료' },
              { id: 'unlinked', label: '미연결' },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setStatusFilter(option.id as 'all' | 'linked' | 'unlinked')}
                className={`h-9 px-4 rounded-xl text-sm font-medium transition-colors ${
                  statusFilter === option.id
                    ? 'bg-primary text-white'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant">기사</th>
                <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant">고객사</th>
                <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant">코드</th>
                <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant">상태</th>
                <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant">운영 지표</th>
                <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant">최근 활동</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-on-surface-variant">불러오는 중입니다...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-on-surface-variant">조건에 맞는 기사가 없습니다.</td>
                </tr>
              ) : (
                filtered.map((driver) => (
                  <tr key={driver.id} className="hover:bg-surface-container-low/50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-on-surface">{driver.name}</p>
                      <p className="text-xs text-on-surface-variant mt-1">
                        {driver.phone} {driver.email ? `· ${driver.email}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-on-surface">{driver.agency_name}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-on-surface">기사고유코드 {driver.driver_code ?? '-'}</p>
                      <p className="text-xs text-on-surface-variant mt-1">사번 {driver.employee_code ?? '-'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge label={driver.linked ? '가입 완료' : '미연결'} variant={driver.linked ? 'success' : 'warning'} />
                        <Badge label={driver.push_enabled ? '푸시 가능' : '푸시 없음'} variant={driver.push_enabled ? 'info' : 'default'} />
                        <Badge label={driver.status === 'active' ? '활성' : driver.status} variant={driver.status === 'active' ? 'success' : 'default'} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-on-surface">미서명 계약 {driver.pending_contracts}건</p>
                      <p className="text-xs text-on-surface mt-1">미완료 문서 {driver.pending_documents}건</p>
                      <p className="text-xs text-on-surface-variant mt-1">최근 정산 {driver.latest_settlement_month ?? '-'}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-on-surface-variant">
                      {driver.last_activity_at ? new Date(driver.last_activity_at).toLocaleString('ko-KR') : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
