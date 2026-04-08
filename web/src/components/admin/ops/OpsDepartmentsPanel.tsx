'use client'

import { useCallback, useEffect, useState } from 'react'

interface DeptMetrics {
  [key: string]: string | number
}

interface Department {
  id: string
  name: string
  icon: string
  color: string
  agent: string
  metrics: DeptMetrics
}

export default function OpsDepartmentsPanel() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/ops/departments')
      if (response.ok) {
        const payload = await response.json()
        setDepartments(payload.departments ?? [])
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
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((index) => (
          <div key={index} className="h-[220px] animate-pulse rounded-2xl bg-surface-container-lowest shadow-ambient" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {departments.map((department) => {
        const metricEntries = Object.entries(department.metrics).filter(([key]) => key !== '주요 이슈')

        return (
          <div
            key={department.id}
            className="relative overflow-hidden rounded-2xl bg-surface-container-lowest p-5 shadow-ambient"
          >
            <div className="absolute left-0 right-0 top-0 h-[3px]" style={{ backgroundColor: department.color }} />

            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${department.color}14` }}
                >
                  <span
                    className="material-symbols-outlined text-[22px]"
                    style={{
                      color: department.color,
                      fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 22",
                    }}
                  >
                    {department.icon}
                  </span>
                </div>
                <div>
                  <p className="font-headline text-[14px] font-bold text-on-surface">{department.name}</p>
                  <p className="text-[10px] text-on-surface-variant">{department.agent}</p>
                </div>
              </div>
              <span className="rounded-lg bg-tertiary/[0.08] px-2 py-1 text-[10px] font-medium text-tertiary">
                실시간
              </span>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2">
              {metricEntries.map(([key, value]) => (
                <div key={key} className="rounded-lg bg-surface-container-low px-3 py-2">
                  <p className="text-[10px] text-on-surface-variant">{key}</p>
                  <p className="font-data text-[14px] font-semibold text-on-surface">{String(value)}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-outline-variant/15 pt-3">
              <span className="text-[11px] text-on-surface-variant">
                주요 이슈: {String(department.metrics['주요 이슈'] ?? '-')}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
