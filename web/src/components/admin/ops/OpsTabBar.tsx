'use client'

export type OpsTab = 'dashboard' | 'weekly' | 'incidents' | 'departments'

interface TabItem {
  id: OpsTab
  label: string
  icon: string
}

const TABS: TabItem[] = [
  { id: 'dashboard', label: '운영 요약', icon: 'dashboard' },
  { id: 'weekly', label: '주간 추이', icon: 'stacked_line_chart' },
  { id: 'incidents', label: '이슈 현황', icon: 'warning' },
  { id: 'departments', label: '부서별 현황', icon: 'groups' },
]

interface OpsTabBarProps {
  activeTab: OpsTab
  onTabChange: (tab: OpsTab) => void
}

export default function OpsTabBar({ activeTab, onTabChange }: OpsTabBarProps) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-2xl bg-surface-container-lowest p-1.5 shadow-ambient">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-[13px] font-medium transition-all duration-200 ${
              isActive ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-low'
            }`}
          >
            <span
              className="material-symbols-outlined text-[18px]"
              style={{
                fontVariationSettings: `'FILL' ${isActive ? 1 : 0}, 'wght' 300, 'GRAD' 0, 'opsz' 18`,
              }}
            >
              {tab.icon}
            </span>
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
