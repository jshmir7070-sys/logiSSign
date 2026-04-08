'use client'

import { useCallback, useEffect, useState } from 'react'
import Badge from '@/components/shared/Badge'

interface Incident {
  id: string
  time: string
  type: string
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

const DEPARTMENT_ICONS: Record<string, string> = {
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
        setData(await response.json())
      }
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((index) => (
            <div key={index} className="h-[90px] animate-pulse rounded-2xl bg-surface-container-lowest shadow-ambient" />
          ))}
        </div>
        {[1, 2, 3].map((index) => (
          <div key={index} className="h-[60px] animate-pulse rounded-xl bg-surface-container-lowest shadow-ambient" />
        ))}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-2xl bg-surface-container-lowest p-8 text-center shadow-ambient">
        <p className="text-[14px] text-on-surface-variant">이슈 데이터를 불러오지 못했습니다.</p>
      </div>
    )
  }

  const levels = [
    {
      label: 'Level 1 자동 복구',
      desc: '즉시 복구 완료',
      color: 'text-tertiary',
      bg: 'bg-tertiary/[0.08]',
      border: 'border-tertiary/20',
      count: data.summary.levels.level1,
    },
    {
      label: 'Level 2 자동 복구 + 알림',
      desc: '자동 조치 후 알림',
      color: 'text-primary',
      bg: 'bg-primary/[0.08]',
      border: 'border-primary/20',
      count: data.summary.levels.level2,
    },
    {
      label: 'Level 3 수동 확인',
      desc: '결제, 발송, 데이터',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      count: data.summary.levels.level3,
    },
    {
      label: 'Level 4 긴급 대응',
      desc: '보안, 서비스 장애',
      color: 'text-error',
      bg: 'bg-error/[0.08]',
      border: 'border-error/20',
      count: data.summary.levels.level4,
    },
  ]

  return (
    <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="font-headline text-[16px] font-bold text-on-surface">자동 복구 및 이슈 대응</h3>
        <div className="flex gap-4 text-[12px]">
          <span className="text-tertiary">자동 복구 {data.summary.autoHealed}건</span>
          <span className="text-amber-600">수동 확인 {data.summary.pending}건</span>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {levels.map((level) => (
          <div key={level.label} className={`rounded-xl border p-4 ${level.bg} ${level.border}`}>
            <p className={`font-data text-[22px] font-bold ${level.color}`}>{level.count}</p>
            <p className="mt-1 text-[11px] font-semibold text-on-surface">{level.label}</p>
            <p className="text-[10px] text-on-surface-variant">{level.desc}</p>
          </div>
        ))}
      </div>

      <div className="max-h-[420px] space-y-2 overflow-y-auto">
        {data.incidents.map((incident) => (
          <div
            key={incident.id}
            className="flex items-center gap-3 rounded-xl border border-outline-variant/15 px-4 py-3"
          >
            <span className="min-w-[52px] text-[11px] text-on-surface-variant">{incident.time}</span>
            <Badge label={incident.type} variant={SEVERITY_VARIANT[incident.severity] ?? 'default'} />
            <span className="flex-1 text-[12px] text-on-surface">{incident.msg}</span>
            <span
              className="material-symbols-outlined text-[18px] text-on-surface-variant"
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 18" }}
            >
              {DEPARTMENT_ICONS[incident.dept] ?? 'help'}
            </span>
            {incident.autoHealed ? <span className="text-[10px] text-tertiary">자동 처리</span> : null}
          </div>
        ))}

        {data.incidents.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-on-surface-variant">최근 이슈가 없습니다.</p>
        ) : null}
      </div>
    </div>
  )
}
