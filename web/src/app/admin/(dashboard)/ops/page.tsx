'use client'

import { useMemo, useState } from 'react'
import OpsDepartmentsPanel from '@/components/admin/ops/OpsDepartmentsPanel'
import OpsKpiPanel from '@/components/admin/ops/OpsKpiPanel'
import OpsReportsPanel from '@/components/admin/ops/OpsReportsPanel'
import OpsSelfHealingPanel from '@/components/admin/ops/OpsSelfHealingPanel'
import OpsTabBar, { type OpsTab } from '@/components/admin/ops/OpsTabBar'

const TAB_DESCRIPTIONS: Record<OpsTab, { title: string; description: string }> = {
  dashboard: {
    title: '운영 요약',
    description: '매출, 고객사 결제, 기사 연결 현황을 한 화면에서 빠르게 확인합니다.',
  },
  weekly: {
    title: '주간 추이',
    description: '최근 7일 기준으로 매출, 신규 고객사, 결제 주문, 경고 로그 흐름을 비교합니다.',
  },
  incidents: {
    title: '이슈 현황',
    description: '보안 경고, 결제 실패, 세금계산서 전송 실패 등 최근 운영 이슈를 관리합니다.',
  },
  departments: {
    title: '부서별 현황',
    description: '고객센터, 법무, 재무, 운영, 개발, 기사관리 업무를 실제 운영 지표로 보여줍니다.',
  },
}

export default function AdminOpsPage() {
  const [activeTab, setActiveTab] = useState<OpsTab>('dashboard')
  const currentTab = useMemo(() => TAB_DESCRIPTIONS[activeTab], [activeTab])

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-headline text-[26px] font-bold tracking-tight text-on-surface">운영 대시보드</h2>
          <p className="mt-1 text-[14px] text-on-surface-variant">
            고객사 운영 현황, 계약과 정산 흐름, 결제, 세금계산서 전송 이력을 운영 관점에서 확인합니다.
          </p>
        </div>
        <div className="rounded-2xl bg-surface-container-lowest px-4 py-3 text-[13px] text-on-surface-variant shadow-ambient">
          {currentTab.title}: {currentTab.description}
        </div>
      </div>

      <OpsTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'dashboard' ? <OpsKpiPanel /> : null}
      {activeTab === 'weekly' ? <OpsReportsPanel /> : null}
      {activeTab === 'incidents' ? <OpsSelfHealingPanel /> : null}
      {activeTab === 'departments' ? <OpsDepartmentsPanel /> : null}
    </div>
  )
}
