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
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-[220px] animate-pulse rounded-2xl bg-surface-container-lowest shadow-ambient" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {departments.map((dept) => {
        const metricEntries = Object.entries(dept.metrics).filter(([k]) => k !== 'topIssue')

        return (
          <div
            key={dept.id}
            className="relative overflow-hidden rounded-2xl bg-surface-container-lowest p-5 shadow-ambient"
          >
            <div className="absolute left-0 right-0 top-0 h-[3px]" style={{ backgroundColor: dept.color }} />

            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${dept.color}14` }}
                >
                  <span
                    className="material-symbols-outlined text-[22px]"
                    style={{
                      color: dept.color,
                      fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 22",
                    }}
                  >
                    {dept.icon}
                  </span>
                </div>
                <div>
                  <p className="font-headline text-[14px] font-bold text-on-surface">{dept.name}</p>
                  <p className="font-body text-[10px] text-on-surface-variant">{dept.agent}</p>
                </div>
              </div>
              <span className="rounded-lg bg-tertiary/[0.08] px-2 py-1 font-body text-[10px] font-medium text-tertiary">
                정상
              </span>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2">
              {metricEntries.map(([key, val]) => (
                <div key={key} className="rounded-lg bg-surface-container-low px-3 py-2">
                  <p className="font-body text-[10px] capitalize text-on-surface-variant">{key}</p>
                  <p className="font-data text-[14px] font-semibold text-on-surface">{String(val)}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-outline-variant/15 pt-3">
              <span className="font-body text-[10px] text-on-surface-variant">
                주요 이슈: {String(dept.metrics.topIssue ?? '-')}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
