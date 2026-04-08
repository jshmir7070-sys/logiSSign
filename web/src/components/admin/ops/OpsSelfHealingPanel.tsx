'use client'

import { useCallback, useEffect, useState } from 'react'
import Badge from '@/components/shared/Badge'

interface Incident {
  id: string
  time: string
  type: '자동복구' | '감지' | '승인대기' | '알림'
  severity: 'critical' | 'warning' | 'info' | 'resolved'
  msg: string
  dept: string
  autoHealed: boolean
}

interface LevelSummary {
  level1: number
  level2: number
  level3: number
  level4: number
}

interface IncidentResponse {
  incidents: Incident[]
  summary: {
    total: number
    autoHealed: number
    pending: number
    levels: LevelSummary
  }
}

const DEPT_ICONS: Record<string, string> = {
  cs: 'support_agent',
  legal: 'gavel',
  finance: 'account_balance',
  ops: 'engineering',
  dev: 'code',
  drivers: 'local_shipping',
}

const SEVERITY_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  resolved: 'success',
  info: 'info',
  warning: 'warning',
  critical: 'error',
}

export default function OpsSelfHealingPanel() {
  const [data, setData] = useState<IncidentResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/ops/incidents')
      if (response.ok) {
        const payload = await response.json()
        setData(payload)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[90px] animate-pulse rounded-2xl bg-surface-container-lowest shadow-ambient" />
          ))}
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[60px] animate-pulse rounded-xl bg-surface-container-lowest shadow-ambient" />
        ))}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-2xl bg-surface-container-lowest p-8 text-center shadow-ambient">
        <p className="font-body text-[14px] text-on-surface-variant">인시던트 데이터를 불러올 수 없습니다.</p>
      </div>
    )
  }

  const levels = [
    { label: 'Level 1 완전자동', desc: '재시작, 재시도', color: 'text-tertiary', bg: 'bg-tertiary/[0.08]', border: 'border-tertiary/20', count: data.summary.levels.level1 },
    { label: 'Level 2 자동+알림', desc: '재계산, 큐 재적재', color: 'text-primary', bg: 'bg-primary/[0.08]', border: 'border-primary/20', count: data.summary.levels.level2 },
    { label: 'Level 3 승인대기', desc: '데이터 수정, 환불', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', count: data.summary.levels.level3 },
    { label: 'Level 4 알림만', desc: '신규 오류, 보안', color: 'text-error', bg: 'bg-error/[0.08]', border: 'border-error/20', count: data.summary.levels.level4 },
  ]

  return (
    <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="font-headline text-[16px] font-bold text-on-surface">자동 복구 시스템 (Self-Healing)</h3>
        <div className="flex gap-4">
          <span className="font-body text-[12px] text-tertiary">자동복구 {data.summary.autoHealed}</span>
          <span className="font-body text-[12px] text-amber-600">대기 {data.summary.pending}</span>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {levels.map((l) => (
          <div key={l.label} className={`rounded-xl border p-4 ${l.bg} ${l.border}`}>
            <p className={`font-data text-[22px] font-bold ${l.color}`}>{l.count}</p>
            <p className="mt-1 font-body text-[11px] font-semibold text-on-surface">{l.label}</p>
            <p className="font-body text-[10px] text-on-surface-variant">{l.desc}</p>
          </div>
        ))}
      </div>

      <div className="max-h-[400px] space-y-2 overflow-y-auto">
        {data.incidents.map((inc) => (
          <div
            key={inc.id}
            className="flex items-center gap-3 rounded-xl border border-outline-variant/15 px-4 py-3"
          >
            <span className="min-w-[44px] font-data text-[11px] text-on-surface-variant">{inc.time}</span>
            <Badge label={inc.type} variant={SEVERITY_VARIANT[inc.severity] ?? 'default'} />
            <span className="flex-1 font-body text-[12px] text-on-surface">{inc.msg}</span>
            <span
              className="material-symbols-outlined text-[18px] text-on-surface-variant"
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 18" }}
            >
              {DEPT_ICONS[inc.dept] ?? 'help'}
            </span>
            {inc.autoHealed && (
              <span className="font-body text-[10px] text-tertiary">자동</span>
            )}
          </div>
        ))}
        {data.incidents.length === 0 && (
          <p className="py-8 text-center font-body text-[13px] text-on-surface-variant">
            최근 인시던트가 없습니다.
          </p>
        )}
      </div>
    </div>
  )
}
